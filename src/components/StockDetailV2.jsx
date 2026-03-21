import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DetailHeader from './DetailHeader';
import PredictionChartV2 from './PredictionChartV2';
import PredictionComposerV2 from './PredictionComposerV2';
import DistributionSummary from './DistributionSummary';
import MarketReality from './MarketReality';
import { useChartContext } from '../context/ChartContext';
import { useAuth } from '../context/AuthContext';
import {
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
 * - onRecord: ({ targetPrice: number, stock: object }) => void
 * - openComposerSignal?: number
 * - onComposerVisibilityChange?: (visible: boolean) => void
 */
const StockDetailV2 = ({ stock, onBack, onRecord, openComposerSignal = 0, onComposerVisibilityChange }) => {
    const { stockInfo, basePrice, dashboardData, realityData } = useChartContext();
    const { isLoggedIn, signInWithKakao, userId } = useAuth();
    const symbol = stockInfo?.symbol || stock?.symbol || '000000';
    const stockId = stockInfo?.id || stock?.id || null;
    const initialPrice = Number(stockInfo?.currentPrice || basePrice || 0);
    const initialDate = useMemo(() => toISODate(addDays(new Date(), 90)), []);
    const draftStorageKey = `prediction-draft:${symbol}`;
    const draftTtlMs = 1000 * 60 * 60 * 6;

    const [windowKey, setWindowKey] = useState('7d');
    const [currentPrice, setCurrentPrice] = useState(initialPrice);
    const [snapshot, setSnapshot] = useState(null);
    const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showRestoreNotice, setShowRestoreNotice] = useState(false);
    const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
    const [draft, setDraft] = useState({
        symbol,
        targetPrice: initialPrice,
        targetDate: initialDate,
        window: '7d',
        source: 'slider',
        rangeLevel: 'L1'
    });
    const [restoreComposerSignal, setRestoreComposerSignal] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(draftStorageKey);
            if (!raw) {
                setHasHydratedDraft(true);
                return;
            }
            const saved = JSON.parse(raw);
            if (!saved?.savedAt || Date.now() - Number(saved.savedAt) > draftTtlMs) {
                window.localStorage.removeItem(draftStorageKey);
                setHasHydratedDraft(true);
                return;
            }
            setDraft((prev) => ({
                ...prev,
                symbol,
                targetPrice: Number(saved.targetPrice) > 0 ? Number(saved.targetPrice) : prev.targetPrice,
                targetDate: saved.targetDate || prev.targetDate,
                source: saved.source || prev.source,
                rangeLevel: saved.rangeLevel || prev.rangeLevel
            }));
            if (saved.resumeComposer) {
                setShowRestoreNotice(true);
                setRestoreComposerSignal((prev) => prev + 1);
                window.localStorage.setItem(draftStorageKey, JSON.stringify({
                    ...saved,
                    resumeComposer: false
                }));
            }
        } catch (error) {
            console.warn('Failed to restore prediction draft:', error);
        } finally {
            setHasHydratedDraft(true);
        }
    }, [draftStorageKey, symbol, draftTtlMs]);

    useEffect(() => {
        const price = Math.max(0, Math.round(Number(stockInfo?.currentPrice || basePrice || 0)));
        if (!price) return;
        setCurrentPrice(price);
        setDraft((prev) => ({
            ...prev,
            symbol,
            targetPrice: prev.symbol === symbol && Number(prev.targetPrice) > 0
                ? prev.targetPrice
                : Math.max(100, price),
            targetDate: prev.targetDate || initialDate,
            rangeLevel: prev.rangeLevel || 'L1'
        }));
    }, [stockInfo?.currentPrice, basePrice, symbol, initialDate]);

    const reloadSnapshot = useCallback(async () => {
        setIsLoadingSnapshot(true);
        const data = await loadPredictionSnapshot(symbol, windowKey, {
            stockId,
            currentPrice,
            currentUserId: userId
        });
        setSnapshot(data);
        setIsLoadingSnapshot(false);
    }, [symbol, windowKey, stockId, currentPrice, userId]);

    useEffect(() => {
        reloadSnapshot();
    }, [reloadSnapshot]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!hasHydratedDraft) return;
        try {
            window.localStorage.setItem(draftStorageKey, JSON.stringify({
                targetPrice: draft?.targetPrice,
                targetDate: draft?.targetDate,
                source: draft?.source,
                rangeLevel: draft?.rangeLevel,
                savedAt: Date.now(),
                resumeComposer: false
            }));
        } catch (error) {
            console.warn('Failed to persist prediction draft:', error);
        }
    }, [draft?.rangeLevel, draft?.source, draft?.targetDate, draft?.targetPrice, draftStorageKey, hasHydratedDraft]);

    const handleDraftChange = useCallback((partial) => {
        setDraft((prev) => ({
            ...prev,
            ...partial,
            symbol,
            window: windowKey
        }));
        setShowRestoreNotice(false);
        setErrorMessage('');
    }, [symbol, windowKey]);

    const handleSubmit = useCallback(async () => {
        if (!isLoggedIn) {
            return;
        }

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
        setShowRestoreNotice(false);
        try {
            await submitPredictionDraft(payload);
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(draftStorageKey);
            }
            if (typeof onRecord === 'function') {
                onRecord({
                    targetPrice: Number(payload.targetPrice),
                    stock: {
                        symbol,
                        name: stockInfo?.name || stock?.name || symbol,
                        currentPrice: Number(currentPrice) || 0,
                        quoteStatusLabel: stockInfo?.quoteStatusLabel || stock?.quoteStatusLabel || '최근값',
                        priceChange: Number(stockInfo?.price_change || stock?.priceChange || 0),
                        priceChangeRate: Number(stockInfo?.price_change_rate || stock?.priceChangeRate || 0)
                    }
                });
            }
            await reloadSnapshot();
        } catch (error) {
            setErrorMessage(error?.message || '예언 박제에 실패했어요.');
        } finally {
            setIsSubmitting(false);
        }
    }, [draft, symbol, windowKey, onRecord, reloadSnapshot, isLoggedIn, draftStorageKey, stockInfo, stock, currentPrice]);

    const handleRequireLogin = useCallback(async () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(draftStorageKey, JSON.stringify({
                targetPrice: draft?.targetPrice,
                targetDate: draft?.targetDate,
                source: draft?.source,
                rangeLevel: draft?.rangeLevel,
                savedAt: Date.now(),
                resumeComposer: true
            }));
        }
        await signInWithKakao?.();
    }, [draft?.rangeLevel, draft?.source, draft?.targetDate, draft?.targetPrice, draftStorageKey, signInWithKakao]);

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
                        selectedWindow={windowKey}
                        onWindowChange={setWindowKey}
                        isLoading={isLoadingSnapshot}
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
                isLoggedIn={isLoggedIn}
                communityHint={{
                    sampleSize: mergedSnapshot?.sampleSize || 0,
                    anchorPrice: pickPositiveNumber(mergedSnapshot?.stats?.mode, mergedSnapshot?.stats?.avg),
                    bullishRatio: mergedSnapshot?.stats?.bullishRatio
                }}
                onChange={handleDraftChange}
                onSubmit={handleSubmit}
                onRequireLogin={handleRequireLogin}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
                isRestoredDraft={showRestoreNotice}
                forceOpenSignal={openComposerSignal + restoreComposerSignal}
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
