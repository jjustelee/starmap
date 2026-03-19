import React from 'react';

/**
 * [백엔드 연동 가이드]
 * 1. vowCount < 30: 개척자 단계 (52주 고저 기준)
 * 2. vowCount >= 30: 합의 활성 단계 (유저 예측치 기준)
 * 3. 모든 위치(Pos) 계산: (값 - 최소값) / (최대값 - 최소값) * 100
 *
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): distribution_history(low52/high52/current), distribution_consensus(min/max/avg/mode)를 분리 조회.
 * - BACKEND_TODO(KIS): 52주 고저/현재가는 KIS 원천 동기화 후 서버 캐시 값을 사용.
 * - BACKEND_TODO(API): GET /api/v1/stocks/{symbol}/distribution-summary -> { history, consensus, vowCount }.
 */

const THRESHOLD = 30;
const STACK_THRESHOLD = 16;
const EDGE_START = 12;
const EDGE_END = 88;
const BOTTOM_STACK_THRESHOLD = 12;

const DistributionSummary = ({
    displayMode = 'default',
    vowCount = 0,
    history = { low52: 52000, high52: 110000, current: 75400 },
    consensus = { min: 64090, max: 98020, avg: 79170, mode: 86710 }
}) => {
    const isPioneer = vowCount < THRESHOLD;
    const hasRangeData = Number(history?.low52) > 0
        && Number(history?.high52) > 0
        && Number(history?.current) > 0
        && Number(history?.high52) >= Number(history?.low52);

    // [안전장치] 유효하지 않은 값 보정
    const rawCurrent = Number(history?.current ?? consensus?.mode ?? 0);
    const rawLow = Number(history?.low52 ?? history?.current ?? consensus?.min ?? rawCurrent);
    const rawHigh = Number(history?.high52 ?? history?.current ?? consensus?.max ?? rawCurrent);
    const normalizedLow = Number.isFinite(rawLow) ? rawLow : 0;
    const normalizedHigh = Number.isFinite(rawHigh) ? Math.max(rawHigh, normalizedLow) : normalizedLow;
    const normalizedCurrent = Number.isFinite(rawCurrent)
        ? Math.min(Math.max(rawCurrent, normalizedLow), normalizedHigh || rawCurrent)
        : normalizedLow;
    const safeHistory = {
        low52: normalizedLow,
        high52: normalizedHigh,
        current: normalizedCurrent
    };
    const consensusBase = normalizedCurrent > 0 ? normalizedCurrent : normalizedLow;
    const safeConsensus = {
        min: Number(consensus?.min ?? consensusBase),
        max: Number(consensus?.max ?? consensusBase),
        avg: Number(consensus?.avg ?? consensusBase),
        mode: Number(consensus?.mode ?? consensusBase)
    };

    // Helper to get percentage position along the 52-week horizontal line
    const getPos = (val) => {
        const range = safeHistory.high52 - safeHistory.low52;
        if (range <= 0) return 50;
        const percent = ((val - safeHistory.low52) / range) * 100;
        return Math.min(Math.max(percent, 0), 100);
    };

    const getMarkerLayout = (pos) => {
        if (pos < EDGE_START) return { alignItems: 'flex-start', transformX: '0' };
        if (pos > EDGE_END) return { alignItems: 'flex-end', transformX: '-100%' };
        return { alignItems: 'center', transformX: '-50%' };
    };

    const getLabelPositionStyle = (layout) => ({
        left: '0%',
        transform: `translateX(${layout.transformX})`
    });

    const formatPrice = (value) => Number(value || 0).toLocaleString();

    if (displayMode === 'rangeOnly') {
        if (!hasRangeData) {
            return (
                <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
                    <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex flex-row justify-between items-center gap-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-outlined text-neon-teal text-[24px]">timeline</span>
                                    <h4 className="text-[17px] sm:text-[20px] font-black text-white tracking-[-0.02em] leading-none whitespace-nowrap">52주 가격 맥락</h4>
                                </div>
                                <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/30 rounded text-[9px] font-black text-neon-teal uppercase tracking-widest whitespace-nowrap flex-shrink-0">Range Focus</span>
                            </div>
                            <p className="text-[11px] sm:text-[12px] text-white/45 font-medium leading-relaxed">
                                현재 시세가 52주 저점/고점 대비 어디에 있는지 빠르게 확인합니다.
                            </p>
                        </div>

                        <div className="bg-black/20 rounded-2xl border border-white/5 px-4 sm:px-5 py-6 sm:py-7 mt-6 sm:mt-8 text-center">
                            <p className="text-[13px] sm:text-[14px] font-bold text-white/72">52주 가격 데이터 준비 중</p>
                            <p className="mt-2 text-[11px] sm:text-[12px] text-white/42 font-medium">실제 저점·고점이 확인되면 이 카드에 바로 반영됩니다.</p>
                        </div>
                    </div>
                </div>
            );
        }

        const currentPos = getPos(safeHistory.current);
        const currentLayout = getMarkerLayout(currentPos);
        const lowPos = getPos(safeHistory.low52);
        const highPos = getPos(safeHistory.high52);

        return (
            <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
                <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-neon-teal text-[24px]">timeline</span>
                                <h4 className="text-[17px] sm:text-[20px] font-black text-white tracking-[-0.02em] leading-none whitespace-nowrap">52주 가격 맥락</h4>
                            </div>
                            <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/30 rounded text-[9px] font-black text-neon-teal uppercase tracking-widest whitespace-nowrap flex-shrink-0">Range Focus</span>
                        </div>
                        <p className="text-[11px] sm:text-[12px] text-white/45 font-medium leading-relaxed">
                            현재 시세가 52주 저점/고점 대비 어디에 있는지 빠르게 확인합니다.
                        </p>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5 mt-6 sm:mt-8">
                        {/* BACKEND_TODO(API): history.low52/high52/current가 null일 경우 서버에서 fallback 값을 함께 전달. */}
                        <div className="relative w-full px-2 sm:px-6 pt-12 sm:pt-16 pb-8 sm:pb-10">
                            <div className="relative w-full h-[3px] bg-white/10 rounded-full">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-history-low" />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-history-high" />

                                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${lowPos}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className="w-2.5 h-2.5 rounded-full border-2 border-history-low bg-black" />
                                </div>

                                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${highPos}%`, transform: 'translate(-50%, -50%)' }}>
                                    <div className="w-2.5 h-2.5 rounded-full border-2 border-history-high bg-black" />
                                </div>

                                <div
                                    className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out z-20"
                                    style={{
                                        left: `${currentPos}%`,
                                        transform: 'translate(-50%, -50%)',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div className="absolute bottom-full mb-4 flex-col items-inherit w-max hidden sm:flex" style={getLabelPositionStyle(currentLayout)}>
                                        <span className="text-[10px] font-black text-neon-teal mb-1 tracking-widest uppercase">현재 시세</span>
                                        <span className="text-[24px] sm:text-[28px] font-extrabold font-brandEn text-white tracking-tight">{formatPrice(safeHistory.current)}</span>
                                    </div>
                                    <div className="absolute bottom-1/2 w-[2px] h-10 sm:h-12 bg-gradient-to-t from-neon-teal to-transparent opacity-70" />
                                    <div className="w-4 h-4 bg-neon-teal rounded-full shadow-[0_0_18px_rgba(34,211,238,0.6)] border-2 border-black relative z-20" />
                                </div>
                            </div>

                            <div className="hidden sm:flex justify-between items-start mt-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-history-low uppercase mb-1">52주 최저</span>
                                    <span className="text-[15px] font-bold font-brandEn text-history-low/90">{formatPrice(safeHistory.low52)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-history-high uppercase mb-1">52주 최고</span>
                                    <span className="text-[15px] font-bold font-brandEn text-history-high/90">{formatPrice(safeHistory.high52)}</span>
                                </div>
                            </div>

                            <div className="sm:hidden mt-4 grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-history-low/20 bg-history-low/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-history-low">52주 최저</p>
                                    <p className="text-[12px] font-bold font-brandEn text-history-low/95">{formatPrice(safeHistory.low52)}</p>
                                </div>
                                <div className="rounded-xl border border-neon-teal/20 bg-neon-teal/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-neon-teal">현재</p>
                                    <p className="text-[13px] font-bold font-brandEn text-white">{formatPrice(safeHistory.current)}</p>
                                </div>
                                <div className="rounded-xl border border-history-high/20 bg-history-high/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-history-high">52주 최고</p>
                                    <p className="text-[12px] font-bold font-brandEn text-history-high/95">{formatPrice(safeHistory.high52)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isPioneer) {
        const currentPos = getPos(safeHistory.current);
        const currentLayout = getMarkerLayout(currentPos);

        return (
            <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
                <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-neon-teal text-[24px]">leaderboard</span>
                            <h4 className="text-[17px] sm:text-[20px] font-black text-white tracking-[-0.02em] leading-none">역사적 가격 좌표</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-white/40 uppercase tracking-widest">Pioneer Status</span>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5">
                        <div className="relative w-full mt-2 px-2 sm:px-6 pt-20 sm:pt-44 pb-8 sm:pb-4">
                            <div className="relative w-full h-[4px] bg-white/10 rounded-full">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>

                            <div 
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out"
                                style={{ 
                                    left: `${currentPos}%`,
                                    transform: `translate(${currentLayout.transformX}, -50%)`,
                                    alignItems: currentLayout.alignItems
                                }}
                            >
                                <div className="absolute bottom-full mb-3 sm:mb-4 flex-col items-inherit w-max pb-8 sm:pb-12 hidden sm:flex">
                                    <span className="text-[11px] font-black text-neon-teal mb-2 bg-neon-teal/10 px-3 py-1 rounded-full uppercase">현재가 위치</span>
                                    <span className="text-[32px] sm:text-[36px] font-extrabold font-brandEn text-white tracking-tighter antialiased">{formatPrice(safeHistory.current)}</span>
                                </div>
                                <div className="absolute bottom-1/2 w-[2px] h-[44px] sm:h-[60px] bg-gradient-to-t from-neon-teal to-transparent opacity-60"></div>
                                <div className="w-4 h-4 bg-neon-teal rounded-full shadow-[0_0_20px_rgba(34,211,238,0.6)] border-2 border-black relative z-20"></div>
                            </div>
                            </div>

                            <div className="hidden sm:flex justify-between items-start mt-4">
                                <div className="flex flex-col"><span className="text-[10px] font-black text-history-low uppercase mb-1">52주 최저</span><span className="text-[15px] font-bold font-brandEn text-history-low/80">{formatPrice(safeHistory.low52)}</span></div>
                                <div className="flex flex-col items-end"><span className="text-[10px] font-black text-history-high uppercase mb-1">52주 최고</span><span className="text-[15px] font-bold font-brandEn text-history-high/80">{formatPrice(safeHistory.high52)}</span></div>
                            </div>

                            <div className="sm:hidden mt-4 grid grid-cols-3 gap-2">
                                <div className="rounded-xl border border-history-low/20 bg-history-low/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-history-low">52주 최저</p>
                                    <p className="text-[13px] font-bold font-brandEn text-history-low/90">{formatPrice(safeHistory.low52)}</p>
                                </div>
                                <div className="rounded-xl border border-neon-teal/20 bg-neon-teal/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-neon-teal">현재가</p>
                                    <p className="text-[14px] font-bold font-brandEn text-white">{formatPrice(safeHistory.current)}</p>
                                </div>
                                <div className="rounded-xl border border-history-high/20 bg-history-high/5 px-2 py-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-history-high">52주 최고</p>
                                    <p className="text-[13px] font-bold font-brandEn text-history-high/90">{formatPrice(safeHistory.high52)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const avgPos = getPos(safeConsensus.avg);
    const modePos = getPos(safeConsensus.mode);
    const lowPos = getPos(safeHistory.low52);
    const highPos = getPos(safeHistory.high52);
    const minPos = getPos(safeConsensus.min);
    const maxPos = getPos(safeConsensus.max);
    const avgLayout = getMarkerLayout(avgPos);
    const modeLayout = getMarkerLayout(modePos);
    const lowLayout = getMarkerLayout(lowPos);
    const highLayout = getMarkerLayout(highPos);
    const minLayout = getMarkerLayout(minPos);
    const maxLayout = getMarkerLayout(maxPos);
    const isStacked = Math.abs(modePos - avgPos) <= STACK_THRESHOLD;
    const isMinNearLow = Math.abs(minPos - lowPos) <= BOTTOM_STACK_THRESHOLD;
    const isMaxNearHigh = Math.abs(maxPos - highPos) <= BOTTOM_STACK_THRESHOLD;

    return (
        <div className="w-full relative mt-4 mb-6 pointer-events-auto transition-all duration-700">
            <div className="bg-[#141419]/90 backdrop-blur-[40px] border border-white/10 rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 relative overflow-visible shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.8)]">
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-premium-rose text-[24px]">groups</span>
                            <h4 className="text-[17px] sm:text-[20px] font-black text-white tracking-[-0.02em] leading-none whitespace-nowrap">예측 분포 요약</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-premium-rose/10 border border-premium-rose/30 rounded text-[9px] font-black text-premium-rose uppercase tracking-widest whitespace-nowrap flex-shrink-0 italic">Consensus Active</span>
                    </div>
                    <p className="text-[11px] sm:text-[12px] text-white/45 font-medium leading-relaxed">
                        커뮤니티가 입력한 목표가 분포를 52주 축 위에서 비교합니다.
                    </p>
                </div>

                <div className="bg-black/20 rounded-2xl border border-white/5 px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5 mt-6 sm:mt-8">
                    <div className={`relative w-full px-2 sm:px-6 pt-12 sm:pt-[15rem] ${isStacked ? 'pb-6 sm:pb-24' : 'pb-6 sm:pb-20'}`}>
                        <div className="relative w-full h-[3px] bg-white/10 rounded-full">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20"></div>

                        <div
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col opacity-70 sm:opacity-100"
                            style={{
                                left: `${lowPos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className="w-[2px] h-3 sm:h-4 bg-history-low shadow-[0_0_8px_rgba(14,165,233,0.4)]"></div>
                            <div className="absolute top-5 flex-col items-inherit w-max opacity-80 hidden sm:flex" style={getLabelPositionStyle(lowLayout)}>
                                <span className="text-[8px] font-black text-history-low uppercase">52주 최저</span>
                                <span className="text-[12px] font-bold font-brandEn text-history-low">{formatPrice(safeHistory.low52)}</span>
                            </div>
                        </div>

                        <div
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col opacity-70 sm:opacity-100"
                            style={{
                                left: `${highPos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className="w-[2px] h-3 sm:h-4 bg-history-high shadow-[0_0_8px_rgba(251,191,36,0.4)]"></div>
                            <div className="absolute top-5 flex-col items-inherit w-max opacity-80 hidden sm:flex" style={getLabelPositionStyle(highLayout)}>
                                <span className="text-[8px] font-black text-history-high uppercase">52주 최고</span>
                                <span className="text-[12px] font-bold font-brandEn text-history-high">{formatPrice(safeHistory.high52)}</span>
                            </div>
                        </div>

                        <div
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-1000 ease-out z-10"
                            style={{
                                left: `${avgPos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className={`absolute w-max hidden sm:flex flex-col items-inherit bottom-full ${isStacked ? 'mb-10' : 'mb-4'}`} style={getLabelPositionStyle(avgLayout)}>
                                <span className="text-[10px] font-black text-white/45 mb-1 tracking-widest uppercase">평균 예측가</span>
                                <span className="text-[18px] sm:text-[20px] font-bold font-brandEn text-white antialiased">{formatPrice(safeConsensus.avg)}</span>
                            </div>
                            <div className="absolute bottom-1/2 w-[1.5px] h-10 sm:h-12 border-l border-dashed border-white/40"></div>
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-black relative z-10"></div>
                        </div>

                        <div 
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out z-20" 
                            style={{ 
                                left: `${modePos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className="absolute bottom-full mb-4 flex-col items-inherit w-max pb-16 sm:pb-24 hidden sm:flex" style={getLabelPositionStyle(modeLayout)}>
                                <span className="text-[11px] font-black text-premium-rose mb-2 bg-premium-rose/10 px-3 py-1 rounded-full border border-premium-rose/20 uppercase tracking-widest">최다 예상</span>
                                <span className="text-[32px] sm:text-[44px] font-extrabold font-brandEn text-white tracking-tighter leading-none antialiased">{formatPrice(safeConsensus.mode)}</span>
                            </div>
                            <div className="absolute bottom-1/2 w-[2.5px] h-[54px] sm:h-[110px] bg-gradient-to-t from-premium-rose to-transparent"></div>
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-premium-rose rounded-full shadow-[0_0_30px_rgba(244,63,94,0.8)] relative z-20 flex items-center justify-center border-2 border-black">
                                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full"></div>
                            </div>
                        </div>

                        {/* Min Prediction Marker */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out z-10"
                            style={{
                                left: `${minPos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className="absolute top-1/2 w-[1.5px] h-10 sm:h-12 border-l border-dashed border-pred-min/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-pred-min/80 bg-black relative z-10"></div>
                            <div className={`absolute hidden sm:flex flex-col items-inherit w-max ${isMinNearLow ? 'top-full mt-16' : 'top-full mt-10'}`} style={getLabelPositionStyle(minLayout)}>
                                <span className="text-[8px] font-black text-pred-min uppercase tracking-widest">최저 예측</span>
                                <span className="text-[12px] font-bold font-brandEn text-pred-min">{formatPrice(safeConsensus.min)}</span>
                            </div>
                        </div>

                        {/* Max Prediction Marker */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col transition-all duration-1000 ease-out z-10"
                            style={{
                                left: `${maxPos}%`,
                                transform: 'translate(-50%, -50%)',
                                alignItems: 'center'
                            }}
                        >
                            <div className="absolute top-1/2 w-[1.5px] h-10 sm:h-12 border-l border-dashed border-pred-max/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full border-2 border-pred-max/80 bg-black relative z-10"></div>
                            <div className={`absolute hidden sm:flex flex-col items-inherit w-max ${isMaxNearHigh ? 'top-full mt-16' : 'top-full mt-10'}`} style={getLabelPositionStyle(maxLayout)}>
                                <span className="text-[8px] font-black text-pred-max uppercase tracking-widest">최고 예측</span>
                                <span className="text-[12px] font-bold font-brandEn text-pred-max">{formatPrice(safeConsensus.max)}</span>
                            </div>
                        </div>
                    </div>
                    </div>

                    <div className="sm:hidden mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-premium-rose/20 bg-premium-rose/10 px-3 py-2.5">
                            <p className="text-[10px] font-black text-premium-rose uppercase tracking-widest">최다 예상</p>
                            <p className="mt-1 text-[30px] leading-none font-extrabold font-brandEn text-white tracking-tight">{formatPrice(safeConsensus.mode)}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[10px] font-black text-white/55 uppercase tracking-widest">평균 예측가</p>
                            <p className="mt-2 text-[22px] leading-none font-bold font-brandEn text-white">{formatPrice(safeConsensus.avg)}</p>
                        </div>
                        <div className="col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black text-pred-min uppercase tracking-widest">최저 예측</p>
                                <p className="text-[14px] font-bold font-brandEn text-pred-min">{formatPrice(safeConsensus.min)}</p>
                            </div>
                            <div className="h-8 w-px bg-white/10"></div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-pred-max uppercase tracking-widest">최고 예측</p>
                                <p className="text-[14px] font-bold font-brandEn text-pred-max">{formatPrice(safeConsensus.max)}</p>
                            </div>
                        </div>
                        <div className="col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black text-history-low uppercase tracking-widest">52주 최저</p>
                                <p className="text-[14px] font-bold font-brandEn text-history-low">{formatPrice(safeHistory.low52)}</p>
                            </div>
                            <div className="h-8 w-px bg-white/10"></div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-history-high uppercase tracking-widest">52주 최고</p>
                                <p className="text-[14px] font-bold font-brandEn text-history-high">{formatPrice(safeHistory.high52)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DistributionSummary;
