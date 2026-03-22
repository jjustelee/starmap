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
    L3: { key: 'L3', label: '풀가동', minPct: -99, maxPct: 200, snapPoints: [-99, -75, -50, -30, -10, 0, 10, 30, 50, 75, 100, 150, 200] }
};

const RANGE_ORDER = ['L1', 'L2', 'L3'];

const PERIOD_PRESETS = [
    { label: '내일', days: 1 },
    { label: '이번주', days: 7 },
    { label: '이번달', days: 30 },
    { label: '3개월', days: 90 },
    { label: '1년', days: 365 }
];

const QUICK_PRICE_STEPS = [-10, -5, 0, 5, 10];

/**
 * I/O Contract
 * props:
 * - currentPrice: number
 * - draft: { symbol, targetPrice, targetDate, window, source, rangeLevel }
 * - communityHint?: { sampleSize, anchorPrice, bullishRatio }
 * - isLoggedIn?: boolean
 * - onChange: (partialDraft) => void
 * - onSubmit: () => Promise<void> | void
 * - onRequireLogin?: () => Promise<void> | void
 * - isSubmitting: boolean
 * - errorMessage: string
 * - isRestoredDraft?: boolean
 * - onVisibilityChange?: (visible: boolean) => void
 */
const PredictionComposerV2 = ({ currentPrice, draft, communityHint, isLoggedIn = false, onChange, onSubmit, onRequireLogin, isSubmitting, errorMessage, isRestoredDraft = false, forceOpenSignal = 0, onVisibilityChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [sheetMaxHeight, setSheetMaxHeight] = useState(460);
    const [showManualPrice, setShowManualPrice] = useState(false);
    const [manualPriceInput, setManualPriceInput] = useState('');
    const [showManualDate, setShowManualDate] = useState(false);
    const [rangeLevel, setRangeLevel] = useState(draft?.rangeLevel || 'L1');
    const [pricePct, setPricePct] = useState(0);
    const [periodIdx, setPeriodIdx] = useState(2);
    const [activeStep, setActiveStep] = useState('price');
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    const profile = RANGE_PROFILES[rangeLevel] || RANGE_PROFILES.L1;
    const delta = getDeltaRate(currentPrice, draft?.targetPrice);
    const dday = getDDay(draft?.targetDate);
    const today = toISODate(new Date());
    const maxDate = toISODate(addDays(new Date(), 1095));
    const priceFill = toFillPercent(pricePct, profile.minPct, profile.maxPct);
    const periodFill = toFillPercent(periodIdx, 0, PERIOD_PRESETS.length - 1);
    const toneClass = delta >= 0 ? 'text-neon-pink' : 'text-neon-blue';
    const deltaText = formatDeltaDisplay(delta);
    const deltaToneClass = Math.abs(delta) < 0.05 ? 'text-[#9CA3AF]' : toneClass;
    const communitySummary = getCommunitySummary(communityHint, currentPrice);
    const compactCommunitySummary = getCompactCommunitySummary(communityHint);

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
        if (forceOpenSignal > 0) {
            setIsExpanded(true);
        }
    }, [forceOpenSignal]);

    useEffect(() => {
        onVisibilityChange?.(true);
        return () => {
            onVisibilityChange?.(false);
        };
    }, [onVisibilityChange]);

    useEffect(() => {
        if (!isExpanded) {
            setActiveStep('price');
            setShowLoginPrompt(false);
        }
    }, [isExpanded]);

    useEffect(() => {
        if (!showManualPrice) return;
        setManualPriceInput(String(Number(draft?.targetPrice || 0)));
    }, [showManualPrice, draft?.targetPrice]);

    useEffect(() => {
        if (isLoggedIn) {
            setShowLoginPrompt(false);
        }
    }, [isLoggedIn]);

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

    const applyPercent = (value, source = 'slider') => {
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
        commitPriceFromPercent(nextPct, nextLevel, source);
    };

    const handlePriceSlider = (value) => {
        applyPercent(value, 'slider');
    };

    const handleQuickPricePick = (stepPct) => {
        if (stepPct === 0) {
            applyPercent(0, 'quick-pick-reset');
            return;
        }
        applyPercent(pricePct + stepPct, 'quick-pick');
    };

    const handlePeriodSlider = (idx) => {
        const safeIdx = clamp(Math.round(Number(idx)), 0, PERIOD_PRESETS.length - 1);
        setPeriodIdx(safeIdx);
        onChange({
            targetDate: toISODate(addDays(new Date(), PERIOD_PRESETS[safeIdx].days)),
            source: 'slider'
        });
    };

    const commitManualPrice = () => {
        const parsed = Number(manualPriceInput || 0);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setManualPriceInput(String(Number(draft?.targetPrice || 0)));
            return;
        }
        const snapped = Math.max(100, snapToTick(parsed));
        setManualPriceInput(String(snapped));
        onChange({
            targetPrice: snapped,
            source: 'manual',
            rangeLevel
        });
    };

    return (
        <>
            {isExpanded ? (
                <button
                    type="button"
                    aria-label="예언 시트 닫기"
                    onClick={() => setIsExpanded(false)}
                    className="fixed inset-0 z-[64] bg-[#121212]/10"
                />
            ) : null}

            <section className="fixed bottom-0 left-0 right-0 z-[70] px-3 sm:px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pointer-events-none">
                <div className="mx-auto max-w-2xl pointer-events-auto">
                    <div className="rounded-[24px] sm:rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_-16px_36px_rgba(0,0,0,0.55)] overflow-hidden">
                        {isExpanded ? (
                            <button
                                type="button"
                                onClick={() => setIsExpanded(false)}
                                className="w-full min-h-11 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 border-b border-white/10 bg-[#121212]/20"
                            >
                                <div className="min-w-0 text-left">
                                    <p className="text-[14px] sm:text-[15px] font-bold leading-snug truncate">
                                        <span className="text-[#F3F4F6]">{Number(draft?.targetPrice || 0).toLocaleString()}원</span>
                                        <span className="text-[#9CA3AF]"> · </span>
                                        <span className={deltaToneClass}>{deltaText}</span>
                                        <span className="text-[#9CA3AF]"> · </span>
                                        <span className="text-[#D1D5DB]">{dday}</span>
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-[#9CA3AF] transition-transform rotate-180 shrink-0">expand_more</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                aria-label="예언 입력 시트 열기"
                                onClick={() => setIsExpanded(true)}
                                className="w-full min-h-12 px-3 sm:px-4 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-neon-teal to-neon-pink text-[#F3F4F6] font-bold text-[16px]"
                            >
                                <span>이 종목 예언 남기기</span>
                                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </button>
                        )}

                        {!isExpanded ? (
                            <div className="px-3 sm:px-4 py-2 border-t border-white/10 bg-[#121212]/15">
                                <p className="text-[12px] sm:text-[13px] font-bold text-[#D1D5DB]">
                                    30초 예언
                                </p>
                            </div>
                        ) : null}

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
                                                : 'border-white/15 bg-white/5 text-[#D1D5DB]'
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
                                                : 'border-white/15 bg-white/5 text-[#D1D5DB]'
                                        }`}
                                    >
                                        기간 입력
                                    </button>
                                </div>

                                {activeStep === 'price' ? (
                                    <div className="space-y-2">
                                        {isRestoredDraft ? (
                                            <div className="rounded-2xl border border-neon-teal/25 bg-neon-teal/10 px-3 py-3">
                                                <p className="text-[13px] font-bold text-neon-teal">이전 입력값을 불러왔어요</p>
                                                <p className="mt-1 text-[12px] text-[#9CA3AF]">그대로 박제하거나, 값을 바꾼 뒤 남길 수 있어요.</p>
                                            </div>
                                        ) : null}
                                        <div className="rounded-2xl border border-white/10 bg-[#121212]/22 p-3">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-[13px] text-[#D1D5DB] font-bold inline-flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[15px]">paid</span>
                                                    현재가 기준 증감
                                                </p>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <span className="text-[12px] text-[#9CA3AF] font-bold">
                                                        {profile.minPct}% ~ {profile.maxPct}%
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualPrice((prev) => !prev)}
                                                        className="min-h-11 px-3 rounded-xl text-[13px] font-bold border border-white/10 bg-white/5 text-[#D1D5DB]"
                                                    >
                                                        {showManualPrice ? '슬라이더로' : '직접 입력'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mb-3 grid grid-cols-5 gap-2">
                                                {QUICK_PRICE_STEPS.map((step) => {
                                                    const isActive = Math.abs(pricePct - step) < 0.2;
                                                    const label = step === 0 ? '현재가' : `${step > 0 ? '+' : ''}${step}%`;
                                                    return (
                                                        <button
                                                            key={step}
                                                            type="button"
                                                            onClick={() => handleQuickPricePick(step)}
                                                            className={`min-h-11 rounded-xl border text-[12px] font-bold transition ${
                                                                isActive
                                                                    ? 'border-neon-pink/45 bg-neon-pink/15 text-neon-pink'
                                                                    : 'border-white/10 bg-white/5 text-[#D1D5DB]'
                                                            }`}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9CA3AF]">목표가</p>
                                                <div className="mt-1 flex items-end justify-between gap-3">
                                                    <p className="text-[22px] sm:text-[24px] font-black text-[#F3F4F6]">
                                                        {Number(draft?.targetPrice || 0).toLocaleString()}원
                                                    </p>
                                                    <p className={`text-[14px] sm:text-[15px] font-black ${deltaToneClass}`}>
                                                        {deltaText}
                                                    </p>
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
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#9CA3AF] font-bold">
                                                <span>{profile.minPct}%</span>
                                                <span>현재가</span>
                                                <span>{profile.maxPct}%</span>
                                            </div>
                                            {showManualPrice ? (
                                                <input
                                                    type="number"
                                                    value={manualPriceInput}
                                                    onChange={(e) => setManualPriceInput(e.target.value)}
                                                    onBlur={commitManualPrice}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="mt-2 w-full min-h-11 rounded-xl border border-white/15 bg-[#121212]/30 px-3 text-[16px] font-bold text-[#F3F4F6] outline-none"
                                                    inputMode="numeric"
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="rounded-2xl border border-white/10 bg-[#121212]/22 p-3">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-[13px] text-[#D1D5DB] font-bold inline-flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-[15px]">event</span>
                                                    예언 만기일
                                                </p>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <span className="text-[12px] text-[#9CA3AF] font-bold">{PERIOD_PRESETS[periodIdx]?.label || '-'}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowManualDate((prev) => !prev)}
                                                        className="min-h-11 px-3 rounded-xl text-[13px] font-bold border border-white/10 bg-white/5 text-[#D1D5DB]"
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
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#9CA3AF] font-bold">
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
                                                    className="mt-2 w-full min-h-11 rounded-xl border border-white/15 bg-[#121212]/30 px-3 text-[15px] font-bold text-[#F3F4F6] outline-none"
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                )}

                                <div className="sticky bottom-0 pt-1 pb-1 bg-[#0b0b10]/95 backdrop-blur-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!isLoggedIn) {
                                                setShowLoginPrompt(true);
                                                return;
                                            }
                                            onSubmit?.();
                                        }}
                                        disabled={isSubmitting}
                                        className={`w-full min-h-11 rounded-xl font-bold text-[16px] ${isSubmitting ? 'bg-white/10 text-[#9CA3AF]' : 'bg-gradient-to-r from-neon-teal to-neon-pink text-[#F3F4F6]'}`}
                                    >
                                        {isSubmitting ? '박제 중...' : (isLoggedIn ? (isRestoredDraft ? '이 값으로 예언 박제하기' : '예언 박제하기') : '로그인하고 예언 남기기')}
                                    </button>
                                    {showLoginPrompt ? (
                                        <div className="mt-2 rounded-2xl border border-neon-pink/25 bg-neon-pink/10 px-3 py-3 text-left">
                                            <p className="text-[13px] font-bold text-[#F3F4F6]">예언은 로그인 후 남길 수 있어요</p>
                                            <p className="mt-1 text-[12px] text-[#9CA3AF] leading-relaxed">
                                                카카오로 로그인하면 바로 이어서 남길 수 있어요.
                                                <br />
                                                입력한 목표가와 기한은 그대로 유지됩니다.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => onRequireLogin?.()}
                                                className="mt-3 w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] hover:bg-[#FADA0A] text-[13px] font-black text-[#191919] transition-all active:scale-[0.98] shadow-sm"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.66 1.76 4.98 4.38 6.3-.14.52-.9 3.34-.93 3.56 0 0-.02.16.08.22.1.06.22.02.22.02.3-.04 3.44-2.26 3.98-2.64.72.1 1.48.16 2.26.16 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/>
                                                </svg>
                                                카카오로 계속하기
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="mt-2 px-1 text-[12px] sm:text-[13px] text-[#9CA3AF]">
                                            {isLoggedIn ? '30초 예언 · 적중 시 성지글' : '30초 예언 · 로그인 후 그대로 이어집니다'}
                                        </p>
                                    )}
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
    if (price < 2000) return Math.round(price);
    if (price < 5000) return Math.round(price / 5) * 5;
    if (price < 20000) return Math.round(price / 10) * 10;
    if (price < 50000) return Math.round(price / 50) * 50;
    if (price < 200000) return Math.round(price / 100) * 100;
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

function formatDeltaDisplay(value) {
    const delta = Number(value) || 0;
    if (Math.abs(delta) < 0.05) return '현재가 기준';
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`;
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

function getCommunitySummary(communityHint, currentPrice) {
    const sampleSize = Number(communityHint?.sampleSize) || 0;
    const anchorPrice = Number(communityHint?.anchorPrice);
    const bullishRatio = Number(communityHint?.bullishRatio);
    const hasAnchorPrice = Number.isFinite(anchorPrice) && anchorPrice > 0;
    const hasCurrentPrice = Number(currentPrice) > 0;

    if (sampleSize <= 0) return '아직 첫 예언 전입니다.';

    if (hasCurrentPrice && hasAnchorPrice) {
        const deltaPct = ((anchorPrice - currentPrice) / currentPrice) * 100;
        const deltaText = Math.abs(deltaPct) >= 10
            ? Math.round(Math.abs(deltaPct))
            : Math.abs(deltaPct).toFixed(1);

        if (Number.isFinite(bullishRatio)) {
            if (bullishRatio >= 55) {
                return `현재 예언 ${sampleSize}건, 대표 목표가는 현재가보다 ${deltaText}% 높은 쪽입니다.`;
            }
            if (bullishRatio <= 45) {
                return `현재 예언 ${sampleSize}건, 대표 목표가는 현재가보다 ${deltaText}% 낮은 쪽입니다.`;
            }
        }

        return `현재 예언 ${sampleSize}건, 대표 목표가는 ${Math.round(anchorPrice).toLocaleString()}원 근처예요.`;
    }

    return `현재 예언 ${sampleSize}건이 먼저 쌓이고 있어요.`;
}

function getCompactCommunitySummary(communityHint) {
    const sampleSize = Number(communityHint?.sampleSize) || 0;
    if (sampleSize <= 0) return '아직 첫 예언 전입니다.';
    return `현재 예언 ${sampleSize}건`;
}

export default PredictionComposerV2;
