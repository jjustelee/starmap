import React, { useMemo } from 'react';

const WINDOWS = ['24h', '7d', '30d', 'all'];
const WINDOW_LABELS = {
    '24h': '오늘',
    '7d': '1주',
    '30d': '1달',
    all: '전체'
};
const WINDOW_MS = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    all: 0
};

const PredictionChartV2 = ({
    snapshot,
    currentPrice,
    selectedWindow = '7d',
    onWindowChange,
    isLoading = false
}) => {
    const snapshotWindow = snapshot?.window || selectedWindow;
    const isWindowSyncing = isLoading && snapshotWindow !== selectedWindow;
    const dots = useMemo(
        () => buildDots(snapshot?.overlay?.dots || []),
        [snapshot]
    );

    const chart = useMemo(
        () => buildPointChart({
            dots,
            currentPrice,
            windowKey: snapshotWindow
        }),
        [dots, currentPrice, snapshotWindow]
    );

    return (
        <section className="bg-white/[0.06] backdrop-blur-2xl rounded-[28px] p-5 border border-white/10 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.5)] relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 right-0 w-28 h-28 bg-neon-pink/5 blur-[55px] rounded-full pointer-events-none" />
            <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-neon-pink text-3xl">monitoring</span>
                    <h3 className="text-[20px] font-bold text-[#F3F4F6] tracking-tight leading-none font-brandKo">사람들 예언 흐름</h3>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {WINDOWS.map((window) => {
                        const active = selectedWindow === window;
                        const pending = isWindowSyncing && snapshotWindow !== window && selectedWindow === window;
                        return (
                            <button
                                key={window}
                                type="button"
                                onClick={() => onWindowChange?.(window)}
                                className={`min-h-10 rounded-xl border text-[15px] font-bold transition ${
                                    active
                                        ? 'bg-white/12 text-[#F3F4F6] border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.08)]'
                                        : 'bg-white/5 text-[#D1D5DB] border-white/10'
                                }`}
                            >
                                {WINDOW_LABELS[window]}{pending ? '…' : ''}
                            </button>
                        );
                    })}
                </div>

                <div className="rounded-[20px] border border-white/10 bg-[#08080c] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#F3F4F6]">예언 점</p>
                        <p className="text-xs text-[#9CA3AF] font-medium text-right truncate">
                            예언 {chart.sampleCount}건{chart.myCount > 0 ? ` · 내 ${chart.myCount}건` : ''}
                        </p>
                    </div>

                    {isWindowSyncing ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[15px] text-[#9CA3AF] font-medium">
                            {WINDOW_LABELS[selectedWindow]} 예언 불러오는 중
                        </div>
                    ) : null}

                    {(chart.outlierTopCount > 0 || chart.outlierBottomCount > 0) ? (
                        <p className="text-xs text-[#9CA3AF] font-medium">
                            {chart.outlierTopCount > 0 ? `상단 밖 ${chart.outlierTopCount}건` : ''}
                            {chart.outlierTopCount > 0 && chart.outlierBottomCount > 0 ? ' · ' : ''}
                            {chart.outlierBottomCount > 0 ? `하단 밖 ${chart.outlierBottomCount}건` : ''}
                        </p>
                    ) : null}

                    {chart.points.length ? (
                        <>
                            <div className="relative rounded-[20px] border border-white/10 bg-[#121212]/25 overflow-hidden px-3 py-4 h-[280px]">
                                <div className="absolute inset-x-3 top-4 bottom-10 pointer-events-none">
                                    {[0, 25, 50, 75, 100].map((pct) => (
                                        <div
                                            key={pct}
                                            className="absolute inset-x-0 border-t border-white/5"
                                            style={{ top: `${pct}%` }}
                                        />
                                    ))}
                                </div>

                                <div
                                    className="absolute inset-x-3 border-t border-neon-teal/60 border-dashed z-10 pointer-events-none"
                                    style={{ top: `calc(${chart.currentLinePct}% + 1rem)` }}
                                />
                                <span
                                    className="absolute left-3 -translate-y-[calc(100%+6px)] px-2 py-1 rounded-full text-xs font-bold text-neon-teal border border-neon-teal/25 bg-[#121212]/72 z-20 whitespace-nowrap"
                                    style={{ top: `calc(${chart.currentLinePct}% + 1rem)` }}
                                >
                                    현재가 {formatWon(currentPrice)}
                                </span>

                                <div className="absolute inset-x-3 top-4 bottom-10">
                                    {chart.points.map((point) => (
                                        <span
                                            key={point.id}
                                            className="absolute rounded-full"
                                            style={{
                                                left: `calc(${point.xPct}% - ${point.size / 2}px)`,
                                                top: `calc(${point.yPct}% - ${point.size / 2}px)`,
                                                width: `${point.size}px`,
                                                height: `${point.size}px`,
                                                background: point.color,
                                                boxShadow: point.shadow
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="absolute inset-x-3 bottom-3 grid grid-cols-5 text-xs text-[#9CA3AF] font-medium">
                                    {chart.xLabels.map((label, index) => (
                                        <span
                                            key={`${label}_${index}`}
                                            className={index === 0 ? 'text-left' : index === chart.xLabels.length - 1 ? 'text-right' : 'text-center'}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[20px] border border-white/10 bg-[#121212]/20 px-4 py-3">
                                <div className="grid grid-cols-3 gap-3 text-left">
                                    <MiniLegend label="최저" value={formatWon(chart.minPrice)} tone="blue" />
                                    <MiniLegend label="평균" value={formatWon(chart.avgPrice)} tone="white" />
                                    <MiniLegend label="최고" value={formatWon(chart.maxPrice)} tone="pink" />
                                </div>
                            </div>
                        </>
                    ) : isWindowSyncing ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-[15px] text-[#9CA3AF] font-medium">
                            {WINDOW_LABELS[selectedWindow]} 예언 불러오는 중
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-[15px] text-[#9CA3AF] font-medium">
                            아직 예언 점이 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

function MiniLegend({ label, value, tone }) {
    const valueClass = tone === 'blue'
        ? 'text-neon-blue'
        : tone === 'pink'
            ? 'text-neon-pink'
            : 'text-[#F3F4F6]';

    return (
        <div className="rounded-2xl border border-white/10 bg-[#121212]/20 px-3 py-3">
            <p className="text-xs text-[#9CA3AF] font-bold whitespace-nowrap leading-none">{label}</p>
            <p className={`mt-1 text-sm font-bold ${valueClass}`}>{value}</p>
        </div>
    );
}

function buildDots(rawDots) {
    return rawDots
        .map((dot, index) => {
            const price = Number(dot?.price || 0);
            const createdAt = String(dot?.createdAt || '');
            const createdAtMs = Date.parse(createdAt);
            if (!Number.isFinite(price) || price <= 0) return null;
            return {
                id: String(dot?.id || `dot_${index}`),
                price: Math.round(price),
                createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
                isMine: Boolean(dot?.isMine)
            };
        })
        .filter(Boolean);
}

function buildPointChart({ dots, currentPrice, windowKey }) {
    const sampleCount = dots.length;
    const myCount = dots.filter((dot) => dot.isMine).length;
    if (!sampleCount) {
        return {
            sampleCount: 0,
            points: [],
            currentLinePct: 50,
            outlierTopCount: 0,
            outlierBottomCount: 0,
            xLabels: getXAxisLabels(windowKey),
            myCount: 0,
            minPrice: 0,
            avgPrice: 0,
            maxPrice: 0
        };
    }

    const now = Date.now();
    const fallbackSpanMs = WINDOW_MS[windowKey] || 30 * 24 * 60 * 60 * 1000;
    const validTimes = dots.map((dot) => dot.createdAtMs).filter((value) => Number.isFinite(value));
    const oldestTime = validTimes.length ? Math.min(...validTimes) : now - fallbackSpanMs;
    const rangeMs = windowKey === 'all'
        ? Math.max(24 * 60 * 60 * 1000, now - oldestTime)
        : WINDOW_MS[windowKey];
    const xMin = now - rangeMs;
    const xMax = now;

    const priced = dots.slice().sort((a, b) => a.price - b.price);
    const prices = priced.map((dot) => dot.price);
    const safeCurrentPrice = Math.max(100, Number(currentPrice || 0) || prices[0]);
    const relativeMoves = prices.map((price) => (price - safeCurrentPrice) / safeCurrentPrice);
    const q10 = quantile(relativeMoves, 0.1);
    const q90 = quantile(relativeMoves, 0.9);
    const rawAbsRange = Math.max(Math.abs(q10), Math.abs(q90), 0.03);
    const visibleAbsRange = Math.min(Math.max(rawAbsRange * 1.2, 0.05), 1.5);

    let outlierTopCount = 0;
    let outlierBottomCount = 0;
    const visibleDots = [];

    dots.forEach((dot, index) => {
        const relativeMove = (dot.price - safeCurrentPrice) / safeCurrentPrice;
        if (relativeMove > visibleAbsRange) {
            outlierTopCount += 1;
            return;
        }
        if (relativeMove < -visibleAbsRange) {
            outlierBottomCount += 1;
            return;
        }

        const timeMs = Number.isFinite(dot.createdAtMs) ? dot.createdAtMs : xMax - ((sampleCount - index) * (rangeMs / Math.max(1, sampleCount)));
        const xPct = clamp(((timeMs - xMin) / Math.max(1, xMax - xMin)) * 100, 0, 100);
        const yPct = 50 - clamp((relativeMove / visibleAbsRange) * 40, -40, 40);
        const isAboveCurrent = dot.price >= Number(currentPrice || 0);

        visibleDots.push({
            id: dot.id,
            xPct,
            yPct,
            size: dot.isMine ? 12 : 8,
            color: dot.isMine
                ? 'rgba(255,255,255,0.98)'
                : (isAboveCurrent ? 'rgba(244,37,140,0.95)' : 'rgba(0,153,255,0.95)'),
            shadow: dot.isMine
                ? (isAboveCurrent
                    ? '0 0 0 2px rgba(244,37,140,0.9), 0 0 18px rgba(244,37,140,0.3)'
                    : '0 0 0 2px rgba(0,153,255,0.85), 0 0 18px rgba(0,153,255,0.28)')
                : (isAboveCurrent
                    ? '0 0 10px rgba(244,37,140,0.28)'
                    : '0 0 10px rgba(0,153,255,0.24)')
        });
    });

    const avgPrice = Math.round(prices.reduce((sum, price) => sum + price, 0) / Math.max(1, prices.length));

    return {
        sampleCount,
        points: visibleDots,
        currentLinePct: 50,
        outlierTopCount,
        outlierBottomCount,
        xLabels: getXAxisLabels(windowKey),
        myCount,
        minPrice: prices[0],
        avgPrice,
        maxPrice: prices[prices.length - 1]
    };
}

function getXAxisLabels(windowKey) {
    if (windowKey === '24h') return ['지금', '6h', '12h', '18h', '24h'];
    if (windowKey === '7d') return ['오늘', '2일', '4일', '6일', '7일'];
    if (windowKey === '30d') return ['오늘', '1주', '2주', '3주', '1달'];
    return ['최근', '3달', '6달', '1년', '전체'];
}

function quantile(values, ratio) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
    return sorted[index];
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatWon(value) {
    const num = Math.round(Number(value || 0));
    if (!Number.isFinite(num) || num <= 0) return '-';
    return `${num.toLocaleString()}원`;
}

export default PredictionChartV2;
