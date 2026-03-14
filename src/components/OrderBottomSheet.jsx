import React from 'react';

const OrderBottomSheet = ({
    bottomSheetRef,
    sheetContentRef,
    closeSheet,
    sheetPriceRef,
    profitBadgeRef,
    sliderHeaderRef,
    sliderDisplayRef,
    switchToManual,
    manualHeaderRef,
    switchToSlider,
    sliderUIRef,
    sliderRef,
    updateSliderUI,
    manualUIRef,
    inputYearRef,
    inputMonthRef,
    inputDayRef,
    handleManualInput,
    sealBtnRef,
    handleSeal,
    isSealing
}) => {
    return (
        <div ref={bottomSheetRef} className="fixed bottom-0 left-0 right-0 z-[60] translate-y-full transition-transform duration-500 ease-in-out">
            <div ref={sheetContentRef} className="mx-auto max-w-2xl transition-all duration-700 crystal-glass bg-[#050505]/95 rounded-t-[2.5rem] pt-3 pb-5 px-5 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative">
                {/* Close button */}
                <button onClick={closeSheet} className="absolute top-4 right-5 w-9 h-9 flex items-center justify-center text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition active:scale-95 z-10">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
                {/* Handle */}
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-3" />

                {/* Price + Date Card */}
                <div className="bg-white/5 px-4 py-3 rounded-[20px] border border-white/5 mb-3">
                    {/* Price row */}
                    <div className="flex items-end gap-3 pb-3 border-b border-white/5 mb-3">
                        <div>
                            <p className="text-[12px] text-white/70 font-black tracking-tight mb-1">성지글 도전 가격</p>
                            <p className="text-3xl font-black text-white font-brandEn tracking-tight leading-none">
                                <span ref={sheetPriceRef}>0</span>
                                <span className="text-base font-brandKo text-white/40 font-medium ml-1">원</span>
                            </p>
                        </div>
                        <div ref={profitBadgeRef} className="px-2 py-1 rounded-md text-[11px] font-black font-brandEn tracking-wider border mb-1">0.00%</div>
                    </div>

                    {/* Slider Header */}
                    <div ref={sliderHeaderRef} className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-[12px] text-white/70 font-black mb-1">존버 기한</p>
                            <p ref={sliderDisplayRef} className="text-2xl font-black text-neon-teal transition-colors duration-300 leading-none font-brandKo">3개월</p>
                        </div>
                        <button onClick={switchToManual} className="flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-white/80 transition active:scale-95 py-1 pl-4">
                            <span className="material-symbols-outlined text-[15px]">calendar_month</span> 직접 입력
                        </button>
                    </div>

                    {/* Manual Header */}
                    <div ref={manualHeaderRef} className="hidden flex justify-between items-end mb-2">
                        <div>
                            <p className="text-[10px] text-white/50 font-bold mb-0.5">목표 날짜 직접 조준</p>
                            <p className="text-2xl font-black text-neon-teal leading-none">날짜 입력</p>
                        </div>
                        <button onClick={switchToSlider} className="flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-white/80 transition active:scale-95 py-1 pl-4">
                            <span className="material-symbols-outlined text-[15px]">tune</span> 슬라이더 모드
                        </button>
                    </div>

                    {/* Slider UI */}
                    <div ref={sliderUIRef} className="relative w-full py-1">
                        <input
                            ref={sliderRef}
                            type="range"
                            className="target-slider"
                            min="0" max="9" step="1" defaultValue="5"
                            onInput={(e) => updateSliderUI(e.target.value)}
                        />
                        <div className="flex justify-between mt-1 px-1">
                            <span className="text-[9px] font-bold text-white/30">내일</span>
                            <span className="text-[9px] font-bold text-white/30">언젠가</span>
                        </div>
                    </div>

                    {/* Manual UI */}
                    <div ref={manualUIRef} className="hidden flex items-center justify-between gap-2 py-1">
                        <input ref={inputYearRef} type="number" className="date-slot w-24" placeholder="2026" min="2026" max="2100" maxLength="4" inputMode="numeric" onInput={(e) => handleManualInput(e, 0)} />
                        <span className="text-xs font-bold text-white/30">년</span>
                        <input ref={inputMonthRef} type="number" className="date-slot flex-1" placeholder="MM" min="1" max="12" maxLength="2" inputMode="numeric" onInput={(e) => handleManualInput(e, 1)} />
                        <span className="text-xs font-bold text-white/30">월</span>
                        <input ref={inputDayRef} type="number" className="date-slot flex-1" placeholder="DD" min="1" max="31" maxLength="2" inputMode="numeric" onInput={(e) => handleManualInput(e, 2)} />
                        <span className="text-xs font-bold text-white/30">일</span>
                    </div>
                </div>

                {/* Seal Button */}
                <button
                    ref={sealBtnRef}
                    onClick={handleSeal}
                    disabled={isSealing}
                    className={`w-full py-4.5 rounded-2xl font-black text-xl border border-white/20 shadow-[0_0_20px_rgba(244,37,140,0.2)] transition-all duration-500 flex items-center justify-center gap-3 ${isSealing
                        ? 'bg-white/10 text-white/40 scale-[0.98]'
                        : 'bg-gradient-to-br from-neon-teal/90 to-neon-pink/90 text-white active:scale-95'
                        }`}
                >
                    {isSealing ? (
                        <>
                            <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span>
                            조준 완료... 예언 박제 중
                        </>
                    ) : (
                        "예언 완료"
                    )}
                </button>
            </div>
        </div>
    );
};

export default OrderBottomSheet;
