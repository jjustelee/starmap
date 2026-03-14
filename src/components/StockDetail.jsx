import React, { useState, useRef, useEffect, useCallback } from 'react';
import DistributionSummary from './DistributionSummary';
import DetailHeader from './DetailHeader';
import TargetControlBar from './TargetControlBar';
import OrderBottomSheet from './OrderBottomSheet';
import StockSvgChart from './StockSvgChart';
import { useChartInteraction } from '../hooks/useChartInteraction';
import { ChartProvider, useChartContext } from '../context/ChartContext';
import { useAuth } from '../context/AuthContext';
import { submitPrediction, generateSacredId } from '../utils/mockData';
import LoginBottomSheet from './LoginBottomSheet';
import SuccessCertificate from './SuccessCertificate';

/* ──────────────────────────────────────────
   Constants
   ────────────────────────────────────────── */
const GRID_TICKS = [5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
const SAFE_MARGIN = 60;
const PIXELS_PER_TICK = 5;

const TIME_OPTIONS = [
    { text: '내일', val: '5' },
    { text: '이번주', val: '15' },
    { text: '다음주', val: '25' },
    { text: '이번달', val: '35' },
    { text: '다음달', val: '45' },
    { text: '3개월', val: '55' },
    { text: '올해', val: '65' },
    { text: '1년', val: '75' },
    { text: '3년', val: '85' },
    { text: '언젠가', val: 'none' },
];

/* ──────────────────────────────────────────
   Utility Functions
   ────────────────────────────────────────── */
function getTickSize(price) {
    if (price < 2000) return 1;
    if (price < 5000) return 5;
    if (price < 20000) return 10;
    if (price < 50000) return 50;
    if (price < 200000) return 100;
    if (price < 500000) return 500;
    return 1000;
}

function getGridTick(minPrice, maxPrice) {
    const range = Math.max(1, maxPrice - minPrice);
    const under100k = maxPrice < 100000;
    let tick = under100k
        ? ((range / 5000) <= 6 ? 5000 : 10000)
        : (GRID_TICKS.find((c) => (range / c) <= 6) || GRID_TICKS[GRID_TICKS.length - 1]);
    let index = GRID_TICKS.indexOf(tick);
    if (index < 0) index = 0;
    let lineCount = Math.ceil(range / tick);
    while (lineCount < 5 && index > 0) { index--; tick = GRID_TICKS[index]; lineCount = Math.ceil(range / tick); }
    while (lineCount > 6 && index < GRID_TICKS.length - 1) { index++; tick = GRID_TICKS[index]; lineCount = Math.ceil(range / tick); }
    return tick;
}

function calculateExactDate(periodText) {
    const today = new Date();
    let targetDate = new Date(today);
    switch (periodText) {
        case '내일': targetDate.setDate(today.getDate() + 1); break;
        case '이번주': {
            const d = 5 - today.getDay();
            targetDate.setDate(today.getDate() + (d >= 0 ? d : d + 7));
            break;
        }
        case '다음주': {
            const d = 5 - today.getDay() + 7;
            targetDate.setDate(today.getDate() + d);
            break;
        }
        case '이번달': targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
        case '다음달': targetDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); break;
        case '3개월': targetDate.setMonth(today.getMonth() + 3); break;
        case '올해': targetDate = new Date(today.getFullYear(), 11, 31); break;
        case '1년': targetDate.setFullYear(today.getFullYear() + 1); break;
        case '3년': targetDate.setFullYear(today.getFullYear() + 3); break;
        case '언젠가': return null;
        default: return null;
    }
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function triggerHaptic(duration = 15) {
    if (navigator.vibrate) navigator.vibrate(duration);
}

function getSealBtnText(dateText, priceValue, isManual) {
    const priceStr = priceValue.toLocaleString() + '원';
    if (isManual) return `${dateText}까지 ${priceStr} 찍는다`;
    switch (dateText) {
        case '내일': return `내일까지 ${priceStr} 무조건 간다`;
        case '이번주': return `이번주까지 ${priceStr} 찍는다`;
        case '다음주': return `다음주까지 ${priceStr} 간다`;
        case '이번달': return `이번달 안에 ${priceStr} 간다`;
        case '다음달': return `다음달 안에 ${priceStr} 돌파한다`;
        case '3개월': return `3개월 안에 ${priceStr} 찍는다`;
        case '올해': return `올해 안에 ${priceStr} 무조건 간다`;
        case '1년': return `1년 안에 ${priceStr} 도달한다`;
        case '3년': return `3년 안에 ${priceStr} 간다`;
        case '언젠가': return `언젠가 ${priceStr} 무조건 간다`;
        default: return `[${dateText}] ${priceStr} 간다`;
    }
}

/* ──────────────────────────────────────────
   Pin HTML (dangerouslySetInnerHTML)
   ────────────────────────────────────────── */
const PIN_STANDARD = `<div class="relative flex items-center justify-center"><div class="absolute w-12 h-12 bg-white/20 blur-xl rounded-full animate-ping"></div><div class="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.6)]"><span class="material-symbols-outlined text-black text-[20px] font-black" style="font-variation-settings: 'FILL' 1">star</span></div></div>`;
const PIN_TIMELESS = `<div class="relative flex items-center justify-center"><div class="absolute w-16 h-16 bg-white/30 blur-xl rounded-full animate-ping"></div><div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.8)]"><span class="material-symbols-outlined text-black text-[24px] font-black" style="font-variation-settings: 'FILL' 1">all_inclusive</span></div></div>`;

import CommunityDashboard from './CommunityDashboard';

/* ──────────────────────────────────────────
   StockDetail Main Component (Only renders when data is ready)
   ────────────────────────────────────────── */
const StockDetailMain = ({ stock, onBack, onRecord }) => {
    const { user, isLoggedIn, profile } = useAuth();
    const [showLoginSheet, setShowLoginSheet] = useState(false);
    const [pendingSeal, setPendingSeal] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const { 
        stateRef: state, 
        stockInfo,
        historyData,
        starsData,
        dashboardData,
        basePrice: BASE_PRICE, 
        initialMin: INITIAL_MIN, 
        initialMax: INITIAL_MAX,
        chartDims, setChartDims,
        isSealing, setIsSealing,
        vowCount, setVowCount
    } = useChartContext();

    /* ── 1. All Refs at the absolute top ── */
    const chartRef = useRef(null);
    const gridRef = useRef(null);
    const hLineRef = useRef(null);
    const hLineTooltipRef = useRef(null);
    const floatingInstructionRef = useRef(null);
    const vLineRef = useRef(null);
    const vLineTooltipRef = useRef(null);
    const pinRef = useRef(null);
    const priceLabelRef = useRef(null);
    const dateLabelRef = useRef(null);
    const topInstructionRef = useRef(null);
    const mainContentRef = useRef(null);
    const floatingBarRef = useRef(null);
    const bottomSheetRef = useRef(null);
    const sheetContentRef = useRef(null);
    const backdropRef = useRef(null);
    const floatingPriceRef = useRef(null);
    const sheetPriceRef = useRef(null);
    const profitBadgeRef = useRef(null);
    const sealBtnRef = useRef(null);
    const sliderRef = useRef(null);
    const sliderDisplayRef = useRef(null);
    const sliderHeaderRef = useRef(null);
    const manualHeaderRef = useRef(null);
    const sliderUIRef = useRef(null);
    const manualUIRef = useRef(null);
    const inputYearRef = useRef(null);
    const inputMonthRef = useRef(null);
    const inputDayRef = useRef(null);
    const svgAreaRef = useRef(null);

    /* ── 2. All Custom Hooks ── */
    const {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
    } = useChartInteraction({
        chartRef,
        state,
        updatePriceUI: (p) => updatePriceUI(p),
        getYPrice: (y) => getYPrice(y),
        startTargeting: () => startTargeting(),
        syncSheetPosition: () => syncSheetPosition()
    });

    /* ── 3. All Callbacks next ── */
    const getPriceY = useCallback((price) => {
        if (!chartRef.current) return 0;
        const rect = chartRef.current.getBoundingClientRect();
        const available = rect.height - (SAFE_MARGIN * 2);
        const s = state.current;
        const ratio = 1 - ((price - s.axisPriceMin) / (s.axisPriceMax - s.axisPriceMin));
        return SAFE_MARGIN + (ratio * available);
    }, [state]);

    const getYPrice = useCallback((y) => {
        if (!chartRef.current) return 0;
        const rect = chartRef.current.getBoundingClientRect();
        const available = rect.height - (SAFE_MARGIN * 2);
        let relY = y - SAFE_MARGIN;
        if (relY < 0) relY = 0;
        if (relY > available) relY = available;
        const ratio = 1 - (relY / available);
        const s = state.current;
        const rawPrice = s.axisPriceMin + (ratio * (s.axisPriceMax - s.axisPriceMin));
        const tick = getTickSize(rawPrice);
        return Math.max(0, Math.round(rawPrice / tick) * tick);
    }, [state]);

    const renderGrid = useCallback(() => {
        const s = state.current;
        const tick = getGridTick(s.currentPriceMin, s.currentPriceMax);
        s.axisPriceMin = Math.floor(s.currentPriceMin / tick) * tick;
        s.axisPriceMax = Math.ceil(s.currentPriceMax / tick) * tick;
        if (s.axisPriceMax === s.axisPriceMin) s.axisPriceMax += tick;

        if (!gridRef.current) return;
        gridRef.current.innerHTML = '';

        for (let price = s.axisPriceMin; price <= s.axisPriceMax; price += tick) {
            const top = getPriceY(price);
            const line = document.createElement('div');
            line.className = 'grid-line-container absolute left-0 w-full border-t border-dotted border-white/15';
            line.style.top = `${top}px`;
            const label = document.createElement('div');
            label.className = 'absolute right-4 -translate-y-1/2 text-[11px] font-black font-brandEn tracking-wide text-white/50';
            label.style.top = `${top}px`;
            label.innerText = price.toLocaleString();
            gridRef.current.appendChild(line);
            gridRef.current.appendChild(label);
        }
    }, [getPriceY, state]);

    const updatePriceUI = useCallback((newPrice) => {
        const s = state.current;
        newPrice = Math.max(0, newPrice);
        s.currentPriceValue = newPrice;
        const formatted = newPrice.toLocaleString();
        if (priceLabelRef.current) priceLabelRef.current.innerText = formatted;
        if (floatingPriceRef.current) floatingPriceRef.current.innerText = formatted;
        if (sheetPriceRef.current) sheetPriceRef.current.innerText = formatted;
        const profitPercent = ((newPrice - BASE_PRICE) / BASE_PRICE) * 100;
        if (profitBadgeRef.current) {
            if (profitPercent > 0) {
                profitBadgeRef.current.className = 'px-2 py-1 rounded-md text-[11px] font-black font-brandEn tracking-wider transition-colors bg-neon-pink/10 text-neon-pink border-neon-pink/20 border';
                profitBadgeRef.current.innerText = `+${profitPercent.toFixed(2)}%`;
            } else if (profitPercent < 0) {
                profitBadgeRef.current.className = 'px-2 py-1 rounded-md text-[11px] font-black font-brandEn tracking-wider transition-colors bg-neon-teal/10 text-neon-teal border-neon-teal/20 border';
                profitBadgeRef.current.innerText = `${profitPercent.toFixed(2)}%`;
            } else {
                profitBadgeRef.current.className = 'px-2 py-1 rounded-md text-[11px] font-black font-brandEn tracking-wider transition-colors bg-white/10 text-white/50 border border-white/5';
                profitBadgeRef.current.innerText = '0.00%';
            }
        }
        if (s.selectedDateText && sealBtnRef.current) {
            sealBtnRef.current.innerText = getSealBtnText(s.selectedDateText, newPrice, s.isManualMode);
        }
        const currentY = getPriceY(newPrice);
        if (hLineRef.current) hLineRef.current.style.top = currentY + 'px';
        if (pinRef.current) pinRef.current.style.top = currentY + 'px';
        if (vLineTooltipRef.current) vLineTooltipRef.current.style.top = currentY + 'px';
        if (s.scaleTimer) clearTimeout(s.scaleTimer);
        s.scaleTimer = setTimeout(() => {
            const range = s.currentPriceMax - s.currentPriceMin;
            const topMargin = s.currentPriceMax - (range * 0.15);
            const bottomMargin = s.currentPriceMin + (range * 0.15);
            let changed = false;
            if (newPrice >= topMargin) { s.currentPriceMax = newPrice + (range * 0.3); changed = true; }
            else if (newPrice <= bottomMargin) { s.currentPriceMin = Math.max(0, newPrice - (range * 0.3)); changed = true; }
            let baseRatio = (BASE_PRICE - s.currentPriceMin) / (s.currentPriceMax - s.currentPriceMin);
            if (baseRatio < 0.1) { s.currentPriceMin = Math.max(0, (BASE_PRICE - 0.1 * s.currentPriceMax) / 0.9); changed = true; }
            if (changed) {
                renderGrid();
                const finalY = getPriceY(newPrice);
                if (hLineRef.current) hLineRef.current.style.top = finalY + 'px';
                if (pinRef.current) pinRef.current.style.top = finalY + 'px';
                if (vLineTooltipRef.current) vLineTooltipRef.current.style.top = finalY + 'px';
                if (s.isSheetOpen && typeof s.doSyncSheet === 'function') s.doSyncSheet();
            }
        }, 250);
    }, [BASE_PRICE, getPriceY, renderGrid, state]);

    /* ── Targeting state transitions ── */
    const startTargeting = useCallback(() => {
        const s = state.current;
        s.isTargeting = true;
        if (topInstructionRef.current) topInstructionRef.current.classList.add('opacity-0');
        if (hLineRef.current) hLineRef.current.classList.remove('hidden');
        if (floatingInstructionRef.current) {
            floatingInstructionRef.current.classList.remove('hidden');
            setTimeout(() => {
                floatingInstructionRef.current?.classList.remove('opacity-0');
                floatingInstructionRef.current?.classList.add('animate-pulse');
            }, 50);
        }
        if (!s.isSheetOpen && floatingBarRef.current) {
            floatingBarRef.current.classList.remove('translate-y-[200%]');
        }
    }, []);

    const cancelTargeting = useCallback(() => {
        const s = state.current;
        s.isTargeting = false;
        if (floatingBarRef.current) floatingBarRef.current.classList.add('translate-y-[200%]');
        if (topInstructionRef.current) topInstructionRef.current.classList.remove('opacity-0');
        if (hLineRef.current) hLineRef.current.classList.add('hidden');
        if (floatingInstructionRef.current) {
            floatingInstructionRef.current.classList.remove('animate-pulse');
            floatingInstructionRef.current.classList.add('opacity-0');
            setTimeout(() => floatingInstructionRef.current?.classList.add('hidden'), 300);
        }
        s.currentPriceMin = INITIAL_MIN;
        s.currentPriceMax = INITIAL_MAX;
        if (mainContentRef.current) mainContentRef.current.style.transform = 'translateY(0px)';
        renderGrid();
    }, [INITIAL_MIN, INITIAL_MAX, renderGrid]);

    /* ── Slider UI Update ── */
    const updateSliderUI = useCallback((index) => {
        const s = state.current;
        const option = TIME_OPTIONS[index];
        s.selectedDateText = option.text;
        const xVal = option.val;
        s.finalTargetDate = calculateExactDate(option.text);

        const percent = (index / (TIME_OPTIONS.length - 1)) * 100;
        const isTimeless = (index == 9);
        const activeColor = isTimeless ? '#f4258c' : '#22d3ee';
        const activeGlow = isTimeless ? 'rgba(244,37,140,0.6)' : 'rgba(34,211,238,0.6)';

        if (sliderDisplayRef.current) {
            sliderDisplayRef.current.innerText = option.text;
            sliderDisplayRef.current.className = `text-2xl font-black transition-colors duration-300 leading-none ${isTimeless ? 'text-neon-pink' : 'text-neon-teal'}`;
        }

        if (sliderRef.current) {
            sliderRef.current.style.setProperty('--fill-percent', `${percent}%`);
            sliderRef.current.style.setProperty('--fill-color', activeColor);
            sliderRef.current.style.setProperty('--thumb-glow', activeGlow);
        }

        if (pinRef.current) pinRef.current.classList.remove('scale-100');

        if (isTimeless) {
            if (vLineRef.current) {
                vLineRef.current.classList.remove('hidden', 'border-neon-teal', 'shadow-[0_0_10px_#22d3ee]');
                vLineRef.current.classList.add('border-transparent');
                vLineRef.current.style.left = '50%';
            }
            if (dateLabelRef.current) dateLabelRef.current.innerText = option.text;
            if (pinRef.current) { pinRef.current.innerHTML = PIN_TIMELESS; pinRef.current.style.left = '50%'; }
            if (hLineTooltipRef.current) hLineTooltipRef.current.style.left = '50%';
        } else {
            if (vLineRef.current) {
                vLineRef.current.classList.remove('hidden', 'border-transparent');
                vLineRef.current.classList.add('border-neon-teal', 'shadow-[0_0_10px_#22d3ee]');
                vLineRef.current.style.left = xVal + '%';
            }
            if (dateLabelRef.current) dateLabelRef.current.innerText = option.text;
            if (pinRef.current) { pinRef.current.innerHTML = PIN_STANDARD; pinRef.current.style.left = xVal + '%'; }
            if (hLineTooltipRef.current) hLineTooltipRef.current.style.left = xVal + '%';
        }

        if (pinRef.current) {
            pinRef.current.style.top = getPriceY(s.currentPriceValue) + 'px';
            pinRef.current.classList.remove('hidden');
            setTimeout(() => pinRef.current?.classList.replace('scale-0', 'scale-100'), 50);
        }

        // Radar Scale X-Axis Highlight 연동
        const xAxisLabels = document.querySelectorAll('.x-axis-label');
        xAxisLabels.forEach((label, idx) => {
            if (idx === index) {
                label.classList.add('text-neon-teal', 'opacity-100');
                label.classList.remove('text-white/30', 'opacity-50');
            } else {
                label.classList.remove('text-neon-teal', 'opacity-100');
                label.classList.add('text-white/30', 'opacity-50');
            }
        });

        if (sealBtnRef.current) {
            sealBtnRef.current.innerText = getSealBtnText(option.text, s.currentPriceValue, false);
        }

        triggerHaptic(15);
    }, [getPriceY]);

    /* ── Bottom Sheet ── */
    const openSheet = useCallback(() => {
        const s = state.current;
        s.isSheetOpen = true;
        if (floatingBarRef.current) floatingBarRef.current.classList.add('translate-y-[200%]');
        if (bottomSheetRef.current) bottomSheetRef.current.classList.remove('translate-y-full');
        if (backdropRef.current) {
            backdropRef.current.classList.remove('hidden');
            setTimeout(() => backdropRef.current?.classList.remove('opacity-0'), 10);
        }
        if (floatingInstructionRef.current) {
            floatingInstructionRef.current.classList.remove('animate-pulse');
            floatingInstructionRef.current.classList.add('opacity-0');
        }
        if (mainContentRef.current) mainContentRef.current.style.transform = 'translateY(0px)';

        setTimeout(() => {
            if (!chartRef.current || !sheetContentRef.current) return;
            const rect = chartRef.current.getBoundingClientRect();
            const pinY = getPriceY(s.currentPriceValue);
            const absolutePinY = rect.top + pinY;
            const headerH = 90;
            const sheetH = sheetContentRef.current.offsetHeight || 240;
            const safeH = window.innerHeight - headerH - sheetH;
            const targetCenter = headerH + (safeH / 2);
            let shift = absolutePinY - targetCenter;
            if (shift < 0) shift = 0;
            if (mainContentRef.current) mainContentRef.current.style.transform = `translateY(-${shift}px)`;

            if (s.isManualMode) {
                setTimeout(() => inputMonthRef.current?.focus(), 300);
            }
        }, 10);

        if (!s.isManualMode && sliderRef.current) {
            updateSliderUI(sliderRef.current.value);
        }
    }, [getPriceY, updateSliderUI]);

    const closeSheet = useCallback(() => {
        const s = state.current;
        s.isSheetOpen = false;
        if (bottomSheetRef.current) bottomSheetRef.current.classList.add('translate-y-full');
        if (backdropRef.current) {
            backdropRef.current.classList.add('opacity-0');
            setTimeout(() => backdropRef.current?.classList.add('hidden'), 300);
        }

        // Reset X-Axis Highlight
        const xAxisLabels = document.querySelectorAll('.x-axis-label');
        xAxisLabels.forEach(label => {
            label.classList.remove('text-neon-teal', 'opacity-100');
            label.classList.add('text-white/30', 'opacity-50');
        });

        if (s.isTargeting && floatingBarRef.current) {
            floatingBarRef.current.classList.remove('translate-y-[200%]');
            setTimeout(() => {
                floatingInstructionRef.current?.classList.remove('opacity-0');
                floatingInstructionRef.current?.classList.add('animate-pulse');
            }, 300);
        }
        if (vLineRef.current) vLineRef.current.classList.add('hidden');
        if (pinRef.current) { pinRef.current.classList.add('hidden', 'scale-0'); }
        if (mainContentRef.current) mainContentRef.current.style.transform = 'translateY(0px)';
    }, []);

    /* ── Manual date validation ── */
    const validateAndSync = useCallback(() => {
        const s = state.current;
        const yVal = inputYearRef.current?.value || '';
        const mVal = inputMonthRef.current?.value || '';
        const dVal = inputDayRef.current?.value || '';
        const y = parseInt(yVal, 10);
        const m = parseInt(mVal, 10);
        const d = parseInt(dVal, 10);
        const fullDate = `${yVal}-${mVal.padStart(2, '0')}-${dVal.padStart(2, '0')}`;

        const testDate = new Date(y, m - 1, d);
        const isStrictValid = (testDate.getFullYear() === y) && (testDate.getMonth() + 1 === m) && (testDate.getDate() === d);
        const isValid = isStrictValid && (y >= 2026);

        [inputYearRef, inputMonthRef, inputDayRef].forEach(ref => {
            if (ref.current && ref.current.value !== '') {
                ref.current.classList.toggle('error', !isValid);
            }
        });

        if (!isValid && mVal !== '' && dVal !== '') {
            if (sealBtnRef.current) {
                sealBtnRef.current.innerText = '⚠️ 존재하지 않는 날짜입니다';
                sealBtnRef.current.disabled = true;
                sealBtnRef.current.classList.remove('bg-gradient-to-r', 'from-neon-teal', 'to-neon-pink', 'shadow-glowPink');
                sealBtnRef.current.classList.add('bg-white/10', 'text-white/40', 'cursor-not-allowed');
            }
        } else {
            if (sealBtnRef.current) {
                sealBtnRef.current.disabled = false;
                sealBtnRef.current.classList.remove('bg-white/10', 'text-white/40', 'cursor-not-allowed');
                sealBtnRef.current.classList.add('bg-gradient-to-r', 'from-neon-teal', 'to-neon-pink', 'shadow-glowPink');
                sealBtnRef.current.innerText = getSealBtnText(s.selectedDateText || '언젠가', s.currentPriceValue, true);
            }
        }

        if (yVal.length === 4 && mVal.length >= 1 && dVal.length >= 1 && isValid) {
            s.selectedDateText = fullDate;
            s.finalTargetDate = fullDate;
            if (dateLabelRef.current) dateLabelRef.current.innerText = fullDate;
            if (sealBtnRef.current) sealBtnRef.current.innerText = getSealBtnText(fullDate, s.currentPriceValue, true);

            if (vLineRef.current) {
                vLineRef.current.classList.remove('hidden', 'border-transparent');
                vLineRef.current.classList.add('border-neon-teal', 'shadow-[0_0_10px_#22d3ee]');
                vLineRef.current.style.left = '50%';
            }
            if (pinRef.current) {
                pinRef.current.innerHTML = PIN_STANDARD;
                pinRef.current.style.left = '50%';
                pinRef.current.style.top = getPriceY(s.currentPriceValue) + 'px';
                pinRef.current.classList.remove('hidden', 'scale-0');
            }
            if (hLineTooltipRef.current) hLineTooltipRef.current.style.left = '50%';
        }

        // Reset X-Axis Highlight
        const xAxisLabels = document.querySelectorAll('.x-axis-label');
        xAxisLabels.forEach(label => {
            label.classList.remove('text-neon-teal', 'opacity-100');
            label.classList.add('text-white/30', 'opacity-50');
        });
    }, [getPriceY]);

    /* ── Sync sheet scroll position (시트 열린 상태에서 가격 재조정 시 호출) ── */
    const syncSheetPosition = useCallback(() => {
        const s = state.current;
        if (!chartRef.current || !sheetContentRef.current || !s.isSheetOpen) return;

        requestAnimationFrame(() => {
            if (!chartRef.current || !sheetContentRef.current) return;
            const rect = chartRef.current.getBoundingClientRect();

            let currentTranslateY = 0;
            if (mainContentRef.current) {
                const transform = window.getComputedStyle(mainContentRef.current).transform;
                if (transform && transform !== 'none') {
                    const matrix = new DOMMatrix(transform);
                    currentTranslateY = matrix.m42;
                }
            }

            const originalChartTop = rect.top - currentTranslateY;
            const pinY = getPriceY(s.currentPriceValue);

            // 날짜 라벨(vLineTooltip 내) 하단 Y 절대좌표 추정 (핀 Y + 오프셋 약 60px)
            const labelBottomAbsoluteY = originalChartTop + pinY + 60;

            const sheetH = sheetContentRef.current.offsetHeight || 240;
            const sheetTop = window.innerHeight - sheetH;

            // 마지노선: 바텀시트에서 위로 20px 공간 확보
            const limitY = sheetTop - 20;

            let shift = 0;
            // 날짜 라벨 하단이 마지노선 아래로 깊어지는 경우, 그 거리를 계산하여 화면 끌어올림
            if (labelBottomAbsoluteY > limitY) {
                shift = labelBottomAbsoluteY - limitY;
            }

            if (mainContentRef.current) {
                mainContentRef.current.style.transform = `translateY(-${shift}px)`;
            }
        });
    }, [getPriceY]);

    state.current.doSyncSheet = syncSheetPosition;

    /* ── Initial Setup ── */
    useEffect(() => {
        renderGrid();
        if (inputYearRef.current) inputYearRef.current.value = new Date().getFullYear();

        const handleResize = () => {
            renderGrid();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [renderGrid]);

    /* ── Seal (박제) handler → onRecord ── */
    const handleSeal = useCallback(async () => {
        const s = state.current;
        if (sealBtnRef.current?.disabled || isSealing) return;

        // [백엔드] 비로그인 유저는 로그인 바텀시트 표시
        if (!isLoggedIn) {
            setPendingSeal(true);
            setShowLoginSheet(true);
            return;
        }

        setIsSealing(true);
        triggerHaptic(50);

        console.log('Sealing prediction for stock:', stockInfo.id, 'Price:', s.currentPriceValue, 'DEPLOY_CHECK_VER_1');

        try {
            const targetXRatio = s.finalTargetDate ? 0.5 : 0.2; 
            const targetDateText = s.selectedDateText || '3개월';
            const sacredId = generateSacredId(stockInfo.symbol, user?.id, targetDateText);
            
            await submitPrediction(
                stockInfo.id,
                s.currentPriceValue,
                targetXRatio,
                0.30 + (Math.random() * 0.25),
                user?.id || null,
                targetDateText
            );

            // 성공 시 알림 없이 바로 결과 페이지로 이동
            onRecord(s.currentPriceValue);
        } catch (error) {
            console.error('CRITICAL: Failed to seal prediction:', error);
            setIsSealing(false);
            alert('박제에 실패했습니다. 다시 시도해 주세요.');
        }
    }, [onRecord, isSealing, stockInfo, state, isLoggedIn, user, profile]);

    // [백엔드] 로그인 완료 후 대기 중이던 박제 자동 재개
    useEffect(() => {
        if (isLoggedIn && pendingSeal) {
            setPendingSeal(false);
            setShowLoginSheet(false);
            handleSeal();
        }
    }, [isLoggedIn, pendingSeal, handleSeal]);

    /* ── Mode toggle (slider <-> manual) ── */
    const switchToManual = useCallback(() => {
        state.current.isManualMode = true;
        sliderHeaderRef.current?.classList.add('hidden');
        sliderUIRef.current?.classList.add('hidden');
        manualHeaderRef.current?.classList.remove('hidden');
        manualUIRef.current?.classList.remove('hidden');
        setTimeout(() => inputMonthRef.current?.focus(), 50);
    }, []);

    const switchToSlider = useCallback(() => {
        state.current.isManualMode = false;
        manualHeaderRef.current?.classList.add('hidden');
        manualUIRef.current?.classList.add('hidden');
        sliderHeaderRef.current?.classList.remove('hidden');
        sliderUIRef.current?.classList.remove('hidden');
        if (sliderRef.current) updateSliderUI(sliderRef.current.value);
    }, [updateSliderUI]);

    /* ── Manual input handlers ── */
    const handleManualInput = useCallback((e, idx) => {
        const refs = [inputYearRef, inputMonthRef, inputDayRef];
        const maxLens = [4, 2, 2];
        if (e.target.value.length >= maxLens[idx] && idx < 2) {
            refs[idx + 1].current?.focus();
        }
        validateAndSync();
    }, [validateAndSync]);

    /* ── SVG Dimension Tracker ── */
    useEffect(() => {
        const updateDims = () => {
            if (chartRef.current) {
                setChartDims({
                    width: chartRef.current.clientWidth,
                    height: chartRef.current.clientHeight
                });
            }
        };
        updateDims();
        window.addEventListener('resize', updateDims);
        return () => window.removeEventListener('resize', updateDims);
    }, []);

    // 네온 마름모(Diamond) 모양을 그리기 위한 SVG Path 데이터 (24x24 기준 중심 맞춰짐)
    const RHOMBUS_PATH = "M12 2 L22 12 L12 22 L2 12 Z";

    // 나침반 별(Compass Star) 모양 - 4각의 날카로운 별
    const COMPASS_STAR_PATH = "M12 0 L15 9 L24 12 L15 15 L12 24 L9 15 L0 12 L9 9 Z";

    /* ── Render SVG Path ── */
    const renderSvgPath = () => {
        if (!chartDims.width || !chartDims.height) return null;
        const s = state.current;
        const availableHeight = chartDims.height - (SAFE_MARGIN * 2);
        const yRange = s.axisPriceMax - s.axisPriceMin;

        // 데이터가 표시될 영역의 X축 공간 (전체의 30%)
        const PAST_AREA_RATIO = 0.3;
        const pastWidth = chartDims.width * PAST_AREA_RATIO;

        let pathD = "";
        let finalX = 0;
        let finalY = 0;

        historyData.forEach((price, idx) => {
            // X 비율 (0 ~ pastWidth)
            const xBase = (idx / (historyData.length - 1)) * pastWidth;
            // Y 위치 (getPriceY와 동일한 스케일 공식 적용)
            const yRatio = 1 - ((price - s.axisPriceMin) / yRange);
            const yBase = SAFE_MARGIN + (yRatio * availableHeight);

            // 만약 현재 차트 범위 밖으로 나가면 자르지 않고 그냥 그리되, SVG viewBox에 의해 잘림 처리됨
            const clippedY = Math.max(0, Math.min(chartDims.height, yBase));

            if (idx === 0) {
                pathD += `M ${xBase} ${clippedY}`;
            } else {
                pathD += ` L ${xBase} ${clippedY}`;
            }

            if (idx === historyData.length - 1) {
                finalX = xBase;
                finalY = clippedY;
            }
        });

        // 중앙 수평선 (현재가)의 Y좌표
        const basePriceYRatio = 1 - ((BASE_PRICE - s.axisPriceMin) / yRange);
        const centerY = SAFE_MARGIN + (basePriceYRatio * availableHeight);

        // 미래 데이터 (수직 막대 그래프) 좌표 계산
        const futureWidth = chartDims.width * (1 - PAST_AREA_RATIO);
        const barWidth = 6; // 수직 막대의 고정 너비

        const renderedBars = starsData.map((star, idx) => {
            // 막대의 중심 X 위치
            const barX = pastWidth + (star.xFutureRatio * futureWidth);
            // 막대의 목표 Y 위치
            const yRatio = 1 - ((star.priceTarget - s.axisPriceMin) / yRange);
            const targetY = SAFE_MARGIN + (yRatio * availableHeight);

            // 상향(현재가 위)인지 하향(현재가 아래)인지 판별
            const isUp = star.priceTarget >= BASE_PRICE;

            // 막대를 그리기 위한 y, height 계산 (rect는 상단(y)에서 아래로(height) 그려짐)
            // 상향: targetY가 centerY보다 작음 (더 위에 있음)
            // 하향: targetY가 centerY보다 큼 (더 아래에 있음)
            const rectY = isUp ? targetY : centerY;
            const rectHeight = Math.abs(targetY - centerY);

            // 상승은 핑크, 하락은 블루 테마
            const fill = isUp ? "#f4258c" : "#22d3ee";

            return {
                id: `bar-${idx}`,
                x: barX - (barWidth / 2),
                y: rectY,
                width: barWidth,
                height: rectHeight,
                opacity: star.opacity,
                fill: fill
            };
        });

        return { pathD, finalX, finalY, renderedBars };
    };

    const svgData = renderSvgPath();

    return (
        <>
            {/* space-bg: 전체 페이지 배경 글로우 (오리지널 HTML과 동일한 fixed 방식) */}
            {/* space-bg: 전체 페이지 배경 글로우 (오리지널 HTML과 동일한 fixed 방식) */}
            <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.05), transparent 60%), radial-gradient(circle at 80% 70%, rgba(244, 63, 94, 0.05), transparent 60%)', filter: 'blur(100px)' }}></div>

            {/* ── Sticky Header ── */}
            <DetailHeader stock={stock} basePrice={BASE_PRICE} onBack={onBack} />

            {/* ── Main Content ── */}
            <div ref={mainContentRef} className="w-full mt-6 relative z-40 pointer-events-none transition-all duration-700 ease-out">
                {/* [중앙 집중형 고정폭 영역: Dashboard & UI] */}
                <div className="mx-auto max-w-2xl px-5">
                    {/* Community Dashboard - [백엔드] 실시간 DB 데이터 */}
                    <CommunityDashboard dashboardData={dashboardData} />

                    {/* ── Distribution Summary - [백엔드] DB Function에서 반환된 데이터 ── */}
                    <DistributionSummary 
                        vowCount={dashboardData?.vowCount || 0}
                        history={dashboardData?.distribution?.history || {
                            low52: Math.round(BASE_PRICE * 0.65),
                            high52: Math.round(BASE_PRICE * 1.5),
                            current: BASE_PRICE
                        }}
                        consensus={dashboardData?.distribution?.consensus || {
                            min: Math.round(BASE_PRICE * 0.85),
                            max: Math.round(BASE_PRICE * 1.30),
                            avg: Math.round(BASE_PRICE * 1.05),
                            mode: Math.round(BASE_PRICE * 1.15)
                        }}
                    />

                    {/* Instruction */}
                    <div ref={topInstructionRef} className="text-center mb-4 transition-opacity duration-500 mt-2">
                        <p className="text-[18px] font-black text-white/40 font-brandKo uppercase tracking-widest">차트에서 원하는 목표가를 조준하세요</p>
                    </div>
                </div>

                {/* [와이드 확장 플루이드 영역: Chart Area ] */}
                <div className="mx-auto max-w-2xl md:max-w-4xl lg:max-w-7xl px-5 transition-all duration-700">
                    <section
                        ref={chartRef}
                        className="relative w-full aspect-[4/5] md:aspect-[21/9] lg:aspect-[21/9] rounded-[2.5rem] border border-white/20 overflow-hidden cursor-crosshair shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)] pointer-events-auto touch-none bg-[#08080c] transition-all duration-700 hover:border-white/30"
                        onPointerDown={(e) => onPointerDown(e, hLineTooltipRef, floatingInstructionRef)}
                        onPointerMove={(e) => onPointerMove(e, hLineTooltipRef, floatingInstructionRef)}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                    >
                        {/* SVG Background Layer (Phase 1 & Phase 10) */}
                        <div ref={svgAreaRef} className="absolute inset-0 pointer-events-none z-[1]" style={{ opacity: chartDims.width ? 1 : 0 }}>
                            <StockSvgChart 
                                chartDims={chartDims} 
                                svgData={svgData} 
                                SAFE_MARGIN={SAFE_MARGIN} 
                                BASE_PRICE={BASE_PRICE} 
                            />
                        </div>

                        {/* Dynamic Grid */}
                        <div ref={gridRef} className="absolute inset-0 z-[1] pointer-events-none opacity-100" />

                        {/* Radar Scale X-Axis container */}
                        <div className="absolute bottom-0 left-0 w-full h-6 border-t border-white/10 bg-black/40 z-10 flex">
                            {/* 0~30% 영역: 라벨 없음 */}
                            <div className="w-[30%] border-r border-white/10 relative">
                                <span className="absolute right-0 top-1 text-[8px] text-white/20 font-brandEn -translate-x-1 uppercase pr-2">Today</span>
                            </div>
                            {/* 30%~100% 영역: 기간 옵션 분배 */}
                            <div className="w-[70%] relative flex">
                                {TIME_OPTIONS.map((term, idx) => {
                                    const leftPercent = (idx / (TIME_OPTIONS.length - 1)) * 100;
                                    return (
                                        <div key={idx} className="absolute h-full flex flex-col justify-start items-center" style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}>
                                            <div className="w-[1px] h-1.5 bg-white/20" />
                                            <span className={`x-axis-label text-[10px] font-brandKo font-black uppercase text-white/30 opacity-50 mt-0.5 whitespace-nowrap transition-colors duration-300`}>
                                                {term.text}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Target H-Line (Pink) */}
                        <div ref={hLineRef} className={`absolute left-0 w-full border-t-[0.5px] border-neon-pink hidden z-20 transition-all duration-200 pointer-events-none shadow-[0_0_10px_rgba(244,37,140,0.3)] ${isSealing ? 'opacity-100' : 'opacity-80'}`}>
                            <div ref={hLineTooltipRef} className={`absolute bottom-[8px] transition-all duration-300 transform -translate-x-1/2 flex items-center gap-2 whitespace-nowrap ${isSealing ? 'scale-110' : ''}`} style={{ left: '50%' }}>
                                <span className="text-[9px] font-black text-white/60 uppercase tracking-tighter font-brandKo">목표가</span>
                                <span ref={priceLabelRef} className="text-[15px] font-black text-neon-pink font-brandEn tracking-tight drop-shadow-[0_0_8px_rgba(244,37,140,0.8)]">0</span>
                            </div>
                            <div ref={floatingInstructionRef} className="absolute top-[32px] text-white/40 font-brandKo font-black text-[20px] transition-all duration-300 transform -translate-x-1/2 whitespace-nowrap opacity-0 pointer-events-none hidden tracking-widest" style={{ left: '50%' }}>
                                하단 바에서 가격을 조준하세요
                            </div>
                        </div>

                        {/* Target V-Line (Teal) */}
                        <div ref={vLineRef} className={`absolute top-0 h-full border-l-[0.5px] border-neon-teal hidden z-10 transition-all duration-500 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,0.3)] ${isSealing ? 'opacity-100' : 'opacity-80'}`}>
                            <div ref={vLineTooltipRef} className="absolute left-0 transform -translate-x-1/2 transition-all duration-200" style={{ top: '50%' }}>
                                <div className={`absolute top-[8px] left-1/2 transform -translate-x-1/2 flex items-center gap-2 whitespace-nowrap transition-all duration-300 ${isSealing ? 'scale-110' : ''}`}>
                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-tighter font-brandKo">기간</span>
                                    <span ref={dateLabelRef} className="text-[15px] font-black text-neon-teal font-brandKo tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">3개월</span>
                                </div>
                            </div>
                        </div>

                        {/* Sacred Pin (나침반 별 조준경) */}
                        <div ref={pinRef} className="absolute hidden z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 scale-0 pointer-events-none origin-center">
                            <div className={`relative flex items-center justify-center transition-transform duration-700 ${isSealing ? 'scale-150' : 'scale-100'}`}>
                                {isSealing && (
                                    <div className="absolute w-16 h-16 border-[1px] border-white/40 rounded-full animate-[spin_3s_linear_infinite] border-dashed" />
                                )}
                                <div className="absolute w-12 h-12 bg-white/20 blur-xl rounded-full animate-ping" />
                                <div className={`w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.6)] ${isSealing ? 'shadow-[0_0_30px_rgba(255,255,255,0.8)]' : ''}`}>
                                    <span className="material-symbols-outlined text-black text-[20px] font-black" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                </div>

            {/* ── Floating Control Bar ── */}
            <TargetControlBar 
                floatingBarRef={floatingBarRef}
                floatingPriceRef={floatingPriceRef}
                currentPriceValue={state.current.currentPriceValue}
                getTickSize={getTickSize}
                updatePriceUI={updatePriceUI}
                cancelTargeting={cancelTargeting}
                openSheet={openSheet}
            />

            {/* ── Sheet Backdrop ── */}
            <div ref={backdropRef} onClick={closeSheet} className="fixed inset-0 bg-black/10 z-30 hidden opacity-0 transition-opacity duration-300 pointer-events-auto" />

            {/* ── Bottom Sheet ── */}
            <OrderBottomSheet 
                bottomSheetRef={bottomSheetRef}
                sheetContentRef={sheetContentRef}
                closeSheet={closeSheet}
                sheetPriceRef={sheetPriceRef}
                profitBadgeRef={profitBadgeRef}
                sliderHeaderRef={sliderHeaderRef}
                sliderDisplayRef={sliderDisplayRef}
                switchToManual={switchToManual}
                manualHeaderRef={manualHeaderRef}
                switchToSlider={switchToSlider}
                sliderUIRef={sliderUIRef}
                sliderRef={sliderRef}
                updateSliderUI={updateSliderUI}
                manualUIRef={manualUIRef}
                inputYearRef={inputYearRef}
                inputMonthRef={inputMonthRef}
                inputDayRef={inputDayRef}
                handleManualInput={handleManualInput}
                sealBtnRef={sealBtnRef}
                handleSeal={handleSeal}
            />

            {/* [백엔드] 박제 시점 로그인 유도 바텀시트 */}
            <LoginBottomSheet 
                isOpen={showLoginSheet}
                onClose={() => { setShowLoginSheet(false); setPendingSeal(false); }}
                onSkip={() => {
                    // 익명 박제 허용: 로그인 없이 바로 박제 진행
                    setShowLoginSheet(false);
                    setPendingSeal(false);
                    setIsSealing(true);
                    triggerHaptic(50);
                    const s = state.current;
                    const targetXRatio = s.finalTargetDate ? 0.5 : 0.2;
                    const targetDateText = s.selectedDateText || '3개월';
                    const sacredId = generateSacredId(stockInfo.symbol, null, targetDateText);

                    submitPrediction(
                        stockInfo.id,
                        s.currentPriceValue,
                        targetXRatio,
                        0.30 + (Math.random() * 0.25),
                        null,
                        targetDateText
                    ).then(() => {
                        // 익명 박제 성공 시 바로 결과 페이지로 이동 (인증서 스킵)
                        onRecord(s.currentPriceValue);
                    }).catch((err) => {
                        console.error('Anonymous seal failed:', err);
                        setIsSealing(false);
                    });
                }}
            />

                </>
    );
};

/* ── StockDetail Content Wrapper (Handles Loading UI) ── */
export const StockDetailContent = (props) => {
    const { isLoading, stockInfo } = useChartContext();

    if (isLoading || !stockInfo) {
        return (
            <div className="fixed inset-0 bg-[#08080c] flex flex-col items-center justify-center z-[1000] p-6 text-center">
                <div className="w-16 h-16 border-4 border-white/10 border-t-neon-pink rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-black text-white/90 mb-2 font-brandEn tracking-tighter uppercase italic">Scanning Ecosystem...</h2>
                <p className="text-white/40 text-[13px] font-medium leading-relaxed max-w-[240px]">
                    데이터베이스에 접속하여 실시간 <br/>종목 및 예측 데이터를 수집 중입니다.
                </p>
            </div>
        );
    }

    return <StockDetailMain {...props} />;
};

export const StockDetail = (props) => {
    return (
        <ChartProvider symbol={props.stock.symbol}>
            <StockDetailContent {...props} />
        </ChartProvider>
    );
};
