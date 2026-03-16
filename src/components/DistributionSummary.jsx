import React from 'react';

/**
 * [백엔드 연동 가이드]
 * 1. vowCount < 30: 개척자 단계 (52주 고저 기준)
 * 2. vowCount >= 30: 합의 활성 단계 (유저 예측치 기준)
 * 3. 모든 위치(Pos) 계산: (값 - 최소값) / (최대값 - 최소값) * 100
 */

const THRESHOLD = 30;

const DistributionSummary = ({
    vowCount = 0,
    history = { low52: 52000, high52: 110000, current: 75400 },
    consensus = { min: 64090, max: 98020, avg: 79170, mode: 86710 }
}) => {
    const isPioneer = vowCount < THRESHOLD;

    // [안전장치] 유효하지 않은 값 보정
    const safeHistory = {
        low52: history?.low52 || 50000,
        high52: history?.high52 || 100000,
        current: history?.current || 75000
    };
    const safeConsensus = {
        min: consensus?.min || 60000,
        max: consensus?.max || 100000,
        avg: consensus?.avg || 80000,
        mode: consensus?.mode || 85000
    };

    // Helper to get percentage position along the 52-week horizontal line
    const getPos = (val) => {
        const range = safeHistory.high52 - safeHistory.low52;
        if (range <= 0) return 50;
        const percent = ((val - safeHistory.low52) / range) * 100;
        return Math.min(Math.max(percent, 0), 100);
    };

    if (isPioneer) {
        return (
            <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
                <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-3xl p-6 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-neon-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                            <h4 className="text-[20px] font-[800] text-white tracking-[-0.02em] leading-none">역사적 가격 좌표</h4>
                        </div>
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-black text-white/40 uppercase tracking-widest">개척자 단계</span>
                    </div>
                    <div className="relative w-full pt-44 pb-4 mt-6 px-8">
                        <div className="relative w-full h-[4px] bg-white/10 rounded-full">
                            {/* Bar Edge Ticks */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                            
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out"
                                style={{ 
                                    left: `${getPos(safeHistory.current)}%`,
                                    transform: `translate(${getPos(safeHistory.current) < 10 ? '0' : getPos(safeHistory.current) > 90 ? '-100%' : '-50%'}, -50%)`,
                                    alignItems: getPos(safeHistory.current) < 10 ? 'flex-start' : getPos(safeHistory.current) > 90 ? 'flex-end' : 'center'
                                }}
                            >
                                <div className="absolute bottom-full mb-4 flex flex-col items-inherit w-max pb-12">
                                    <span className="text-[11px] font-black text-neon-teal mb-2 bg-neon-teal/10 px-3 py-1 rounded-full uppercase">현재가 위치</span>
                                    <span className="text-[36px] font-extrabold font-brandEn text-white tracking-tighter antialiased">{safeHistory.current.toLocaleString()}</span>
                                </div>
                                <div className="absolute bottom-1/2 w-[2px] h-[60px] bg-gradient-to-t from-neon-teal to-transparent opacity-60"></div>
                                <div className="w-4 h-4 bg-neon-teal rounded-full shadow-[0_0_20px_rgba(34,211,238,0.6)] border-2 border-black relative z-20"></div>
                            </div>
                        </div>
                        <div className="flex justify-between items-start mt-4">
                            <div className="flex flex-col"><span className="text-[10px] font-black text-history-low uppercase mb-1">52주 최저</span><span className="text-[15px] font-bold font-brandEn text-history-low/80">{safeHistory.low52.toLocaleString()}</span></div>
                            <div className="flex flex-col items-end"><span className="text-[10px] font-black text-history-high uppercase mb-1">52주 최고</span><span className="text-[15px] font-bold font-brandEn text-history-high/80">{safeHistory.high52.toLocaleString()}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
            <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <svg className="w-5 h-5 text-premium-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        <h4 className="text-[18px] sm:text-[20px] font-[800] text-white tracking-[-0.02em] leading-none whitespace-nowrap">예측 분포 요약</h4>
                    </div>
                    <span className="px-2 py-1 bg-premium-rose/10 border border-premium-rose/30 rounded text-[9px] sm:text-[10px] font-black text-premium-rose uppercase tracking-widest whitespace-nowrap flex-shrink-0">커뮤니티 합의 활성</span>
                </div>

                <div className="relative w-full pt-32 pb-6 mt-4 px-8">
                    <div className="relative w-full h-[3px] bg-white/10 rounded-full">
                        {/* Bar Edge Ticks */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                        {/* 52 Week Low Marker */}
                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-70 sm:opacity-100" style={{ left: `${getPos(safeHistory.low52)}%` }}>
                            <div className="w-[2px] h-4 bg-history-low shadow-[0_0_8px_rgba(14,165,233,0.4)]"></div>
                            <div className="absolute top-6 flex flex-col items-center w-max opacity-80">
                                <span className="text-[9px] font-black text-history-low uppercase">52주 최저</span>
                                <span className="text-[12px] font-bold font-brandEn text-history-low">{safeHistory.low52.toLocaleString()}</span>
                            </div>
                        </div>
                        {/* 52 Week High Marker */}
                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-70 sm:opacity-100" style={{ left: `${getPos(safeHistory.high52)}%` }}>
                            <div className="w-[2px] h-4 bg-history-high shadow-[0_0_8px_rgba(251,191,36,0.4)]"></div>
                            <div className="absolute top-6 flex flex-col items-center w-max opacity-80">
                                <span className="text-[9px] font-black text-history-high uppercase">52주 최고</span>
                                <span className="text-[12px] font-bold font-brandEn text-history-high">{safeHistory.high52.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Average Marker */}
                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ease-out z-10" style={{ left: `${getPos(safeConsensus.avg)}%` }}>
                            <div className="absolute bottom-full mb-4 flex flex-col items-center w-max pb-10">
                                <span className="text-[10px] font-black text-white/40 mb-1.5 tracking-widest uppercase">평균 예측가</span>
                                <span className="text-[20px] font-bold font-brandEn text-white antialiased">{safeConsensus.avg.toLocaleString()}</span>
                            </div>
                            <div className="absolute bottom-1/2 w-[1.5px] h-12 border-l border-dashed border-white/40"></div>
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-black relative z-10"></div>
                        </div>

                        {/* Mode Marker */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out z-20" 
                            style={{ 
                                left: `${getPos(safeConsensus.mode)}%`,
                                transform: `translate(${getPos(safeConsensus.mode) < 15 ? '0' : getPos(safeConsensus.mode) > 85 ? '-100%' : '-50%'}, -50%)`,
                                alignItems: getPos(safeConsensus.mode) < 15 ? 'flex-start' : getPos(safeConsensus.mode) > 85 ? 'flex-end' : 'center'
                            }}
                        >
                            <div className="absolute bottom-full mb-4 flex flex-col items-inherit w-max pb-24">
                                <span className="text-[11px] font-black text-premium-rose mb-2 bg-premium-rose/10 px-3 py-1 rounded-full border border-premium-rose/20 uppercase tracking-widest">최다 예상</span>
                                <span className="text-[40px] sm:text-[44px] font-extrabold font-brandEn text-white tracking-tighter leading-none antialiased">{safeConsensus.mode.toLocaleString()}</span>
                            </div>
                            <div className="absolute bottom-1/2 w-[2.5px] h-[110px] bg-gradient-to-t from-premium-rose to-transparent"></div>
                            <div className="w-5 h-5 bg-premium-rose rounded-full shadow-[0_0_30px_rgba(244,63,94,0.8)] relative z-20 flex items-center justify-center border-2 border-black">
                                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    {/* Min/Max Forecast Labels */}
                    <div className="flex justify-between items-start mt-6 italic">
                        <div className="flex flex-col items-start translate-y-2" style={{ width: 'max-content' }}>
                            <span className="text-[10px] font-black text-pred-min uppercase tracking-widest">최저 예측</span>
                            <span className="text-[14px] font-bold font-brandEn text-pred-min opacity-80">{safeConsensus.min.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-end translate-y-2" style={{ width: 'max-content' }}>
                            <span className="text-[10px] font-black text-pred-max uppercase tracking-widest">최고 예측</span>
                            <span className="text-[14px] font-bold font-brandEn text-pred-max opacity-80">{safeConsensus.max.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DistributionSummary;
