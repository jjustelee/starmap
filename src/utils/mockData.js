import { supabase } from './supabaseClient';

/**
 * [백엔드] 공개 현재가 API 호출 (price 전용)
 * @param {string} symbol
 */
export const callQuotePublic = async (symbol) => {
    const { data, error } = await supabase.functions.invoke('quote-public', {
        body: { symbol }
    });
    if (error) {
        console.error('Error calling quote-public:', error);
        return null;
    }
    return data;
};

/**
 * [백엔드] 상세 묶음 API 호출 (history/predictions/reality/dashboard)
 * @param {string} symbol
 */
export const callStockDetailPublic = async (symbol) => {
    const { data, error } = await supabase.functions.invoke('stock-detail-public', {
        body: { symbol }
    });
    if (error) {
        console.error('Error calling stock-detail-public:', error);
        return null;
    }
    return data;
};

/**
 * [백엔드] 성지글 읽기 API 호출
 * @param {"home"|"list"|"detail"} mode
 * @param {{ sort?: "recent"|"accuracy", id?: string }} options
 */
export const fetchSacredPosts = async (mode, options = {}) => {
    const { data, error } = await supabase.functions.invoke('sacred-posts-public', {
        body: {
            mode,
            sort: options.sort,
            id: options.id
        }
    });
    if (error) {
        console.error('Error calling sacred-posts-public:', error);
        return mode === 'detail' ? { item: null } : { items: [] };
    }
    return data || (mode === 'detail' ? { item: null } : { items: [] });
};

/**
 * [백엔드] 홈 커뮤니티 피드 읽기 API 호출
 * recentPredictions: 최근 7일 박제 기록
 * hotStocks: 최근 7일 기준 많이 박제된 종목
 */
export const fetchCommunityHomeFeed = async () => {
    const { data, error } = await supabase.functions.invoke('community-home-public');
    if (error) {
        console.error('Error calling community-home-public:', error);
        return { recentPredictions: [], hotStocks: [] };
    }
    return {
        recentPredictions: Array.isArray(data?.recentPredictions) ? data.recentPredictions : [],
        hotStocks: Array.isArray(data?.hotStocks) ? data.hotStocks : []
    };
};

// [참고] 전 종목 검색은 searchEngine.js의 로컬 필터링으로 대체됨
// stock_master 테이블 데이터를 앱 시작 시 캐싱하여 메모리 내 즉시 검색


/**
 * Fetch stock information from Supabase
 * [백엔드] DB의 기본 정보와 KIS의 실시간 시세를 결합
 * DB에 price=0인 새 종목도 KIS API로 가격을 채워서 반환
 */
export const fetchStockInfo = async (symbol) => {
    // 1. DB에서 기본 정보(이름 등) 가져오기
    let { data: dbData, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('symbol', symbol)
        .maybeSingle();
    
    if (error) {
        console.error('Error fetching stock from DB:', error);
        return null;
    }

    // [백엔드] 만약 stocks 테이블에 아직 없는 종목(검색 결과 등)일 경우, stock_master에서 보완
    if (!dbData) {
        console.log(`[fetchStockInfo] ${symbol} not found in stocks, checking stock_master...`);
        const { data: masterData } = await supabase
            .from('stock_master')
            .select('name, market_type, std_price')
            .eq('code', symbol)
            .maybeSingle();

        if (masterData) {
            // 임시 객체 생성 (가격은 quote-public에서 처리)
            dbData = {
                symbol: symbol,
                name: masterData.name,
                market_type: masterData.market_type,
                base_price: Number(masterData.std_price || 0),
                current_price: null
            };
        } else {
            // stock_master에도 없으면 진짜 없는 종목
            return null;
        }
    }

    // 2. quote-public에서 현재가 조회 (SWR/TTL/부하제어는 서버에서 처리)
    const quote = await callQuotePublic(symbol);
    const quotePrice = Number(quote?.currentPrice || 0);
    const fallbackPrice = Number(dbData.current_price || 0);
    const resolvedPrice = quotePrice > 0 ? quotePrice : (fallbackPrice > 0 ? fallbackPrice : null);
    const quoteStatus = quote?.status || (resolvedPrice ? 'cached' : 'unavailable');
    const quoteLabel = quoteStatus === 'live'
        ? '실시간'
        : (quoteStatus === 'cached' ? '최근값' : (quoteStatus === 'syncing' ? '갱신중' : '갱신중'));

    return {
        ...dbData,
        currentPrice: resolvedPrice,
        price_change: Number(quote?.priceChange ?? dbData.price_change ?? 0),
        price_change_rate: Number(quote?.priceChangeRate ?? dbData.price_change_rate ?? 0),
        high: Number(quote?.priceHigh ?? dbData.price_high ?? 0),
        low: Number(quote?.priceLow ?? dbData.price_low ?? 0),
        quoteStatus,
        quoteStatusLabel: quoteLabel,
        quoteUpdatedAt: quote?.updatedAt || dbData.updated_at || null,
        isStale: Boolean(quote?.isStale ?? quoteStatus !== 'live')
    };
};

const toFiniteNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const toPositiveNumber = (value) => {
    const n = toFiniteNumber(value);
    return n !== null && n > 0 ? n : null;
};

const normalizeDetailRealityData = (stock, reality) => {
    const base = reality || {
        symbol: stock.symbol,
        per: null,
        pbr: null,
        ind_area_per: null,
        beta: null,
        supply_5d: null,
        op_margin: null,
        debt_ratio: null,
        status: 'unavailable',
        source: 'detail_bundle_fallback',
        updatedAt: null,
        isStale: true,
        errorCode: 'REALITY_EMPTY'
    };

    return {
        ...base,
        currentPrice: toPositiveNumber(stock?.currentPrice ?? reality?.currentPrice),
        priceChangeRate: toFiniteNumber(stock?.price_change_rate ?? reality?.priceChangeRate),
        priceHigh: toPositiveNumber(stock?.high ?? reality?.priceHigh),
        priceLow: toPositiveNumber(stock?.low ?? reality?.priceLow),
        updatedAt: base.updatedAt || stock?.quoteUpdatedAt || null
    };
};

/**
 * Fetch stock detail bundle
 * [백엔드] 상세 페이지가 소비하는 stock/history/predictions/reality/dashboard를 한 경계로 묶습니다.
 * BACKEND_TODO(API): GET /api/v1/stocks/{symbol}/detail 로 대체될 프론트 조합 경계입니다.
 */
export const fetchStockDetailBundle = async (symbol) => {
    const stock = await fetchStockInfo(symbol);
    if (!stock) {
        return {
            stock: null,
            historyData: [],
            starsData: [],
            realityData: null,
            dashboardData: null
        };
    }

    const bundled = await callStockDetailPublic(stock.symbol);
    if (bundled && typeof bundled === 'object') {
        return {
            stock,
            historyData: Array.isArray(bundled.historyData) ? bundled.historyData : [],
            starsData: Array.isArray(bundled.starsData) ? bundled.starsData : [],
            realityData: normalizeDetailRealityData(stock, bundled.realityData),
            dashboardData: bundled.dashboardData || null
        };
    }

    return {
        stock,
        historyData: [],
        starsData: [],
        realityData: normalizeDetailRealityData(stock, null),
        dashboardData: null
    };
};

/**
 * Submit a new prediction to Supabase
 * [백엔드] 로그인 유저 기준으로 박제합니다. user_id는 DB default(auth.uid())로 주입됩니다.
 */
export const submitPrediction = async (stockId, priceTarget, xFutureRatio, opacity, userId = null, targetDate = toISODate(addDays(new Date(), 90))) => {
    // 호출부 시그니처 호환을 위해 userId 파라미터는 유지하되, 저장은 DB 기본값(auth.uid())을 사용합니다.
    void userId;
    if (!isISODateString(targetDate)) {
        throw new Error('예언 만기일은 날짜 형식으로만 저장할 수 있어요.');
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) {
        throw new Error('로그인 세션이 만료되었어요. 다시 로그인 후 시도해 주세요.');
    }

    const { data, error } = await supabase
        .from('predictions')
        .insert([{
            stock_id: stockId,
            price_target: priceTarget,
            x_future_ratio: xFutureRatio,
            opacity: opacity,
            target_date: targetDate
        }]);

    if (error) {
        console.error('Error submitting prediction:', error);
        throw error;
    }
    return data;
};

/**
 * Fetch predictions for a specific user (My Page)
 * [백엔드] user_id로 필터링하여 내 기록만 조회. stocks JOIN으로 종목명도 반환.
 */
export const fetchMyPredictions = async (userId) => {
    const mapRpcRows = (rows = []) => rows.map((row) => {
        const priceTarget = Number(row.price_target);
        const currentPrice = row.stock_current_price == null ? null : Number(row.stock_current_price);
        const quoteStatusLabel = Number.isFinite(currentPrice) && currentPrice > 0 ? '최근값' : '갱신중';
        const judgmentStatus = String(row.judgment_status || 'PENDING');
        const judgmentLabel = String(row.judgment_label || '진행중');
        const deviation = row.deviation_pct == null ? null : Number(row.deviation_pct);
        return {
            id: row.id,
            price_target: Number.isFinite(priceTarget) ? priceTarget : 0,
            target_date: row.target_date,
            created_at: row.created_at,
            stockName: row.stock_name || '알 수 없음',
            stockSymbol: row.stock_symbol,
            currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
            quoteStatusLabel,
            judgmentStatus,
            judgmentLabel,
            isHit: judgmentStatus === 'HIT_EXACT' || judgmentStatus === 'HIT_NEAR',
            isMissed: judgmentStatus === 'MISSED',
            deviationPct: Number.isFinite(deviation) ? deviation : null,
            stock: row.stock_id ? {
                id: row.stock_id,
                name: row.stock_name || '알 수 없음',
                symbol: row.stock_symbol,
                currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
                quoteStatusLabel
            } : null
        };
    });

    const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_my_predictions_with_judgment');

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return mapRpcRows(rpcData);
    }
    if (rpcError) {
        console.warn('get_my_predictions_with_judgment RPC failed, falling back to legacy query:', rpcError.message);
    }

    const { data, error } = await supabase
        .from('predictions')
        .select(`
            id,
            price_target,
            x_future_ratio,
            target_date,
            created_at,
            stock_id,
            stocks ( id, name, symbol, base_price, current_price )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching my predictions:', error);
        return [];
    }

    const parseYmd = (value) => {
        if (typeof value !== 'string') return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const dt = new Date(`${value}T00:00:00`);
        return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getJudgment = ({ currentPrice, targetPrice, targetDate }) => {
        const current = Number(currentPrice);
        const target = Number(targetPrice);
        const targetDt = parseYmd(targetDate);
        const isJudgeableDate = targetDt ? today >= targetDt : false;

        if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
            return { code: 'PENDING', label: '진행중', isHit: false, isMissed: false, deviationPct: null };
        }

        if (!isJudgeableDate) {
            return { code: 'PENDING', label: '진행중', isHit: false, isMissed: false, deviationPct: null };
        }

        const deviationPct = Math.abs(current - target) / target * 100;

        if (deviationPct <= 1) {
            return { code: 'HIT_EXACT', label: '적중 완료', isHit: true, isMissed: false, deviationPct };
        }
        if (deviationPct <= 3) {
            return { code: 'HIT_NEAR', label: '근접 적중', isHit: true, isMissed: false, deviationPct };
        }
        if (deviationPct <= 5) {
            return { code: 'CLOSE_CALL', label: '아슬아슬', isHit: false, isMissed: false, deviationPct };
        }
        return { code: 'MISSED', label: '빗나감', isHit: false, isMissed: true, deviationPct };
    };

    return data.map(item => ({
        ...(() => {
            const judged = getJudgment({
                currentPrice: item.stocks?.current_price,
                targetPrice: item.price_target,
                targetDate: item.target_date
            });
            return {
                judgmentStatus: judged.code,
                judgmentLabel: judged.label,
                isHit: judged.isHit,
                isMissed: judged.isMissed,
                deviationPct: judged.deviationPct
            };
        })(),
        id: item.id,
        price_target: item.price_target,
        target_date: item.target_date,
        created_at: item.created_at,
        stockName: item.stocks?.name || '알 수 없음',
        stockSymbol: item.stocks?.symbol,
        currentPrice: item.stocks?.current_price ? Number(item.stocks.current_price) : 0,
        quoteStatusLabel: item.stocks?.current_price ? '최근값' : '갱신중',
        stock: item.stocks ? {
            id: item.stocks.id,
            name: item.stocks.name,
            symbol: item.stocks.symbol,
            currentPrice: item.stocks.current_price ? Number(item.stocks.current_price) : 0,
            quoteStatusLabel: item.stocks.current_price ? '최근값' : '갱신중'
        } : null
    }));
};

/**
 * Delete a specific prediction from Supabase
 * [백엔드] 전역 반영: DB에서 삭제하므로 차트 등 모든 곳에서 즉시 사라집니다.
 */
export const deletePrediction = async (predictionId) => {
    const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', predictionId);

    if (error) {
        console.error('Error deleting prediction:', error);
        throw error;
    }
    return true;
};

function isISODateString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
