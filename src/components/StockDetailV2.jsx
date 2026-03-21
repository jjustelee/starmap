import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DetailHeader from './DetailHeader';
import PredictionChartV2 from './PredictionChartV2';
import PredictionComposerV2 from './PredictionComposerV2';
import DistributionSummary from './DistributionSummary';
import MarketReality from './MarketReality';
import { useChartContext } from '../context/ChartContext';
import {
    loadCurrentPrice,
    loadPredictionSnapshot,
    submitPredictionDraft,
    validatePredictionDraft
} from '../services/predictionGatewayV2';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): predictions, prediction_aggregates, dashboard_distribution_history를 한 응답으로 조합.
 * - BACKEND_TODO(KIS): currentPrice/realityData는 KIS 원천 단일 소스로 주입하고 fallback을 줄인다.
 * - BACKEND_TODO(API): GET /api/v1/stocks/{symbol}/detail-v2(팩트+52주+합의), POST /api/v1/predictions로 수렴.
 */

/**
 * I/O Contract
 * props:
 * - stock: object
 * - onBack: () => void
 * - onRecord: (price: number) => void
 * - openComposerSignal?: number
 * - onComposerVisibilityChange?: (visible: boolean) => void
 */
const StockDetailV2 = ({ stock, onBack, onRecord, openComposerSignal = 0, onComposerVisibilityChange }) => {
    const { stockInfo, basePrice, dashboardData, realityData } = useChartContext();
    const symbol = stockInfo?.symbol || stock?.symbol || '000000';
    const initialPrice = Number(stockInfo?.currentPrice || basePrice || 0);
    const initialDate = useMemo(() => toISODate(addDays(new Date(), 90)), []);

    const [windowKey, setWindowKey] = useState('7d');
    const [currentPrice, setCurrentPrice] = useState(initialPrice);
    const [snapshot, setSnapshot] = useState(null);
    const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [draft, setDraft] = useState({
        symbol,
        targetPrice: initialPrice,
        targetDate: initialDate,
        window: '7d',
        source: 'slider',
        rangeLevel: 'L1'
    });

    useEffect(() => {
        let alive = true;
        (async () => {
            const price = await loadCurrentPrice(symbol, initialPrice);
            if (!alive) return;
            setCurrentPrice(price);
            setDraft((prev) => ({
                ...prev,
                symbol,
                targetPrice: Math.max(100, Math.round(price)),
                targetDate: prev.targetDate || initialDate,
                rangeLevel: prev.rangeLevel || 'L1'
            }));
        })();
        return () => {
            alive = false;
        };
    }, [symbol, initialPrice, initialDate]);

    const reloadSnapshot = useCallback(async () => {
        setIsLoadingSnapshot(true);
        const data = await loadPredictionSnapshot(symbol, windowKey, { currentPrice });
        setSnapshot(data);
        setIsLoadingSnapshot(false);
    }, [symbol, windowKey, currentPrice]);

    useEffect(() => {
        reloadSnapshot();
    }, [reloadSnapshot]);

    const handleDraftChange = useCallback((partial) => {
        setDraft((prev) => ({
            ...prev,
            ...partial,
            symbol,
            window: windowKey
        }));
        setErrorMessage('');
    }, [symbol, windowKey]);

    const handleSubmit = useCallback(async () => {
        const payload = {
            ...draft,
            symbol,
            window: windowKey
        };
        const result = validatePredictionDraft(payload);
        if (!result.ok) {
            setErrorMessage(result.reason || '입력한 예언값을 다시 확인해 주세요.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await submitPredictionDraft(payload);
            if (typeof onRecord === 'function') onRecord(Number(payload.targetPrice));
            await reloadSnapshot();
        } catch (error) {
            setErrorMessage(error?.message || '예언 박제에 실패했어요.');
        } finally {
            setIsSubmitting(false);
        }
    }, [draft, symbol, windowKey, onRecord, reloadSnapshot]);

    const mergedSnapshot = useMemo(() => {
        // BACKEND_TODO(API): snapshot.stats/overlay/currentPrice를 detail-v2 응답에서 1:1로 수신.
        // BACKEND_TODO(SUPABASE): distribution_history(low52/high52/current)는 dashboardData 대신 API payload 사용.
        // BACKEND_TODO(KIS): currentPrice는 서버 갱신 시각(updatedAt)과 함께 내려서 stale 판별.
        if (snapshot) return snapshot;
        const consensus = dashboardData?.distribution?.consensus;
        return {
            sampleSize: 0,
            stats: {
                avg: pickPositiveNumber(consensus?.avg),
                mode: pickPositiveNumber(consensus?.mode),
                q1: pickPositiveNumber(consensus?.min),
                q3: pickPositiveNumber(consensus?.max),
                bullishRatio: null,
                bearishRatio: null
            },
            overlay: {
                type: 'dot',
                dots: [],
                cells: [],
                xDomain: { min: 0, max: 1095 },
                yDomain: {
                    min: Math.round(currentPrice * 0.8),
                    max: Math.round(currentPrice * 1.2)
                }
            }
        };
    }, [snapshot, dashboardData, currentPrice]);

    return (
        <>
            <div
                className="fixed inset-0 z-[-1] pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at 20% 30%, rgba(34,211,238,0.05), transparent 60%), radial-gradient(circle at 80% 70%, rgba(244,63,94,0.05), transparent 60%)',
                    filter: 'blur(100px)'
                }}
            />

            <DetailHeader
                stock={stockInfo || stock}
                basePrice={currentPrice}
                priceChange={stockInfo?.price_change}
                priceChangeRate={stockInfo?.price_change_rate}
                quoteUpdatedAt={stockInfo?.quoteUpdatedAt}
                onBack={onBack}
            />

            <main className="w-full mt-6 relative z-40 pb-24 sm:pb-28">
                <div className="mx-auto max-w-2xl px-5 space-y-6 sm:space-y-8">
                    <TargetConsensusSummary
                        currentPrice={currentPrice}
                        stats={mergedSnapshot?.stats}
                        sampleSize={mergedSnapshot?.sampleSize}
                    />

                    <div className="rounded-[22px] border border-neon-pink/20 bg-white/[0.035] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.24)]">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-white">이 종목 예언</p>
                                <p className="mt-1 text-[12px] font-bold text-white/60">
                                    30초 예언
                                </p>
                            </div>
                            <p className="text-[12px] font-bold text-neon-pink shrink-0">적중 시 성지글</p>
                        </div>
                    </div>

                    <PredictionChartV2
                        snapshot={mergedSnapshot}
                        currentPrice={currentPrice}
                        targetPrice={draft.targetPrice}
                        targetDate={draft.targetDate}
                        selectedWindow={windowKey}
                        onWindowChange={setWindowKey}
                    />

                    <MarketReality kisData={realityData} />

                    <DistributionSummary
                        displayMode="rangeOnly"
                        history={{
                            low52: pickPositiveNumber(dashboardData?.distribution?.history?.low52),
                            high52: pickPositiveNumber(dashboardData?.distribution?.history?.high52),
                            current: pickPositiveNumber(dashboardData?.distribution?.history?.current)
                        }}
                    />
                </div>
            </main>

            <PredictionComposerV2
                currentPrice={currentPrice}
                draft={draft}
                communityHint={{
                    sampleSize: mergedSnapshot?.sampleSize || 0,
                    anchorPrice: pickPositiveNumber(mergedSnapshot?.stats?.mode, mergedSnapshot?.stats?.avg),
                    bullishRatio: mergedSnapshot?.stats?.bullishRatio
                }}
                onChange={handleDraftChange}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                forceOpenSignal={openComposerSignal}
                onVisibilityChange={onComposerVisibilityChange}
            />
        </>
    );
};

function TargetConsensusSummary({ currentPrice, stats, sampleSize }) {
    const anchorPrice = pickPositiveNumber(stats?.mode, stats?.avg);
    const hasCurrentPrice = Number(currentPrice) > 0;
    const hasAnchorPrice = Number(anchorPrice) > 0;
    const safeSampleSize = Number(sampleSize) || 0;
    const bullishRatio = Number(stats?.bullishRatio);
    const bullishText = Number.isFinite(bullishRatio) ? `${Math.round(bullishRatio * 100)}%` : '-';

    let headline = '첫 예언 전';
    let subline = '예언 0건';

    if (hasCurrentPrice && hasAnchorPrice) {
        const deltaPct = ((anchorPrice - currentPrice) / currentPrice) * 100;

        if (Math.abs(deltaPct) < 1) {
            headline = safeSampleSize >= 5
                ? '현재가 근처'
                : '현재가 근처';
        } else if (deltaPct >= 0) {
            headline = safeSampleSize >= 5
                ? '상향 우세'
                : '상향 시도';
        } else {
            headline = safeSampleSize >= 5
                ? '하향 우세'
                : '하향 시도';
        }

        subline = `예언 ${safeSampleSize}건`;
    } else if (safeSampleSize > 0) {
        headline = '목표가 집계 중';
        subline = `예언 ${safeSampleSize}건`;
    }

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <p className="text-[13px] font-bold text-white/60">종목 요약</p>
            <p className="mt-2 text-[22px] sm:text-[24px] font-extrabold leading-none text-white">{headline}</p>
            <p className="mt-2 text-[13px] sm:text-[14px] font-bold text-white/65">{subline}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                <SummaryMetric label="현재가" value={hasCurrentPrice ? formatSummaryWon(currentPrice) : '-'} tone="teal" />
                <SummaryMetric label="대표 목표가" value={hasAnchorPrice ? formatSummaryWon(anchorPrice) : '-'} tone="amber" />
                <SummaryMetric label="집중 구간" value={headline} tone="neutral" />
                <SummaryMetric label="상향" value={bullishText} tone="pink" />
                <SummaryMetric label="예언 수" value={`${safeSampleSize}건`} tone="neutral" />
            </div>
        </section>
    );
}

function SummaryMetric({ label, value, tone }) {
    const toneClass = tone === 'teal'
        ? 'border-neon-teal/20 bg-neon-teal/5'
        : tone === 'amber'
            ? 'border-amber-300/20 bg-amber-400/5'
            : tone === 'pink'
                ? 'border-neon-pink/20 bg-neon-pink/5'
                : 'border-white/10 bg-black/20';
    const valueClass = tone === 'teal'
        ? 'text-neon-teal'
        : tone === 'amber'
            ? 'text-amber-300'
            : tone === 'pink'
                ? 'text-neon-pink'
                : 'text-white';

    return (
        <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
            <p className="text-[11px] text-white/50 font-bold">{label}</p>
            <p className={`mt-1 text-[14px] font-bold leading-tight ${valueClass}`}>{value}</p>
        </div>
    );
}

function pickPositiveNumber(...values) {
    for (const value of values) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
}

function formatSummaryWon(value) {
    const num = Math.round(Number(value || 0));
    if (!Number.isFinite(num) || num <= 0) return '-';
    return `${num.toLocaleString()}원`;
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

export default StockDetailV2;
