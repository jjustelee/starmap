import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DetailHeader from './DetailHeader';
import PredictionChartV2 from './PredictionChartV2';
import PredictionComposerV2 from './PredictionComposerV2';
import DailyMarketPoll from './DailyMarketPoll';
import DistributionSummary from './DistributionSummary';
import MarketReality from './MarketReality';
import { useChartContext } from '../context/ChartContext';
import { useAuth } from '../context/AuthContext';
import { getMarketStatus } from '../utils/marketStatus';
import { fetchSacredPosts, readSacredPostsCache } from '../utils/mockData';
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
    const navigate = useNavigate();
    const { stockInfo, basePrice, dashboardData, realityData, refreshStockInfo, isDetailLoading } = useChartContext();
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
    const [hasPrimedSnapshot, setHasPrimedSnapshot] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showRestoreNotice, setShowRestoreNotice] = useState(false);
    const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
    const sacredBridgeCacheOptions = useMemo(() => ({ sort: 'recent' }), []);
    const [sacredBridgePosts, setSacredBridgePosts] = useState(() => {
        const cached = readSacredPostsCache('list', sacredBridgeCacheOptions);
        return Array.isArray(cached?.items) ? cached.items : [];
    });
    const [isLoadingSacredBridge, setIsLoadingSacredBridge] = useState(() => readSacredPostsCache('list', sacredBridgeCacheOptions) === null);
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
        setSnapshot(null);
        setIsLoadingSnapshot(true);
        setHasPrimedSnapshot(false);
        const timer = window.setTimeout(() => {
            setHasPrimedSnapshot(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [symbol]);

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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let timer = null;
        let cancelled = false;

        const schedule = (delay) => {
            timer = window.setTimeout(async () => {
                if (cancelled) return;
                await refreshStockInfo?.();
                if (cancelled) return;
                schedule(getMarketStatus().isOpen ? 60000 : 300000);
            }, delay);
        };

        const kick = () => {
            if (document.visibilityState !== 'visible') return;
            void refreshStockInfo?.();
        };

        schedule(getMarketStatus().isOpen ? 60000 : 300000);
        window.addEventListener('focus', kick);
        document.addEventListener('visibilitychange', kick);

        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            window.removeEventListener('focus', kick);
            document.removeEventListener('visibilitychange', kick);
        };
    }, [refreshStockInfo, symbol]);

    const reloadSnapshot = useCallback(async () => {
        if (!hasPrimedSnapshot) return;
        setIsLoadingSnapshot(true);
        const data = await loadPredictionSnapshot(symbol, windowKey, {
            stockId,
            currentPrice,
            currentUserId: userId
        });
        setSnapshot(data);
        setIsLoadingSnapshot(false);
    }, [hasPrimedSnapshot, symbol, windowKey, stockId, currentPrice, userId]);

    useEffect(() => {
        if (!hasPrimedSnapshot) return;
        reloadSnapshot();
    }, [hasPrimedSnapshot, reloadSnapshot]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const cached = readSacredPostsCache('list', sacredBridgeCacheOptions);
            if (cached !== null) {
                setSacredBridgePosts(Array.isArray(cached.items) ? cached.items : []);
                setIsLoadingSacredBridge(false);
            } else if (active) {
                setIsLoadingSacredBridge(true);
            }

            try {
                const result = await fetchSacredPosts('list', sacredBridgeCacheOptions);
                if (!active) return;
                setSacredBridgePosts(Array.isArray(result?.items) ? result.items : []);
            } catch (error) {
                if (!active) return;
                console.error('Failed to load sacred bridge posts:', error);
            } finally {
                if (active) {
                    setIsLoadingSacredBridge(false);
                }
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [sacredBridgeCacheOptions]);

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
        let didNavigate = false;
        try {
            await submitPredictionDraft(payload, {
                stockId,
                currentUserId: userId
            });
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(draftStorageKey);
            }
            if (typeof onRecord === 'function') {
                didNavigate = true;
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
        } catch (error) {
            setErrorMessage(error?.message || '예언 박제에 실패했어요.');
        } finally {
            if (!didNavigate) {
                setIsSubmitting(false);
            }
        }
    }, [draft, symbol, windowKey, onRecord, isLoggedIn, draftStorageKey, stockInfo, stock, currentPrice]);

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
        if (snapshot && Number(snapshot?.sampleSize || 0) > 0) return snapshot;
        const consensus = dashboardData?.distribution?.consensus;
        return {
            sampleSize: Number(snapshot?.sampleSize || 0),
            stats: {
                avg: pickPositiveNumber(snapshot?.stats?.avg, snapshot?.stats?.mode, consensus?.avg, consensus?.mode),
                mode: pickPositiveNumber(snapshot?.stats?.mode, snapshot?.stats?.avg, consensus?.mode, consensus?.avg),
                q1: pickPositiveNumber(snapshot?.stats?.q1, consensus?.min),
                q3: pickPositiveNumber(snapshot?.stats?.q3, consensus?.max),
                bullishRatio: Number.isFinite(Number(snapshot?.stats?.bullishRatio))
                    ? Number(snapshot?.stats?.bullishRatio)
                    : null,
                bearishRatio: Number.isFinite(Number(snapshot?.stats?.bearishRatio))
                    ? Number(snapshot?.stats?.bearishRatio)
                    : null
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

    const summaryHasMeaningfulData = Boolean(
        pickPositiveNumber(mergedSnapshot?.stats?.mode, mergedSnapshot?.stats?.avg, mergedSnapshot?.stats?.q1, mergedSnapshot?.stats?.q3) || Number(mergedSnapshot?.sampleSize || 0) > 0
    );

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
                quoteErrorCode={stockInfo?.quoteErrorCode}
                onBack={onBack}
            />

            <main className="w-full pt-[104px] sm:pt-[112px] relative z-40 pb-28">
                <div className="w-full space-y-7">
                    <TargetConsensusSummary
                        symbol={symbol}
                        currentPrice={currentPrice}
                        stats={mergedSnapshot?.stats}
                        sampleSize={mergedSnapshot?.sampleSize}
                        isLoading={isLoadingSnapshot || (isDetailLoading && !summaryHasMeaningfulData)}
                    />

                    <LatestPredictionFeed
                        snapshot={mergedSnapshot}
                        currentPrice={currentPrice}
                        stockName={stockInfo?.name || stock?.name || symbol}
                        isLoading={isLoadingSnapshot}
                    />

                    <DailyMarketPoll
                        stockId={stockId}
                        symbol={symbol}
                        currentPrice={currentPrice}
                        isLoggedIn={isLoggedIn}
                        userId={userId}
                        onLogin={signInWithKakao}
                    />

                    <TargetDirectionSummary
                        stats={mergedSnapshot?.stats}
                        sampleSize={mergedSnapshot?.sampleSize}
                        currentPrice={currentPrice}
                        isLoading={isLoadingSnapshot || (isDetailLoading && !summaryHasMeaningfulData)}
                    />

                    <TargetDistributionSummary
                        snapshot={mergedSnapshot}
                        currentPrice={currentPrice}
                        isLoading={isLoadingSnapshot}
                    />

                    <SacredBridgeSection
                        symbol={symbol}
                        posts={sacredBridgePosts}
                        isLoading={isLoadingSacredBridge}
                        onOpenArchive={() => navigate('/sacred')}
                        onOpenSacredPost={(post) => navigate(`/sacred/${post.id}`)}
                    />

                    <SupportInfoSection>
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
                    </SupportInfoSection>
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

function TargetConsensusSummary({ symbol, currentPrice, stats, sampleSize, isLoading = false }) {
    const anchorPrice = pickPositiveNumber(stats?.mode, stats?.avg);
    const hasCurrentPrice = Number(currentPrice) > 0;
    const hasAnchorPrice = Number(anchorPrice) > 0;
    const safeSampleSize = Number(sampleSize) || 0;
    const bullishRatio = Number(stats?.bullishRatio);
    const bullishText = Number.isFinite(bullishRatio) ? `${Math.round(bullishRatio * 100)}%` : '-';
    const focusBandText = formatConsensusBand(stats);
    const [visitNote, setVisitNote] = useState('');

    const summaryHasMeaningfulData = Boolean(
        hasAnchorPrice || safeSampleSize > 0 || focusBandText !== '-'
    );

    const summaryStorageKey = useMemo(() => `kokok.detail.summary:${symbol}`, [symbol]);
    const visitRef = useRef(null);

    const headline = (() => {
        if (hasCurrentPrice && hasAnchorPrice) {
            const deltaPct = ((anchorPrice - currentPrice) / currentPrice) * 100;

            if (Math.abs(deltaPct) < 1) {
                return '현재가 근처';
            }
            if (deltaPct >= 0) {
                return safeSampleSize >= 5 ? '상향 우세' : '상향 흐름';
            }
            return safeSampleSize >= 5 ? '하향 우세' : '하향 흐름';
        }

        if (hasAnchorPrice) {
            return '집중 구간 집계';
        }

        if (safeSampleSize > 0) {
            return '목표가 집계 중';
        }

        return '집계 준비 중';
    })();

    const subline = safeSampleSize > 0
        ? `예언 ${safeSampleSize}건`
        : (hasAnchorPrice ? '집중 구간을 모으는 중이에요' : '예언이 아직 쌓이는 중이에요');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!summaryHasMeaningfulData) {
            setVisitNote('');
            visitRef.current = null;
            return;
        }

        const current = {
            sampleSize: safeSampleSize,
            focusBandText,
            anchorPrice,
            currentPrice,
            savedAt: Date.now()
        };
        const previous = readSummaryVisitRecord(summaryStorageKey);
        visitRef.current = current;
        setVisitNote(buildSummaryVisitNote(previous, current));
    }, [anchorPrice, currentPrice, focusBandText, safeSampleSize, summaryHasMeaningfulData, summaryStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const persistSummaryVisit = () => {
            if (!visitRef.current) return;
            writeSummaryVisitRecord(summaryStorageKey, visitRef.current);
        };

        window.addEventListener('pagehide', persistSummaryVisit);
        return () => {
            persistSummaryVisit();
            window.removeEventListener('pagehide', persistSummaryVisit);
        };
    }, [summaryStorageKey]);

    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-20 rounded bg-white/10" />
                <div className="mt-4 h-7 w-36 rounded bg-white/10" />
                <div className="mt-2 h-4 w-28 rounded bg-white/10" />
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
                        <div className="h-3 w-12 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-20 rounded bg-white/10" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
                        <div className="h-3 w-16 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-20 rounded bg-white/10" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
                        <div className="h-3 w-16 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-20 rounded bg-white/10" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
                        <div className="h-3 w-10 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-12 rounded bg-white/10" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
                        <div className="h-3 w-12 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-16 rounded bg-white/10" />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">사람들이 보는 목표가</p>
            <div className="mt-2 flex items-start justify-between gap-3">
                <p className="min-w-0 text-[28px] font-extrabold leading-none text-[#F3F4F6] truncate">{headline}</p>
                {safeSampleSize > 0 ? (
                    <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                        예언 {safeSampleSize}건
                    </span>
                ) : null}
            </div>
            <p className="mt-2 text-[15px] font-bold text-[#D1D5DB] truncate">{subline}</p>
            {summaryHasMeaningfulData ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-[12px] font-bold text-[#D1D5DB]">
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-teal" />
                    {visitNote || '첫 방문'}
                </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 mt-4">
                <SummaryMetric label="현재가" value={hasCurrentPrice ? formatSummaryWon(currentPrice) : '-'} tone="teal" />
                <SummaryMetric label="대표 목표가" value={hasAnchorPrice ? formatSummaryWon(anchorPrice) : '-'} tone="amber" />
                <SummaryMetric label="집중 구간" value={focusBandText} tone="neutral" />
                <SummaryMetric label="상향" value={bullishText} tone="pink" />
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
                : 'border-white/10 bg-[#121212]/20';
    const valueClass = tone === 'teal'
        ? 'text-neon-teal'
        : tone === 'amber'
            ? 'text-amber-300'
            : tone === 'pink'
                ? 'text-neon-pink'
                : 'text-[#F3F4F6]';

    return (
        <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
            <p className="text-xs text-[#9CA3AF] font-bold">{label}</p>
            <p className={`mt-1 text-[17px] font-bold leading-tight ${valueClass}`}>{value}</p>
        </div>
    );
}

function LatestPredictionFeed({ snapshot, currentPrice, stockName, isLoading = false }) {
    const feedItems = useMemo(() => {
        const dots = Array.isArray(snapshot?.overlay?.dots) ? snapshot.overlay.dots : [];
        return buildLatestPredictionFeedItems(dots, currentPrice, stockName);
    }, [snapshot, currentPrice, stockName]);

    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-20 rounded bg-white/10" />
                <div className="mt-2 h-5 w-40 rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                    <PredictionFeedSkeletonCard />
                    <PredictionFeedSkeletonCard />
                    <PredictionFeedSkeletonCard />
                </div>
            </section>
        );
    }

    if (!feedItems.length) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
                <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">최신 예언 피드</p>
                <p className="mt-2 text-[18px] font-extrabold leading-none text-[#F3F4F6]">아직 예언이 없습니다</p>
                <p className="mt-2 text-[14px] font-bold text-[#9CA3AF]">예언이 쌓이면 최근 3건을 먼저 보여드려요.</p>
            </section>
        );
    }

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">최신 예언 피드</p>
                    <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">최근 3건만 먼저 보여드려요</p>
                </div>
                <p className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    방금부터
                </p>
            </div>

            <div className="mt-4 space-y-3">
                {feedItems.map((item) => (
                    <PredictionFeedCard key={item.id} item={item} />
                ))}
            </div>
        </section>
    );
}

function PredictionFeedCard({ item }) {
    const toneClass = 'border-white/10 bg-[#121212]/20';
    const targetToneClass = item.directionTone === 'teal'
        ? 'text-neon-blue'
        : item.directionTone === 'pink'
            ? 'text-neon-pink'
            : 'text-[#F3F4F6]';

    return (
        <article className={`rounded-[22px] border px-3 py-3 ${toneClass}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold text-[#F3F4F6]">{item.isMine ? '내 예언' : '익명'}</p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-[#D1D5DB]">{item.timeLabel}</span>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#D1D5DB]">
                    {item.horizonLabel}
                </span>
            </div>

            <p className={`mt-2 w-full text-[16px] font-semibold leading-snug ${targetToneClass}`}>{item.headlineLabel}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.distanceLabel ? <FeedChip label={item.distanceLabel} tone="neutral" /> : null}
                {item.targetLabel ? <FeedChip label={item.targetLabel} tone="neutral" /> : null}
                <span
                    className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border text-[15px] font-black ${
                        item.directionTone === 'pink'
                            ? 'border-neon-pink/20 bg-neon-pink/10 text-neon-pink'
                            : item.directionTone === 'teal'
                                ? 'border-neon-teal/20 bg-neon-teal/10 text-neon-teal'
                                : 'border-white/10 bg-white/5 text-[#D1D5DB]'
                    }`}
                    aria-hidden="true"
                >
                    {item.directionDelta > 0 ? '↑' : item.directionDelta < 0 ? '↓' : '→'}
                </span>
            </div>

        </article>
    );
}

function FeedChip({ label, tone = 'neutral' }) {
    const toneClass = tone === 'pink'
        ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/20'
        : tone === 'teal'
            ? 'bg-neon-teal/10 text-neon-teal border-neon-teal/20'
            : 'bg-white/5 text-[#D1D5DB] border-white/10';

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClass}`}>{label}</span>
    );
}

function PredictionFeedSkeletonCard() {
    return (
        <article className="rounded-[22px] border border-white/10 bg-[#121212]/20 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="h-3.5 w-24 rounded bg-white/10" />
                    <div className="mt-2 h-7 w-36 rounded bg-white/10" />
                </div>
                <div className="h-6 w-12 rounded-full bg-white/10" />
            </div>
            <div className="mt-3 flex gap-2">
                <div className="h-6 w-14 rounded-full bg-white/10" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
            <div className="mt-3 h-3.5 w-40 rounded bg-white/10" />
        </article>
    );
}

function TargetDirectionSummary({ stats, sampleSize, currentPrice, isLoading = false }) {
    const safeSampleSize = Number(sampleSize) || 0;
    const bullishRatio = Number(stats?.bullishRatio);
    const bearishRatio = Number(stats?.bearishRatio);
    const hasBullishRatio = Number.isFinite(bullishRatio);
    const hasBearishRatio = Number.isFinite(bearishRatio);
    const bullishText = hasBullishRatio ? `${Math.round(bullishRatio * 100)}%` : '-';
    const bearishText = hasBearishRatio ? `${Math.round(bearishRatio * 100)}%` : '-';
    const aggressivePrice = pickPositiveNumber(stats?.q3, stats?.mode, stats?.avg);
    const conservativePrice = pickPositiveNumber(stats?.q1, stats?.mode, stats?.avg);
    const aggressiveLabel = aggressivePrice ? `${formatCompactSummaryPrice(aggressivePrice)} 이상` : '-';
    const conservativeLabel = conservativePrice ? `${formatCompactSummaryPrice(conservativePrice)} 이하` : '-';
    const bullishCount = hasBullishRatio ? Math.round(bullishRatio * safeSampleSize) : null;
    const bearishCount = hasBearishRatio ? Math.round(bearishRatio * safeSampleSize) : null;
    const headline = (() => {
        if (safeSampleSize < 3) return '참고용';
        if (hasBullishRatio && bullishRatio >= 0.6) return '상향 우세';
        if (hasBearishRatio && bearishRatio >= 0.6) return '하향 우세';
        return '의견이 갈립니다';
    })();

    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-2 h-5 w-44 rounded bg-white/10" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/10 h-[92px]" />
                    <div className="rounded-2xl bg-white/10 h-[92px]" />
                    <div className="rounded-2xl bg-white/10 h-[92px]" />
                    <div className="rounded-2xl bg-white/10 h-[92px]" />
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">목표가 방향성</p>
            <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">사람들은 이 종목을 위로 더 보나요, 아래로 더 보나요?</p>
            <div className="mt-3 flex items-center justify-between gap-3">
                <p className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">{headline}</p>
                <p className="text-[12px] font-bold text-[#9CA3AF]">{safeSampleSize > 0 ? `예언 ${safeSampleSize}건` : '예언이 아직 적어요'}</p>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-[#121212]/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[12px] font-bold text-[#9CA3AF]">상향</p>
                        <p className="mt-1 text-[20px] font-extrabold text-neon-pink">{bullishText}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[12px] font-bold text-[#9CA3AF]">하향</p>
                        <p className="mt-1 text-[20px] font-extrabold text-neon-teal">{bearishText}</p>
                    </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                        className="h-full rounded-full bg-neon-pink transition-[width] duration-500"
                        style={{ width: `${Math.max(4, hasBullishRatio ? Math.round(bullishRatio * 100) : 50)}%` }}
                    />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[12px] font-bold">
                    <span className="text-[#D1D5DB]">상향파 {bullishCount !== null ? `${bullishCount}건` : '-'}</span>
                    <span className="text-[#D1D5DB]">하향파 {bearishCount !== null ? `${bearishCount}건` : '-'}</span>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <SummaryMetric label="가장 과감한 목표가" value={aggressiveLabel} tone="pink" />
                <SummaryMetric label="가장 보수적인 목표가" value={conservativeLabel} tone="teal" />
            </div>
        </section>
    );
}

function TargetDistributionSummary({ snapshot, currentPrice, isLoading = false }) {
    const dots = useMemo(() => {
        const rawDots = Array.isArray(snapshot?.overlay?.dots) ? snapshot.overlay.dots : [];
        return rawDots
            .map((dot, index) => ({
                id: String(dot?.id || `dot_${index}`),
                price: Math.round(Number(dot?.price || 0)),
                isMine: Boolean(dot?.isMine)
            }))
            .filter((dot) => Number.isFinite(dot.price) && dot.price > 0);
    }, [snapshot]);

    const sampleSize = Number(snapshot?.sampleSize || dots.length || 0);
    const mineCount = dots.filter((dot) => dot.isMine).length;
    const buckets = useMemo(() => buildTargetDistributionBuckets(dots, currentPrice), [dots, currentPrice]);
    const focusBandText = formatConsensusBand(snapshot?.stats);

    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-2 h-5 w-44 rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                    <div className="h-16 rounded-[20px] bg-white/10" />
                    <div className="h-16 rounded-[20px] bg-white/10" />
                    <div className="h-16 rounded-[20px] bg-white/10" />
                    <div className="h-16 rounded-[20px] bg-white/10" />
                </div>
            </section>
        );
    }

    if (!buckets.length) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
                <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">목표가 분포</p>
                <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">사람들이 많이 찍은 가격대</p>
                <p className="mt-2 text-[14px] font-bold text-[#9CA3AF]">예언이 쌓이면 가격대별 분포를 보여드려요.</p>
            </section>
        );
    }

    const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">목표가 분포</p>
                    <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">사람들이 많이 찍은 가격대</p>
                </div>
                <div className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    {sampleSize > 0 ? `예언 ${sampleSize}건` : '분포 준비 중'}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    {focusBandText !== '-' ? `집중 구간 ${focusBandText}` : '집중 구간 정리 중'}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    현재가 기준선
                </span>
                {mineCount > 0 ? (
                    <span className="rounded-full bg-neon-pink/10 px-3 py-1 text-[12px] font-bold text-neon-pink">
                        내 예언 {mineCount}건
                    </span>
                ) : null}
            </div>

            <div className="mt-4 space-y-2">
                {buckets.map((bucket) => {
                    const widthPct = Math.max(6, Math.round((bucket.count / maxCount) * 100));
                    const isCurrentInBucket = bucket.containsCurrent;
                    return (
                        <div
                            key={bucket.id}
                            className={`rounded-[20px] border px-3 py-3 ${
                                isCurrentInBucket ? 'border-neon-teal/30 bg-neon-teal/6' : 'border-white/10 bg-[#121212]/20'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold text-[#F3F4F6]">{bucket.label}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="text-[12px] font-bold text-[#9CA3AF]">
                                            {bucket.count}건
                                        </span>
                                        {bucket.hasMine ? (
                                            <span className="rounded-full bg-neon-pink/10 px-2 py-0.5 text-[11px] font-bold text-neon-pink">
                                                내 예언
                                            </span>
                                        ) : null}
                                        {isCurrentInBucket ? (
                                            <span className="rounded-full bg-neon-teal/10 px-2 py-0.5 text-[11px] font-bold text-neon-teal">
                                                현재가
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="shrink-0 text-[13px] font-extrabold text-[#F3F4F6]">{bucket.percent}%</p>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${
                                        isCurrentInBucket ? 'bg-neon-teal' : 'bg-neon-pink'
                                    }`}
                                    style={{ width: `${widthPct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function SacredBridgeSection({ symbol, posts, isLoading = false, onOpenArchive, onOpenSacredPost }) {
    const normalized = useMemo(() => {
        const list = Array.isArray(posts) ? posts : [];
        return list
            .filter((post) => post && post.id)
            .map((post) => ({
                ...post,
                targetPrice: Number(post.targetPrice || 0),
                totalReactionCount: Number(post.totalReactionCount || 0)
            }));
    }, [posts]);

    const sameStockPosts = useMemo(
        () => normalized.filter((post) => String(post.stockSymbol || '') === String(symbol || '')),
        [normalized, symbol]
    );

    const recentPosts = useMemo(() => {
        const source = sameStockPosts.length > 0 ? sameStockPosts : normalized;
        return [...source]
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 2);
    }, [normalized, sameStockPosts]);

    const hotPosts = useMemo(() => {
        return [...normalized]
            .sort((a, b) => {
                if (Number(b.totalReactionCount || 0) !== Number(a.totalReactionCount || 0)) {
                    return Number(b.totalReactionCount || 0) - Number(a.totalReactionCount || 0);
                }
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            })
            .slice(0, 2);
    }, [normalized]);

    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-2 h-5 w-44 rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                    <div className="h-20 rounded-[20px] bg-white/10" />
                    <div className="h-20 rounded-[20px] bg-white/10" />
                </div>
                <div className="mt-4 space-y-3">
                    <div className="h-20 rounded-[20px] bg-white/10" />
                    <div className="h-20 rounded-[20px] bg-white/10" />
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">성지글 연결</p>
                    <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">최근 적중 후보와 반응이 좋은 글</p>
                </div>
                <div className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    {sameStockPosts.length > 0 ? `이 종목 ${sameStockPosts.length}건` : '아직 이 종목 기록 없음'}
                </div>
            </div>

            <div className="mt-4 space-y-4">
                <div>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-bold text-[#D1D5DB]">최근 적중 후보</p>
                        <span className="text-[12px] font-bold text-[#9CA3AF]">
                            {sameStockPosts.length > 0 ? '이 종목 먼저 보기' : '전체 기록에서 먼저 보기'}
                        </span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                        {recentPosts.length > 0 ? recentPosts.map((post) => (
                            <SacredBridgeCard
                                key={post.id}
                                post={post}
                                symbol={symbol}
                                onClick={() => onOpenSacredPost?.(post)}
                                emphasizeCurrent={String(post.stockSymbol || '') === String(symbol || '')}
                            />
                        )) : (
                            <div className="rounded-[20px] border border-white/10 bg-[#121212]/20 px-3 py-4">
                                <p className="text-[14px] font-bold text-[#F3F4F6]">아직 이 종목의 성지글이 없습니다</p>
                                <p className="mt-1 text-[13px] font-bold text-[#9CA3AF]">적중이 나오면 먼저 연결해드려요.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-bold text-[#D1D5DB]">반응이 좋은 글</p>
                        <span className="text-[12px] font-bold text-[#9CA3AF]">아카이브에서 많이 본 기록</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                        {hotPosts.length > 0 ? hotPosts.map((post) => (
                            <SacredBridgeCard
                                key={`hot-${post.id}`}
                                post={post}
                                symbol={symbol}
                                onClick={() => onOpenSacredPost?.(post)}
                                emphasizeCurrent={String(post.stockSymbol || '') === String(symbol || '')}
                                showReaction
                            />
                        )) : (
                            <div className="rounded-[20px] border border-white/10 bg-[#121212]/20 px-3 py-4">
                                <p className="text-[14px] font-bold text-[#F3F4F6]">아직 반응이 쌓인 성지글이 없어요</p>
                                <p className="mt-1 text-[13px] font-bold text-[#9CA3AF]">적중 기록이 늘면 바로 보여드릴게요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button
                onClick={onOpenArchive}
                className="mt-4 inline-flex w-full items-center justify-center rounded-[20px] border border-neon-pink/20 bg-neon-pink/5 px-4 py-3 text-[14px] font-bold text-neon-pink transition hover:bg-neon-pink/10"
            >
                성지글 더보기 →
            </button>
        </section>
    );
}

function SacredBridgeCard({ post, symbol, onClick, emphasizeCurrent = false, showReaction = false }) {
    const toneClass = post.judgmentStatus === 'HIT_EXACT'
        ? 'border-neon-pink/20 bg-neon-pink/5'
        : 'border-neon-teal/20 bg-neon-teal/5';
    const chipToneClass = post.judgmentStatus === 'HIT_EXACT'
        ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/20'
        : 'bg-neon-teal/10 text-neon-teal border-neon-teal/20';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-[20px] border px-3 py-3 text-left transition hover:scale-[1.01] ${toneClass} ${emphasizeCurrent ? 'ring-1 ring-neon-pink/20' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-bold text-[#F3F4F6] truncate">{post.stockName}</p>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-[#D1D5DB]">
                            {String(post.stockSymbol || '') === String(symbol || '') ? '이 종목' : '다른 종목'}
                        </span>
                    </div>
                    <p className="mt-2 text-[22px] font-extrabold leading-none text-[#F3F4F6]">
                        {formatCompactSummaryPrice(post.targetPrice)}원 적중
                    </p>
                    <p className="mt-2 text-[12px] font-bold text-[#9CA3AF]">
                        {post.authorNickname} · {formatRelativeTimeLabel(post.createdAt)} · {formatSacredDate(post.hitDate)} 적중
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${chipToneClass}`}>
                        {post.judgmentLabel}
                    </p>
                    {showReaction ? (
                        <p className="mt-2 text-[12px] font-bold text-[#D1D5DB]">
                            반응 {Number(post.totalReactionCount || 0)}개
                        </p>
                    ) : (
                        <p className="mt-2 text-[12px] font-bold text-[#D1D5DB]">
                            성지 연결
                        </p>
                    )}
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <FeedChip label={post.judgmentStatus === 'HIT_EXACT' ? '정확 적중' : '근접 적중'} tone={post.judgmentStatus === 'HIT_EXACT' ? 'pink' : 'teal'} />
                {showReaction ? (
                    <FeedChip label={`반응 ${Number(post.totalReactionCount || 0)}개`} tone="neutral" />
                ) : null}
                <FeedChip label="성지글 보기" tone="neutral" />
            </div>
        </button>
    );
}

function SupportInfoSection({ children }) {
    return (
        <section className="space-y-4">
            <div className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">보조 정보</p>
                    <p className="mt-2 text-[18px] font-extrabold leading-tight text-[#F3F4F6]">
                        차트와 팩트로 흐름을 다시 확인해요
                    </p>
                </div>
                <div className="shrink-0 flex flex-wrap justify-end gap-2">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">차트</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">팩트체크</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">52주 맥락</span>
                </div>
            </div>

            <div className="space-y-4">
                {children}
            </div>
        </section>
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

function formatConsensusBand(stats) {
    const low = pickPositiveNumber(stats?.q1);
    const high = pickPositiveNumber(stats?.q3);
    const anchor = pickPositiveNumber(stats?.mode, stats?.avg);

    if (low && high && high > low) {
        return `${formatCompactSummaryPrice(low)}~${formatCompactSummaryPrice(high)}`;
    }

    if (anchor) {
        return formatCompactSummaryPrice(anchor);
    }

    if (low) {
        return formatCompactSummaryPrice(low);
    }

    if (high) {
        return formatCompactSummaryPrice(high);
    }

    return '-';
}

function formatCompactSummaryPrice(value) {
    const num = Math.round(Number(value || 0));
    if (!Number.isFinite(num) || num <= 0) return '-';
    if (num >= 10000) {
        const man = num / 10000;
        const text = Number.isInteger(man) ? String(man) : man.toFixed(1).replace(/\.0$/, '');
        return `${text}만`;
    }
    return `${num.toLocaleString()}원`;
}

function readSummaryVisitRecord(storageKey) {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeSummaryVisitRecord(storageKey, value) {
    if (typeof window === 'undefined' || !storageKey || !value) return;
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
        // best-effort
    }
}

function buildSummaryVisitNote(previous, current) {
    if (!previous) {
        return '첫 방문';
    }

    const prevSampleSize = Number(previous.sampleSize) || 0;
    const currentSampleSize = Number(current.sampleSize) || 0;
    const sampleDelta = currentSampleSize - prevSampleSize;
    if (sampleDelta > 0) {
        return `지난 방문 이후 +${sampleDelta}건`;
    }

    const prevBand = String(previous.focusBandText || '').trim();
    const currentBand = String(current.focusBandText || '').trim();
    if (prevBand && currentBand && prevBand !== currentBand) {
        return `집중 구간이 ${prevBand} → ${currentBand}`;
    }

    const prevAnchor = Number(previous.anchorPrice) || 0;
    const currentAnchor = Number(current.anchorPrice) || 0;
    if (prevAnchor > 0 && currentAnchor > 0 && prevAnchor !== currentAnchor) {
        return `대표 목표가가 ${formatCompactSummaryPrice(prevAnchor)} → ${formatCompactSummaryPrice(currentAnchor)}`;
    }

    return '지난 방문과 비슷해요';
}

function buildLatestPredictionFeedItems(dots, currentPrice, stockName = '') {
    const safeCurrentPrice = Number(currentPrice) || 0;
    const safeStockName = String(stockName || '').trim() || '이 종목';
    const sortedDots = [...(Array.isArray(dots) ? dots : [])]
        .filter((dot) => dot && Number(dot.price) > 0)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3);

    return sortedDots.map((dot) => {
        const price = Math.round(Number(dot.price) || 0);
        const targetLabel = formatCompactSummaryPrice(price);
        const xDays = Math.max(0, Math.round(Number(dot.xDays) || 0));
        const directionDelta = safeCurrentPrice > 0 ? ((price - safeCurrentPrice) / safeCurrentPrice) * 100 : 0;
        const directionTone = getPredictionDirectionTone(directionDelta);
        const distanceLabel = safeCurrentPrice > 0
            ? `현재가${formatCompactDelta(directionDelta)}`
            : '';
        const timeLabel = formatRelativeTimeLabel(dot.createdAt);
        const horizonLabel = xDays > 0 ? `D-${xDays}` : '당일';
        const horizonText = xDays > 0 ? `${xDays}일 후` : '오늘';
        const priceText = formatFeedPriceText(price);
        const headlineLabel = buildPredictionFeedHeadline({
            stockName: safeStockName,
            horizonText,
            priceText,
            directionDelta,
            isMine: Boolean(dot.isMine),
            seed: `${dot.id}|${dot.createdAt}|${price}|${xDays}|${safeStockName}`
        });
        const memoLabel = safeCurrentPrice > 0
            ? `현재가 ${directionDelta >= 0 ? '위' : '아래'}로 ${Math.abs(directionDelta).toFixed(1)}%`
            : '현재가 기준으로 정리 중';

        return {
            id: dot.id,
            isMine: Boolean(dot.isMine),
            timeLabel,
            headlineLabel,
            targetLabel,
            horizonLabel,
            directionTone,
            directionDelta,
            distanceLabel,
            memoLabel,
            tone: directionTone
        };
    });
}

function buildPredictionFeedHeadline({ stockName, horizonText, priceText, directionDelta, isMine, seed }) {
    const templates = directionDelta >= 0
        ? [
            '{stockName} {horizonText} {priceText} 볼 듯',
            '{stockName} {horizonText} {priceText}까지 간다',
            '{stockName} {horizonText} {priceText} 넘을 수 있음',
            '{stockName} {horizonText} {priceText} 찍어보자',
            '{stockName} {horizonText} {priceText} 도전',
            '{stockName} {horizonText} {priceText} 기대',
            '{stockName} {horizonText} {priceText} 회복 기대',
            '{stockName} {horizonText} {priceText} 직행 예상',
            '{stockName} {horizonText} {priceText} 한번 본다',
            '{stockName} {horizonText} {priceText} 터치 가능',
            '{stockName} {horizonText} {priceText} 재도전',
            '{stockName} {horizonText} {priceText} 보자'
        ]
        : directionDelta < 0
            ? [
                '{stockName} {horizonText} {priceText} 밀릴 듯',
                '{stockName} {horizonText} {priceText} 깨질 수도',
                '{stockName} {horizonText} {priceText} 아래로 본다',
                '{stockName} {horizonText} {priceText} 이탈 가능',
                '{stockName} {horizonText} {priceText} 조심',
                '{stockName} {horizonText} {priceText}까지 내려올 수도',
                '{stockName} {horizonText} {priceText} 흔들릴 듯',
                '{stockName} {horizonText} {priceText} 눌릴 수 있음',
                '{stockName} {horizonText} {priceText} 재하락 가능',
                '{stockName} {horizonText} {priceText} 한 번 더 체크',
                '{stockName} {horizonText} {priceText} 하방 경계',
                '{stockName} {horizonText} {priceText} 보수적으로 본다'
            ]
            : [
                '{stockName} {horizonText} {priceText} 근처',
                '{stockName} {horizonText} {priceText} 부근',
                '{stockName} {horizonText} {priceText} 전후',
                '{stockName} {horizonText} {priceText} 지켜봄',
                '{stockName} {horizonText} {priceText} 체크',
                '{stockName} {horizonText} {priceText} 관망',
                '{stockName} {horizonText} {priceText} 탐색',
                '{stockName} {horizonText} {priceText} 흐름 보는 중'
            ];

    const templateIndex = pickStableTemplateIndex(seed, templates.length);
    void isMine;
    return applyPredictionFeedTemplate(templates[templateIndex], {
        stockName,
        horizonText,
        priceText
    });
}

function applyPredictionFeedTemplate(template, values) {
    return String(template || '')
        .replaceAll('{author}', values.author)
        .replaceAll('{stockName}', values.stockName)
        .replaceAll('{horizonText}', values.horizonText)
        .replaceAll('{priceText}', values.priceText);
}

function pickStableTemplateIndex(seed, length) {
    if (!length) return 0;
    const text = String(seed || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash) % length;
}

function formatFeedPriceText(value) {
    const num = Math.round(Number(value || 0));
    if (!Number.isFinite(num) || num <= 0) return '-';
    if (num >= 10000) {
        const man = num / 10000;
        const text = Number.isInteger(man) ? String(man) : man.toFixed(1).replace(/\.0$/, '');
        return `${text}만원`;
    }
    return `${num.toLocaleString()}원`;
}

function buildTargetDistributionBuckets(dots, currentPrice) {
    if (!Array.isArray(dots) || !dots.length) return [];

    const prices = dots
        .map((dot) => Number(dot?.price || 0))
        .filter((price) => Number.isFinite(price) && price > 0)
        .sort((a, b) => a - b);
    const safeCurrentPrice = Number(currentPrice) || 0;

    if (!prices.length) return [];

    const min = prices[0];
    const max = prices[prices.length - 1];
    if (min === max) {
        return [{
            id: 'bucket_0',
            label: `${formatCompactSummaryPrice(min)}`,
            count: prices.length,
            percent: 100,
            containsCurrent: safeCurrentPrice > 0 && safeCurrentPrice >= min && safeCurrentPrice <= max,
            hasMine: dots.some((dot) => dot?.isMine)
        }];
    }

    const span = Math.max(1, max - min);
    const rawEdges = [
        min,
        min + span * 0.25,
        min + span * 0.5,
        min + span * 0.75,
        max
    ].map((value) => Math.round(value));
    const edges = ensureIncreasingEdges(rawEdges);
    const buckets = [];

    for (let index = 0; index < 4; index += 1) {
        const start = edges[index];
        const end = edges[index + 1];
        const upperBound = index === 3 ? end : end;
        const count = prices.filter((price) => {
            if (index === 3) {
                return price >= start && price <= upperBound;
            }
            return price >= start && price < upperBound;
        }).length;
        const hasMine = dots.some((dot) => {
            const price = Number(dot?.price || 0);
            if (!Number.isFinite(price) || price <= 0) return false;
            if (index === 3) {
                return dot.isMine && price >= start && price <= upperBound;
            }
            return dot.isMine && price >= start && price < upperBound;
        });
        const containsCurrent = safeCurrentPrice > 0 && (
            index === 3
                ? safeCurrentPrice >= start && safeCurrentPrice <= upperBound
                : safeCurrentPrice >= start && safeCurrentPrice < upperBound
        );
        buckets.push({
            id: `bucket_${index}`,
            label: formatDistributionRangeLabel(start, upperBound, index, edges.length - 2),
            count,
            percent: Math.max(1, Math.round((count / prices.length) * 100)),
            containsCurrent: false,
            hasMine
        });
    }

    return buckets;
}

function ensureIncreasingEdges(edges) {
    const safe = [...edges];
    for (let i = 1; i < safe.length; i += 1) {
        if (safe[i] <= safe[i - 1]) {
            safe[i] = safe[i - 1] + 1;
        }
    }
    return safe;
}

function formatDistributionRangeLabel(start, end, index, lastIndex) {
    const safeStart = Math.round(Number(start) || 0);
    const safeEnd = Math.round(Number(end) || 0);

    if (index === 0) {
        return `${formatCompactSummaryPrice(safeEnd)} 이하`;
    }
    if (index === lastIndex) {
        return `${formatCompactSummaryPrice(safeStart)} 이상`;
    }
    return `${formatCompactSummaryPrice(safeStart)}~${formatCompactSummaryPrice(safeEnd)}`;
}

function formatRelativeTimeLabel(value) {
    const time = new Date(String(value || '')).getTime();
    if (!Number.isFinite(time) || time <= 0) {
        return '1분 전';
    }

    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (minutes <= 1) return '1분 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.max(1, Math.floor(minutes / 60));
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.max(1, Math.floor(hours / 24));
    return `${days}일 전`;
}

function formatSacredDate(value) {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

function getPredictionDirectionTone(deltaPct) {
    if (!Number.isFinite(deltaPct)) return 'neutral';
    if (Math.abs(deltaPct) < 2) return 'neutral';
    return deltaPct > 0 ? 'pink' : 'teal';
}

function formatCompactDelta(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const rounded = Math.abs(num) < 0.05 ? 0 : Number(num.toFixed(1));
    const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
    return `${sign}${Math.abs(rounded).toFixed(1)}%`;
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
