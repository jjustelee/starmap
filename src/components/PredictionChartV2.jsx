import React, { useMemo } from 'react';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): snapshot.overlay의 dots/cells를 서버 집계 결과로 치환.
 * - BACKEND_TODO(KIS): currentPrice는 KIS 원천을 백엔드에서 주입받아 표시.
 * - BACKEND_TODO(API): /api/v1/symbols/{symbol}/prediction-snapshot 응답 shape와 1:1 매핑.
 */

const X_MAX_DAYS = 1095;
const AUTO_DOT_THRESHOLD = 150;
const X_BINS = 12;
const Y_BINS = 10;
const WINDOWS = ['24h', '7d', '30d', 'all'];
const WINDOW_LABELS = {
    '24h': '24h',
    '7d': '7d',
    '30d': '30d',
    all: 'all'
};

/**
 * I/O Contract
 * props:
 * - snapshot: PredictionSnapshot | null
 * - currentPrice: number
 * - targetPrice: number
 * - targetDate: string(YYYY-MM-DD)
 * - selectedWindow: "24h"|"7d"|"30d"|"all"
 * - onWindowChange: (window) => void
 * output:
 * - JSX chart view (read-only)
 */
const PredictionChartV2 = ({
    snapshot,
    currentPrice,
    targetPrice,
    targetDate,
    selectedWindow = '7d',
    onWindowChange
}) => {
    const domain = useMemo(() => {
        const fallbackMin = Math.max(100, Math.round(currentPrice * 0.8));
        const fallbackMax = Math.round(currentPrice * 1.2);
        return snapshot?.overlay?.yDomain || { min: fallbackMin, max: fallbackMax };
    }, [snapshot, currentPrice]);

    const safeRange = Math.max(1, domain.max - domain.min);
    const currentY = toYPercent(currentPrice, domain.min, safeRange);
    const targetY = toYPercent(targetPrice, domain.min, safeRange);
    const targetX = toXPercent(daysUntil(targetDate));
    const overlayType = snapshot?.overlay?.type || 'dot';
    const dots = snapshot?.overlay?.dots || [];
    const cells = snapshot?.overlay?.cells || [];
    const sampleSize = Number(snapshot?.sampleSize || dots.length || cells.length || 0);
    const effectiveOverlayType = useMemo(() => {
        if (overlayType === 'cluster') {
            if (sampleSize <= AUTO_DOT_THRESHOLD && dots.length > 0) return 'dot';
            if (cells.length === 0 && dots.length > 0) return 'dot';
        }
        if (overlayType === 'dot' && dots.length === 0 && cells.length > 0) return 'cluster';
        return overlayType;
    }, [overlayType, sampleSize, dots.length, cells.length]);
    const heatZones = useMemo(
        () => buildTopHeatZones({ dots, cells, domain, sampleSize, currentPrice }),
        [dots, cells, domain, sampleSize, currentPrice]
    );
    const sentiment = getSentiment(snapshot?.stats?.bullishRatio);
    const labelLayout = getHorizontalLabelLayout(currentY, targetY);
    const dateAlign = getEdgeAlign(targetX);
    const isTargetUp = Number(targetPrice || 0) >= Number(currentPrice || 0);
    const targetLineClass = isTargetUp
        ? 'border-neon-pink/70 shadow-[0_0_10px_rgba(244,37,140,0.35)]'
        : 'border-neon-blue/70 shadow-[0_0_10px_rgba(0,153,255,0.35)]';
    const targetVerticalClass = isTargetUp
        ? 'border-neon-pink/50 shadow-[0_0_10px_rgba(244,37,140,0.25)]'
        : 'border-neon-blue/50 shadow-[0_0_10px_rgba(0,153,255,0.25)]';
    const targetLabelClass = isTargetUp
        ? 'border-neon-pink/30 text-neon-pink'
        : 'border-neon-blue/30 text-neon-blue';
    const dateLabelClass = isTargetUp
        ? 'border-neon-pink/25 text-neon-pink'
        : 'border-neon-blue/25 text-neon-blue';

    return (
        <section className="bg-white/[0.06] backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 border border-white/10 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.5)] relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 right-0 w-28 h-28 bg-neon-pink/5 blur-[55px] rounded-full pointer-events-none" />
            <div className="relative z-10 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-neon-pink text-[24px]">monitoring</span>
                        <h3 className="text-[17px] sm:text-[20px] font-bold text-white tracking-tight leading-none font-brandKo">종가 예언 차트</h3>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${sentiment.className}`}>
                        <span className="material-symbols-outlined text-[14px]">{sentiment.icon}</span>
                        {sentiment.label}
                    </span>
                </div>
                <p className="text-[12px] sm:text-[13px] text-white/55 font-medium leading-relaxed">
                    현재가와 내가 찍은 목표가를 같은 축에서 바로 비교하고, 군집이 강한 가격대를 HOT로 빠르게 확인합니다.
                </p>

                <div className="grid grid-cols-4 gap-2">
                    {WINDOWS.map((window) => {
                        const active = selectedWindow === window;
                        return (
                            <button
                                key={window}
                                type="button"
                                onClick={() => onWindowChange?.(window)}
                                className={`min-h-10 rounded-xl border text-[12px] font-bold transition ${
                                    active
                                        ? 'bg-neon-pink/15 text-neon-pink border-neon-pink/40 shadow-[0_0_10px_rgba(244,37,140,0.22)]'
                                        : 'bg-white/5 text-white/65 border-white/10'
                                }`}
                            >
                                {WINDOW_LABELS[window]}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {heatZones.slice(0, 2).map((zone, idx) => (
                        <span
                            key={zone.id}
                            className={`inline-flex items-center min-h-8 px-2.5 py-1 rounded-lg text-[11px] sm:text-[12px] font-bold border ${
                                zone.bias === 'up'
                                    ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/35'
                                    : 'bg-neon-blue/10 text-neon-blue border-neon-blue/35'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[13px]">local_fire_department</span>
                            HOT{idx + 1} {formatCompactPrice(zone.centerPrice)}
                        </span>
                    ))}
                </div>

                <div id="chart-v2" className="relative h-[280px] sm:h-[320px] w-full rounded-[20px] border border-white/10 bg-[#08080c] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.07),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(244,37,140,0.07),transparent_45%)] pointer-events-none" />

                    <div className="absolute inset-x-0 top-0 bottom-9">
                        {[20, 40, 60, 80].map((line) => (
                            <div key={line} className="absolute left-0 right-0 border-t border-dotted border-white/10" style={{ top: `${line}%` }} />
                        ))}

                        {effectiveOverlayType === 'dot' && dots.map((dot) => (
                            <span
                                key={dot.id}
                                className="absolute w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)]"
                                style={{
                                    left: `${toXPercent(dot.xDays)}%`,
                                    top: `${toYPercent(dot.price, domain.min, safeRange)}%`,
                                    transform: 'translate(-50%, -50%)',
                                    opacity: dot.weight > 1 ? 0.95 : 0.55,
                                    background: Number(dot.price) >= Number(currentPrice)
                                        ? 'rgba(244,37,140,0.88)'
                                        : 'rgba(0,153,255,0.88)',
                                    boxShadow: Number(dot.price) >= Number(currentPrice)
                                        ? '0 0 8px rgba(244,37,140,0.6)'
                                        : '0 0 8px rgba(0,153,255,0.6)'
                                }}
                            />
                        ))}

                        {effectiveOverlayType === 'cluster' && cells.map((cell) => (
                            <span
                                key={cell.id}
                                className="absolute rounded-[6px]"
                                style={getHeatCellStyle(cell, currentPrice, domain.min, domain.max)}
                            />
                        ))}

                        <div className="absolute left-0 right-0 border-t border-neon-teal/70 shadow-[0_0_10px_rgba(34,211,238,0.35)]" style={{ top: `${currentY}%` }} />
                        <div className={`absolute top-0 bottom-0 border-l ${targetVerticalClass}`} style={{ left: `${targetX}%` }} />
                        <div className={`absolute left-0 right-0 border-t border-dashed ${targetLineClass}`} style={{ top: `${targetY}%` }} />

                        <span
                            className="absolute left-2 px-2 py-1 rounded-md bg-black/45 border border-neon-teal/30 text-[12px] font-bold text-neon-teal font-brandKo whitespace-nowrap"
                            style={{ top: `${labelLayout.currentTop}%`, transform: 'translateY(-50%)' }}
                        >
                            <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">paid</span>
                                {Number(currentPrice || 0).toLocaleString()}
                            </span>
                        </span>
                        <span
                            className={`absolute right-2 px-2 py-1 rounded-md bg-black/45 border text-[12px] font-bold font-brandKo whitespace-nowrap ${targetLabelClass}`}
                            style={{ top: `${labelLayout.targetTop}%`, transform: 'translateY(-50%)' }}
                        >
                            <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">my_location</span>
                                {Number(targetPrice || 0).toLocaleString()}
                            </span>
                        </span>
                        <span
                            className={`absolute top-2 px-2 py-1 rounded-md bg-black/45 border text-[12px] font-bold whitespace-nowrap ${dateAlign.className} ${dateLabelClass}`}
                            style={{ left: `${dateAlign.left}%`, transform: dateAlign.transform }}
                        >
                            <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">event</span>
                                만기
                            </span>
                        </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-9 border-t border-white/10 bg-black/30 flex items-center justify-between px-3 text-[11px] text-white/50 font-brandEn">
                        <span>오늘</span>
                        <span>1달</span>
                        <span>3달</span>
                        <span>1년</span>
                        <span>3년</span>
                    </div>
                </div>

                {overlayType === 'cluster' && effectiveOverlayType === 'dot' ? (
                    <p className="text-[11px] text-white/50 font-bold">표본이 적어 점 모드로 자동 표시 중</p>
                ) : null}
            </div>
        </section>
    );
};

function getSentiment(bullishRatio) {
    if (bullishRatio === null || bullishRatio === undefined || bullishRatio === '') {
        return {
            label: '집계 대기',
            icon: 'schedule',
            className: 'bg-white/10 border border-white/20 text-white/75'
        };
    }
    const bull = Number(bullishRatio);
    if (!Number.isFinite(bull)) {
        return {
            label: '집계 대기',
            icon: 'schedule',
            className: 'bg-white/10 border border-white/20 text-white/75'
        };
    }
    if (bull >= 0.57) {
        return {
            label: '상승 우세',
            icon: 'rocket_launch',
            className: 'bg-neon-pink/12 border border-neon-pink/30 text-neon-pink'
        };
    }
    if (bull <= 0.43) {
        return {
            label: '하락 우세',
            icon: 'south',
            className: 'bg-neon-blue/12 border border-neon-blue/30 text-neon-blue'
        };
    }
    return {
        label: '중립',
        icon: 'drag_handle',
        className: 'bg-white/10 border border-white/20 text-white/75'
    };
}

function buildTopHeatZones({ dots, cells, domain, sampleSize, currentPrice }) {
    let baseCells = cells;
    if (!baseCells.length && dots.length) {
        baseCells = buildCellsFromDots(dots, domain.min, domain.max);
    }
    if (!baseCells.length) return [];

    return baseCells
        .slice()
        .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
        .slice(0, 3)
        .map((cell) => {
            const range = getCellRanges(cell, domain.min, domain.max);
            return {
                id: cell.id,
                count: Number(cell.count || 0),
                centerDay: Math.round((range.dayStart + range.dayEnd) / 2),
                centerPrice: Math.round((range.priceMin + range.priceMax) / 2),
                bias: ((range.priceMin + range.priceMax) / 2) >= Number(currentPrice) ? 'up' : 'down',
                sampleSize
            };
        });
}

function buildCellsFromDots(dots, minPrice, maxPrice) {
    const map = new Map();
    for (const dot of dots) {
        const xBin = clamp(Math.floor((Number(dot.xDays || 0) / X_MAX_DAYS) * X_BINS), 0, X_BINS - 1);
        const yNorm = (Number(dot.price || 0) - minPrice) / Math.max(1, maxPrice - minPrice);
        const yBin = clamp(Math.floor((1 - yNorm) * Y_BINS), 0, Y_BINS - 1);
        const key = `${xBin}:${yBin}`;
        map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([key, count], idx) => {
        const [xBin, yBin] = key.split(':').map(Number);
        return {
            id: `derived_cell_${idx}`,
            xBin,
            yBin,
            count
        };
    });
}

function getHeatCellStyle(cell, currentPrice, minPrice, maxPrice) {
    const range = getCellRanges(cell, minPrice, maxPrice);
    const midPrice = (range.priceMin + range.priceMax) / 2;
    const isUp = midPrice >= Number(currentPrice);
    return {
        width: `${100 / X_BINS}%`,
        height: `${100 / Y_BINS}%`,
        left: `${(Number(cell.xBin) / X_BINS) * 100}%`,
        top: `${(Number(cell.yBin) / Y_BINS) * 100}%`,
        opacity: Math.min(0.88, 0.22 + (Number(cell.count || 0) / 12)),
        background: isUp ? 'rgba(244,37,140,0.32)' : 'rgba(0,153,255,0.3)',
        border: `1px solid ${isUp ? 'rgba(244,37,140,0.45)' : 'rgba(0,153,255,0.45)'}`,
        boxShadow: isUp ? '0 0 8px rgba(244,37,140,0.22)' : '0 0 8px rgba(0,153,255,0.22)'
    };
}

function getCellRanges(cell, minPrice, maxPrice) {
    const xStart = Math.round((Number(cell.xBin) / X_BINS) * X_MAX_DAYS);
    const xEnd = Math.round(((Number(cell.xBin) + 1) / X_BINS) * X_MAX_DAYS);
    const step = (maxPrice - minPrice) / Y_BINS;
    const priceMax = maxPrice - (Number(cell.yBin) * step);
    const priceMin = maxPrice - ((Number(cell.yBin) + 1) * step);
    return {
        dayStart: clamp(xStart, 0, X_MAX_DAYS),
        dayEnd: clamp(xEnd, 0, X_MAX_DAYS),
        priceMin: Math.max(100, Math.round(priceMin)),
        priceMax: Math.max(100, Math.round(priceMax))
    };
}

function formatCompactPrice(price) {
    const safe = Math.max(0, Number(price || 0));
    if (safe >= 10000) {
        const man = Math.round((safe / 10000) * 10) / 10;
        return `${stripTrailingZero(man)}만`;
    }
    return safe.toLocaleString();
}

function stripTrailingZero(value) {
    const text = String(value);
    return text.endsWith('.0') ? text.slice(0, -2) : text;
}

function toYPercent(price, min, range) {
    const ratio = 1 - ((Number(price || 0) - min) / range);
    return clamp(ratio * 100, 0, 100);
}

function toXPercent(days) {
    return clamp((days / X_MAX_DAYS) * 100, 0, 100);
}

function daysUntil(isoDate) {
    if (!isoDate) return 90;
    const target = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return 90;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = target.getTime() - start.getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getHorizontalLabelLayout(currentY, targetY) {
    let currentTop = clamp(currentY - 7, 8, 84);
    let targetTop = clamp(targetY - 7, 8, 84);
    if (Math.abs(currentTop - targetTop) < 10) {
        if (currentTop <= targetTop) {
            currentTop = clamp(currentTop - 6, 8, 84);
            targetTop = clamp(targetTop + 6, 8, 84);
        } else {
            targetTop = clamp(targetTop - 6, 8, 84);
            currentTop = clamp(currentTop + 6, 8, 84);
        }
    }
    return { currentTop, targetTop };
}

function getEdgeAlign(xPct) {
    const left = clamp(xPct, 8, 92);
    if (left < 18) {
        return { left, transform: 'translateX(0)', className: 'left-0' };
    }
    if (left > 82) {
        return { left, transform: 'translateX(-100%)', className: 'left-0' };
    }
    return { left, transform: 'translateX(-50%)', className: 'left-0' };
}

export default PredictionChartV2;
