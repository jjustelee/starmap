import { useCallback } from 'react';

const PIXELS_PER_TICK = 5;

// Tick size logic
function getTickSize(price) {
    if (price < 1000) return 1;
    if (price < 5000) return 5;
    if (price < 10000) return 10;
    if (price < 50000) return 50;
    if (price < 100000) return 100;
    if (price < 500000) return 500;
    return 1000;
}

/**
 * useChartInteraction
 * - Pointer event handler들을 캡슐화합니다.
 * - getPriceY / getYPrice 는 컴포넌트 내부에서 정의되어 외부로부터 주입받습니다.
 */
export function useChartInteraction({
    chartRef,
    state,
    updatePriceUI,
    getYPrice,
    startTargeting,
    syncSheetPosition
}) {

    const onPointerDown = useCallback((e, hLineTooltipRef, floatingInstructionRef) => {
        const s = state.current;
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        let xPct = Math.max(15, Math.min(85, (x / rect.width) * 100));
        
        if (hLineTooltipRef?.current) hLineTooltipRef.current.style.left = xPct + '%';
        if (floatingInstructionRef?.current) floatingInstructionRef.current.style.left = xPct + '%';

        updatePriceUI(getYPrice(y));
        s.isDragging = true;
        s.dragStartY = e.clientY;
        s.dragStartPrice = s.currentPriceValue;
        chartRef.current.setPointerCapture(e.pointerId);
        
        if (!s.isTargeting) startTargeting();

        // 시트가 열린 상태에서 가격 재조정 → 핀·스크롤 보정 재동기화
        if (s.isSheetOpen) {
            syncSheetPosition();
        }
    }, [chartRef, state, updatePriceUI, getYPrice, startTargeting, syncSheetPosition]);

    const onPointerMove = useCallback((e, hLineTooltipRef, floatingInstructionRef) => {
        const s = state.current;
        if (!s.isDragging || !chartRef.current) return;
        
        const rect = chartRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let xPct = Math.max(15, Math.min(85, (x / rect.width) * 100));
        
        if (hLineTooltipRef?.current) hLineTooltipRef.current.style.left = xPct + '%';
        if (floatingInstructionRef?.current) floatingInstructionRef.current.style.left = xPct + '%';

        const deltaY = s.dragStartY - e.clientY;
        const tick = getTickSize(s.dragStartPrice);
        const ticksToMove = Math.round(deltaY / PIXELS_PER_TICK);
        let newPrice = s.dragStartPrice + (ticksToMove * tick);
        newPrice = Math.max(0, newPrice);
        
        updatePriceUI(newPrice);

        // 시트 열린 상태에서 드래그 → 스크롤 보정 재동기화
        if (s.isSheetOpen) syncSheetPosition();
    }, [chartRef, state, updatePriceUI, syncSheetPosition]);

    const onPointerUp = useCallback((e) => {
        state.current.isDragging = false;
        chartRef.current?.releasePointerCapture(e.pointerId);
    }, [chartRef, state]);
    
    const onPointerCancel = onPointerUp;

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
    };
}
