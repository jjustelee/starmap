import React from 'react';

const TargetControlBar = ({ 
    floatingBarRef, 
    floatingPriceRef, 
    currentPriceValue, 
    getTickSize, 
    updatePriceUI, 
    cancelTargeting, 
    openSheet 
}) => {
    return (
        <div ref={floatingBarRef} className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-2xl transition-all duration-700 z-40 crystal-glass bg-[#050505]/95 rounded-[20px] p-2 flex items-center gap-2 translate-y-[200%] shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto">
            <button onClick={cancelTargeting} className="h-12 px-4 flex-shrink-0 flex items-center justify-center text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition active:scale-95 font-brandKo font-bold text-[13px] whitespace-nowrap">
                초기화
            </button>
            <div className="flex-1 flex flex-col items-center justify-center bg-white/5 rounded-xl border border-white/5 h-12 px-1">
                <p className="text-[9px] font-black text-white/30 tracking-tighter uppercase mb-0.5 pt-1">희망 수치 조정 중</p>
                <div className="flex items-center justify-between w-full h-full pb-1">
                    <button onClick={() => updatePriceUI(currentPriceValue - getTickSize(currentPriceValue - 1))} className="w-10 h-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition active:scale-95">
                        <span className="material-symbols-outlined text-[20px]">remove</span>
                    </button>
                    <span ref={floatingPriceRef} className="text-lg font-brandEn font-black text-white tracking-tight">0</span>
                    <button onClick={() => updatePriceUI(currentPriceValue + getTickSize(currentPriceValue))} className="w-10 h-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition active:scale-95">
                        <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                </div>
            </div>
            <button onClick={openSheet} className="h-12 px-5 flex items-center justify-center gap-2 flex-shrink-0 bg-gradient-to-br from-neon-teal/80 to-neon-pink/80 rounded-xl shadow-[0_0_15px_rgba(244,37,140,0.3)] border border-white/10 transition-all active:scale-95 group">
                <span className="text-[13px] font-black text-white whitespace-nowrap tracking-wide">예상일 선택</span>
                <span className="material-symbols-outlined text-[18px] text-white font-black group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </button>
        </div>
    );
};

export default TargetControlBar;
