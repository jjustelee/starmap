/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): predictions, prediction_aggregates(또는 RPC)로 교체할 Mock 게이트웨이 경계 파일.
 * - BACKEND_TODO(KIS): 현재가는 KIS 원천을 백엔드에서 주입하고 프론트는 앱 API만 호출.
 * - BACKEND_TODO(API): /api/v1/predictions, /api/v1/symbols/{symbol}/prediction-snapshot 계약으로 대체.
 */
import { fetchStockInfo, submitPrediction } from '../utils/mockData';
import { supabase } from '../utils/supabaseClient';

const WINDOW_DAYS = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    all: 36500
};

const MAX_HORIZON_DAYS = 1095;
const MIN_PRICE = 100;

/**
 * I/O Contract
 * input: symbol(string), hintPrice(number|undefined)
 * output: Promise<number> - 현재가
 */
export async function loadCurrentPrice(symbol, hintPrice = 0) {
    // BACKEND_TODO(API): GET /api/v1/symbols/{symbol}/price -> { currentPrice, updatedAt }.
    const stock = await fetchStockInfo(String(symbol || ''));
    const fromStock = Number(stock?.currentPrice || stock?.current_price || 0);
    if (Number.isFinite(fromStock) && fromStock > 0) {
        return Math.max(MIN_PRICE, Math.round(fromStock));
    }
    void hintPrice;
    return 0;
}

/**
 * I/O Contract
 * input: symbol(string), window("24h"|"7d"|"30d"|"all"), options({ currentPrice?: number })
 * output: Promise<PredictionSnapshot>
 */
export async function loadPredictionSnapshot(symbol, window, options = {}) {
    // BACKEND_TODO(API): GET /api/v1/symbols/{symbol}/prediction-snapshot?window=... 응답 shape로 교체.
    const normalizedWindow = WINDOW_DAYS[window] ? window : '7d';
    const stock = await fetchStockInfo(String(symbol || ''));
    const fromStock = Number(stock?.currentPrice || stock?.current_price || 0);
    const fromOption = Number(options.currentPrice) || 0;
    const currentPrice = Math.max(
        MIN_PRICE,
        Math.round(fromStock > 0 ? fromStock : (fromOption > 0 ? fromOption : MIN_PRICE))
    );

    if (!stock?.id) {
        return buildEmptySnapshot(normalizedWindow, currentPrice);
    }

    let query = supabase
        .from('predictions')
        .select('id, price_target, target_date, x_future_ratio, created_at')
        .eq('stock_id', stock.id);

    if (normalizedWindow !== 'all') {
        const cutoff = new Date(Date.now() - WINDOW_DAYS[normalizedWindow] * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', cutoff);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(3000);

    if (error) {
        console.error('Error loading prediction snapshot:', error);
        return buildEmptySnapshot(normalizedWindow, currentPrice);
    }

    const dots = buildDotsFromPredictions(data || []);
    if (!dots.length) {
        return buildEmptySnapshot(normalizedWindow, currentPrice);
    }

    const sortedPrices = dots.map((dot) => dot.price).sort((a, b) => a - b);
    const avg = Math.round(sortedPrices.reduce((sum, p) => sum + p, 0) / Math.max(1, sortedPrices.length));
    const mode = getModePrice(dots);
    const q1 = quantile(sortedPrices, 0.25);
    const q3 = quantile(sortedPrices, 0.75);
    const bullishCount = dots.filter((dot) => dot.price >= currentPrice).length;
    const bullishRatio = ratio(bullishCount, dots.length);

    const allPrices = [...sortedPrices, currentPrice];
    const yMin = Math.max(MIN_PRICE, Math.min(...allPrices) * 0.97);
    const yMax = Math.max(...allPrices) * 1.03;

    const overlayType = dots.length <= 150 ? 'dot' : 'cluster';
    const cells = buildCells(dots, yMin, yMax);

    return {
        window: normalizedWindow,
        updatedAt: new Date().toISOString(),
        currentPrice,
        sampleSize: dots.length,
        stats: {
            avg,
            mode,
            q1,
            q3,
            bullishRatio,
            bearishRatio: Math.max(0, 1 - bullishRatio)
        },
        overlay: {
            type: overlayType,
            dots,
            cells,
            xDomain: { min: 0, max: MAX_HORIZON_DAYS },
            yDomain: { min: Math.round(yMin), max: Math.round(yMax) }
        }
    };
}

/**
 * I/O Contract
 * input: draft({ symbol, targetPrice, targetDate, window, source, rangeLevel })
 * output: Promise<{ predictionId: string, acceptedAt: string }>
 */
export async function submitPredictionDraft(draft) {
    // BACKEND_TODO(SUPABASE): predictions 테이블 insert 또는 RPC submit_prediction 사용.
    // BACKEND_TODO(API): POST /api/v1/predictions body/response 계약으로 교체.
    const validation = validatePredictionDraft(draft);
    if (!validation.ok) {
        throw new Error(validation.reason);
    }

    const acceptedAt = new Date().toISOString();
    let predictionId = `prediction_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const stock = await fetchStockInfo(String(draft.symbol || ''));
    let stockId = stock?.id || null;
    if (!stockId) {
        const { data: resolvedId, error: resolveError } = await supabase
            .rpc('resolve_stock_id', {
                p_symbol: String(draft.symbol || ''),
                p_hint_price: Math.round(Number(draft.targetPrice) || 0)
            });
        if (resolveError || !resolvedId) {
            throw new Error('종목 동기화 중이라 잠시 후 다시 시도해 주세요.');
        }
        stockId = resolvedId;
    }
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    if (!userId) {
        throw new Error('로그인 상태를 확인한 뒤 다시 시도해 주세요.');
    }
    const horizonDays = clamp(daysUntil(String(draft.targetDate || '')), 0, MAX_HORIZON_DAYS);
    const xFutureRatio = Number((horizonDays / MAX_HORIZON_DAYS).toFixed(4));
    const inserted = await submitPrediction(
        stockId,
        Math.round(Number(draft.targetPrice)),
        xFutureRatio,
        0.25,
        userId,
        String(draft.targetDate || '')
    );
    if (Array.isArray(inserted) && inserted[0]?.id) {
        predictionId = String(inserted[0].id);
    }

    return { predictionId, acceptedAt };
}

/**
 * I/O Contract
 * input: draft(any)
 * output: { ok: boolean, reason?: string }
 */
export function validatePredictionDraft(draft) {
    const targetPrice = Number(draft?.targetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        return { ok: false, reason: '예언 종가는 0보다 커야 해요.' };
    }

    const targetDate = parseISODate(draft?.targetDate);
    if (!targetDate) {
        return { ok: false, reason: '예언 만기일 형식이 올바르지 않아요.' };
    }

    const today = startOfDay(new Date());
    const maxDate = addDays(today, MAX_HORIZON_DAYS);
    if (targetDate < today) {
        return { ok: false, reason: '예언 만기일은 오늘 이후여야 해요.' };
    }
    if (targetDate > maxDate) {
        return { ok: false, reason: '예언 만기일은 3년 이내로 선택해 주세요.' };
    }

    // BACKEND_TODO(API): source/rangeLevel은 UX 분석 및 근접도 모델 개선 피처로 저장.
    const rangeLevel = String(draft?.rangeLevel || 'L1');
    if (!['L1', 'L2', 'L3'].includes(rangeLevel)) {
        return { ok: false, reason: '가격 조준 범위 정보가 올바르지 않아요.' };
    }

    return { ok: true };
}

function buildDotsFromPredictions(rows) {
    return rows
        .map((row) => {
            const price = Number(row.price_target);
            if (!Number.isFinite(price) || price <= 0) return null;

            const parsedTargetDate = parseISODate(String(row.target_date || ''));
            const fromDate = parsedTargetDate ? daysUntil(String(row.target_date || '')) : null;
            const fromRatioRaw = Number(row.x_future_ratio);
            const fromRatio = Number.isFinite(fromRatioRaw) ? Math.round(fromRatioRaw * MAX_HORIZON_DAYS) : null;
            const xDays = clamp(
                Number.isFinite(fromDate)
                    ? fromDate
                    : (Number.isFinite(fromRatio) ? fromRatio : 90),
                0,
                MAX_HORIZON_DAYS
            );

            return {
                id: String(row.id),
                xDays,
                price: Math.max(MIN_PRICE, Math.round(price)),
                weight: 1
            };
        })
        .filter(Boolean);
}

function buildEmptySnapshot(window, currentPrice) {
    return {
        window,
        updatedAt: new Date().toISOString(),
        currentPrice,
        sampleSize: 0,
        stats: {
            avg: null,
            mode: null,
            q1: null,
            q3: null,
            bullishRatio: null,
            bearishRatio: null
        },
        overlay: {
            type: 'dot',
            dots: [],
            cells: [],
            xDomain: { min: 0, max: MAX_HORIZON_DAYS },
            yDomain: {
                min: Math.max(MIN_PRICE, Math.round(currentPrice * 0.9)),
                max: Math.round(currentPrice * 1.1)
            }
        }
    };
}

function buildCells(dots, yMin, yMax) {
    const xBins = 12;
    const yBins = 10;
    const map = new Map();
    for (const dot of dots) {
        const xBin = clamp(Math.floor((dot.xDays / MAX_HORIZON_DAYS) * xBins), 0, xBins - 1);
        const yNorm = (dot.price - yMin) / Math.max(1, yMax - yMin);
        const yBin = clamp(Math.floor((1 - yNorm) * yBins), 0, yBins - 1);
        const key = `${xBin}:${yBin}`;
        map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([key, count], idx) => {
        const [xBin, yBin] = key.split(':').map(Number);
        return {
            id: `cell_${idx}`,
            xBin,
            yBin,
            count
        };
    });
}

function getModePrice(dots) {
    const buckets = new Map();
    for (const dot of dots) {
        const bucket = Math.round(dot.price / 500) * 500;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    let bestPrice = 0;
    let bestCount = -1;
    buckets.forEach((count, price) => {
        if (count > bestCount) {
            bestPrice = Number(price);
            bestCount = count;
        }
    });
    return bestPrice || 0;
}

function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return Math.round(sorted[base] + rest * (sorted[base + 1] - sorted[base]));
    }
    return Math.round(sorted[base]);
}

function ratio(part, total) {
    if (!total) return 0;
    return Number((part / total).toFixed(4));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function parseISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return startOfDay(date);
}

function daysUntil(isoDate) {
    const date = parseISODate(isoDate);
    if (!date) return 0;
    const today = startOfDay(new Date());
    const diff = date.getTime() - today.getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000));
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
