import React, { useEffect, useState } from 'react';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): submit payload에 source/rangeLevel를 저장해 입력 패턴 분석에 사용.
 * - BACKEND_TODO(KIS): currentPrice는 백엔드에서 받은 단일 기준값을 사용.
 * - BACKEND_TODO(API): 근접도 판정 등급은 결과 API에서 내려받아 후속 화면에 반영.
 */

const RANGE_PROFILES = {
    L1: { key: 'L1', label: '기본각', minPct: -10, maxPct: 10, snapPoints: [-10, -5, 0, 5, 10] },
    L2: { key: 'L2', label: '확장각', minPct: -30, maxPct: 30, snapPoints: [-30, -20, -10, 0, 10, 20, 30] },
    L3: { key: 'L3', label: '풀가동', minPct: -50, maxPct: 100, snapPoints: [-50, -30, -10, 0, 10, 30, 50, 75, 100] }
};

const RANGE_ORDER = ['L1', 'L2', 'L3'];

const PERIOD_PRESETS = [
    { label: '내일', days: 1 },
    { label: '이번주', days: 7 },
    { label: '이번달', days: 30 },
    { label: '3개월', days: 90 },
    { label: '1년', days: 365 }
];

/**
 * I/O Contract
 * props:
 * - currentPrice: number
 * - draft: { symbol, targetPrice, targetDate, window, source, rangeLevel }
 * - onChange: (partialDraft) => void
 * - onSubmit: () => Promise<void> | void
 * - isSubmitting: boolean
 * - errorMessage: string
 */
const PredictionComposerV2 = ({ currentPrice, draft, onChange, onSubmit, isSubmitting, errorMessage }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sheetMaxHeight, setSheetMaxHeight] = useState(460);
    const [showManualPrice, setShowManualPrice] = useState(false);
    const [showManualDate, setShowManualDate] = useState(false);
    const [rangeLevel, setRangeLevel] = useState(draft?.rangeLevel || 'L1');
    const [pricePct, setPricePct] = useState(0);
    const [periodIdx, setPeriodIdx] = useState(2);
    const [activeStep, setActiveStep] = useState('price');

    const profile = RANGE_PROFILES[rangeLevel] || RANGE_PROFILES.L1;
    const delta = getDeltaRate(currentPrice, draft?.targetPrice);
    const dday = getDDay(draft?.targetDate);
    const today = toISODate(new Date());
    const maxDate = toISODate(addDays(new Date(), 1095));
    const priceFill = toFillPercent(pricePct, profile.minPct, profile.maxPct);
    const periodFill = toFillPercent(periodIdx, 0, PERIOD_PRESETS.length - 1);
    const toneClass = delta >= 0 ? 'text-neon-pink' : 'text-neon-blue';

    useEffect(() => {
        const updateHeight = () => {
            const vv = window.visualViewport;
            const viewportHeight = vv?.height || window.innerHeight;
            const next = Math.max(260, Math.min(560, viewportHeight - 150));
            setSheetMaxHeight(next);
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        window.visualViewport?.addEventListener('resize', updateHeight);
        return () => {
            window.removeEventListener('resize', updateHeight);
            window.visualViewport?.removeEventListener('resize', updateHeight);
        };
    }, []);

    useEffect(() => {
        const nextLevel = draft?.rangeLevel && RANGE_PROFILES[draft.rangeLevel] ? draft.rangeLevel : 'L1';
        setRangeLevel(nextLevel);
    }, [draft?.rangeLevel]);

    useEffect(() => {
        const safePrice = Math.max(1, Number(currentPrice) || 1);
        const rawPct = (((Number(draft?.targetPrice || safePrice) - safePrice) / safePrice) * 100);
        const profileForLevel = RANGE_PROFILES[draft?.rangeLevel] || RANGE_PROFILES.L1;
        setPricePct(clamp(rawPct, profileForLevel.minPct, profileForLevel.maxPct));
    }, [draft?.targetPrice, currentPrice, draft?.rangeLevel]);

    useEffect(() => {
        setPeriodIdx(findClosestPeriodIndex(draft?.targetDate));
    }, [draft?.targetDate]);

    useEffect(() => {
        if (errorMessage) {
            setIsExpanded(true);
        }
    }, [errorMessage]);

    useEffect(() => {
        if (!isExpanded) {
            setActiveStep('price');
        }
    }, [isExpanded]);

    const commitPriceFromPercent = (nextPct, levelKey, source = 'slider') => {
        const level = RANGE_PROFILES[levelKey] || RANGE_PROFILES.L1;
        const snappedPct = snapPercent(nextPct, level.snapPoints, 1.1);
        const safePrice = Math.max(1, Number(currentPrice) || 1);
        const raw = safePrice * (1 + (snappedPct / 100));
        const targetPrice = Math.max(100, snapToTick(raw));
        onChange({
            targetPrice,
            source,
            rangeLevel: level.key
        });
    };

    const handlePriceSlider = (value) => {
        let nextPct = Number(value);
        let nextLevel = rangeLevel;
        const currentLevelIndex = RANGE_ORDER.indexOf(rangeLevel);
        const reachedMax = nextPct >= profile.maxPct - 0.2;
        const reachedMin = nextPct <= profile.minPct + 0.2;

        if ((reachedMax || reachedMin) && currentLevelIndex < RANGE_ORDER.length - 1) {
            nextLevel = RANGE_ORDER[currentLevelIndex + 1];
            setRangeLevel(nextLevel);
            const expanded = RANGE_PROFILES[nextLevel];
            nextPct = clamp(nextPct, expanded.minPct, expanded.maxPct);
        }

        setPricePct(nextPct);
        commitPriceFromPercent(nextPct, nextLevel, 'slider');
    };

    const handlePeriodSlider = (idx) => {
        const safeIdx = clamp(Math.round(Number(idx)), 0, PERIOD_PRESETS.length - 1);
        setPeriodIdx(safeIdx);
        onChange({
            targetDate: toISODate(addDays(new Date(), PERIOD_PRESETS[safeIdx].days)),
            source: 'slider'
        });
    };

    return (
        <>
            {isExpanded ? (
                <button
                    type="button"
                    aria-label="예언 시트 닫기"
                    onClick={() => setIsExpanded(false)}
                    className="fixed inset-0 z-[64] bg-black/10"
                />
            ) : null}

            <section className="fixed bottom-0 left-0 right-0 z-[70] px-3 sm:px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-none">
                <div className="mx-auto max-w-2xl pointer-events-auto">
                    <div className="rounded-[24px] sm:rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_-16px_36px_rgba(0,0,0,0.55)] overflow-hidden">
                        {isExpanded ? (
                            <button
                                type="button"
                                onClick={() => setIsExpanded(false)}
                                className="w-full min-h-11 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 border-b border-white/10 bg-black/20"
                            >
                                <div className="text-left">
                                    <p className="text-[13px] sm:text-[14px] text-white/70 font-bold">예언 요약</p>
                                    <p className="mt-1.5 text-[14px] sm:text-[15px] font-bold leading-snug">
                                        <span className="text-white/70">예상가 </span>
                                        <span className="text-white">{Number(draft?.targetPrice || 0).toLocaleString()}원</span>
                                        <span className="text-white/35"> · </span>
                                        <span className={`${toneClass}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}%</span>
                                        <span className="text-white/35"> · </span>
                                        <span className="text-white/85">{dday}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[11px] font-bold text-white/85 uppercase">{profile.label}</span>
                                    <span className="material-symbols-outlined text-white/60 transition-transform rotate-180">expand_more</span>
                                </div>
                            </button>
                        ) : (
                            <button
                                type="button"
                                aria-label="예언 입력 시트 열기"
                                onClick={() => setIsExpanded(true)}
                                className="w-full min-h-12 px-3 sm:px-4 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-neon-teal to-neon-pink text-white font-bold text-[16px]"
                            >
                                <span>예언 박제하러 가기</span>
                                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </button>
                        )}

                        {errorMessage ? (
                            <div className="px-3 sm:px-4 pt-2 pb-1">
                                <div
                                    role="alert"
                                    aria-live="assertive"
                                    className="min-h-11 rounded-xl border border-neon-pink/45 bg-neon-pink/20 px-3 py-2 flex items-center gap-2 shadow-[0_0_12px_rgba(244,37,140,0.22)]"
                                >
                                    <span className="material-symbols-outlined text-neon-pink text-[18px]">error</span>
                                    <p className="text-[14px] sm:text-[15px] font-bold text-neon-pink leading-snug">{errorMessage}</p>
                                </div>
                            </div>
                        ) : null}

                        <div
                            className={`transition-[max-height,opacity] duration-300 ease-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
                            style={{ maxHeight: isExpanded ? `${sheetMaxHeight}px` : '0px' }}
                        >
                            <div className="overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4" style={{ maxHeight: `${sheetMaxHeight}px` }}>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('price')}
                                        className={`min-h-11 rounded-xl border text-[13px] sm:text-[14px] font-bold ${
                                            activeStep === 'price'
                                                ? 'border-neon-pink/45 bg-neon-pink/15 text-neon-pink'
                                                : 'border-white/15 bg-white/5 text-white/85'
                                        }`}
                                    >
                                        가격 입력
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep('date')}
                                        className={`min-h-11 rounded-xl border text-[13px] sm:text-[14px] font-bold ${
                                            activeStep === 'date'
                                                ? 'border-neon-teal/45 bg-neon-teal/15 text-neon-teal'
                                                : 'border-white/15 bg-white/5 text-white/85'
                                        }`}
                                    >
                                        기간 입력
                                    </button>
                                </div>

                                {activeStep === 'price' ? (
                                    <div className="space-y-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/22 p-3">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-[13px] text-white/70 font-bold inline-flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[15px]">paid</span>
                                                    예언 종가 조준
                                                </p>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <span className="text-[12px] text-white/60 font-bold">
                                                        {profile.minPct}% ~ {profile.maxPct}%
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualPrice((prev) => !prev)}
                                                        className="min-h-11 px-3 rounded-xl text-[13px] font-bold border border-white/10 bg-white/5 text-white/90"
                                                    >
                                                        {showManualPrice ? '슬라이더로' : '직접 입력'}
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                type="range"
                                                className="target-slider"
                                                min={profile.minPct}
                                                max={profile.maxPct}
                                                step="0.1"
                                                value={pricePct}
                                                onInput={(e) => handlePriceSlider(e.currentTarget.value)}
                                                style={{
                                                    '--fill-percent': `${priceFill}%`,
                                                    '--fill-color': delta >= 0 ? '#f4258c' : '#0099ff',
                                                    '--thumb-glow': delta >= 0 ? 'rgba(244,37,140,0.65)' : 'rgba(0,153,255,0.65)'
                                                }}
                                            />
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55 font-bold">
                                                <span>{profile.minPct}%</span>
                                                <span>현재가</span>
                                                <span>{profile.maxPct}%</span>
                                            </div>
                                            {showManualPrice ? (
                                                <input
                                                    type="number"
                                                    value={Number(draft?.targetPrice || 0)}
                                                    onChange={(e) => onChange({
                                                        targetPrice: Math.max(100, snapToTick(Number(e.target.value || 0))),
                                                        source: 'manual',
                                                        rangeLevel
                                                    })}
                                                    className="mt-2 w-full min-h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-[16px] font-bold text-white outline-none"
                                                    inputMode="numeric"
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="rounded-2xl border border-white/10 bg-black/22 p-3">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-[13px] text-white/70 font-bold inline-flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[15px]">event</span>
                                                    예언 만기일
                                                </p>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <span className="text-[12px] text-white/60 font-bold">{PERIOD_PRESETS[periodIdx]?.label || '-'}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualDate((prev) => !prev)}
                                                        className="min-h-11 px-3 rounded-xl text-[13px] font-bold border border-white/10 bg-white/5 text-white/90"
                                                    >
                                                        {showManualDate ? '슬라이더로' : '날짜 직접'}
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                type="range"
                                                className="target-slider"
                                                min="0"
                                                max={String(PERIOD_PRESETS.length - 1)}
                                                step="1"
                                                value={periodIdx}
                                                onInput={(e) => handlePeriodSlider(e.currentTarget.value)}
                                                style={{
                                                    '--fill-percent': `${periodFill}%`,
                                                    '--fill-color': '#22d3ee',
                                                    '--thumb-glow': 'rgba(34,211,238,0.65)'
                                                }}
                                            />
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/55 font-bold">
                                                {PERIOD_PRESETS.map((period) => (
                                                    <span key={period.label}>{period.label}</span>
                                                ))}
                                            </div>
                                            {showManualDate ? (
                                                <input
                                                    type="date"
                                                    value={draft?.targetDate || ''}
                                                    min={today}
                                                    max={maxDate}
                                                    onChange={(e) => onChange({ targetDate: e.target.value, source: 'manual' })}
                                                    className="mt-2 w-full min-h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-[15px] font-bold text-white outline-none"
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                )}

                                <div className="sticky bottom-0 pt-1 pb-1 bg-[#0b0b10]/95 backdrop-blur-xl">
                                    <button
                                        type="button"
                                        onClick={onSubmit}
                                        disabled={isSubmitting}
                                        className={`w-full min-h-11 rounded-xl font-bold text-[16px] ${isSubmitting ? 'bg-white/10 text-white/40' : 'bg-gradient-to-r from-neon-teal to-neon-pink text-white'}`}
                                    >
                                        {isSubmitting ? '박제 중...' : '예언 박제하기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

function snapToTick(value) {
    const price = Number(value) || 0;
    if (price < 1000) return Math.round(price);
    if (price < 5000) return Math.round(price / 5) * 5;
    if (price < 10000) return Math.round(price / 10) * 10;
    if (price < 50000) return Math.round(price / 50) * 50;
    if (price < 100000) return Math.round(price / 100) * 100;
    if (price < 500000) return Math.round(price / 500) * 500;
    return Math.round(price / 1000) * 1000;
}

function snapPercent(value, snapPoints, threshold = 1) {
    const next = Number(value);
    if (!Number.isFinite(next)) return 0;
    let best = next;
    let bestDist = Infinity;
    for (const point of snapPoints) {
        const dist = Math.abs(next - point);
        if (dist < bestDist) {
            best = point;
            bestDist = dist;
        }
    }
    if (bestDist <= threshold) return best;
    return Math.round(next * 10) / 10;
}

function toFillPercent(value, min, max) {
    const range = Math.max(0.0001, max - min);
    return ((Number(value) - min) / range) * 100;
}

function findClosestPeriodIndex(isoDate) {
    if (!isoDate) return 2;
    const target = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return 2;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.max(0, Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
    let bestIdx = 0;
    let bestDist = Infinity;
    PERIOD_PRESETS.forEach((preset, idx) => {
        const dist = Math.abs(days - preset.days);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
        }
    });
    return bestIdx;
}

function getDeltaRate(base, target) {
    const b = Number(base || 0);
    const t = Number(target || 0);
    if (b <= 0) return 0;
    return ((t - b) / b) * 100;
}

function getDDay(isoDate) {
    if (!isoDate) return '-';
    const target = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(target.getTime())) return '-';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diff < 0) return 'D+';
    if (diff === 0) return 'D-Day';
    return `D-${diff}`;
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

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value)));
}

export default PredictionComposerV2;
