import React from 'react';

/* ──────────────────────────────────────────
   [BACKEND API 연동 규격서 및 데이터 산출 공식]
   ──────────────────────────────────────────
   [API 개요]
   * Endpoint: GET /api/v1/stocks/{stock_code}/community-dashboard
   
   [1. Mode 스위칭 기준 (Threshold)]
   * vowCount (현재까지 목표가를 등록한 유저 수)
   * IF vowCount < 30 -> "PIONEER" 모드 반환
   * IF vowCount >= 30 -> "CONSENSUS" 모드 반환

   [2. PIONEER 모드 필드 상세 (시장 지표 위주)]
   * market.rsi (Integer): 14일 기준 RSI 값 (0~100)
   * market.supply (Integer): 최근 5일간 외인+기관 순매수 대금 / 전체 거래대금 * 100 (0~100%)
   * market.level52 (Integer): 52주 고저점 대비 현재가 위치
     > 산출 공식: ((현재가 - 52주 최저가) / (52주 최고가 - 52주 최저가)) * 100
   * market.gap52 (Integer): 52주 최고가 - 현재가 (절대값 반환, 프론트에서 '-' 붙임)

   [3. CONSENSUS 모드 필드 상세 (유저 투표 위주)]
   * vote.avgPrice (Integer): 유저들이 입력한 목표가의 산술 평균 (소수점 버림)
   * vote.bullRate (Integer): (목표가 > 현재가)인 유저의 비율 (0~100%)
   * vote.bearRate (Integer): 100 - bullRate (또는 목표가 <= 현재가 비율)
   * vote.harmony (Integer): 의견 일치도 점수 (0~100)
     > 산출 제안: 100 - (목표가들의 표준편차 / 평균목표가 * 100) -> 변동계수 역산
     > UI 연동 가이드: 0~25(1칸), 26~50(2칸), 51~75(3칸), 76~100(4칸 점등)
   * vote.term (String): 유저들이 가장 많이 선택한 도달 기한 (최빈값. 예: "3개월")
────────────────────────────────────────── */

const getRsiVibeText = (rsi) => {
    if (rsi >= 70) return "데일 듯한 과열 (매도 주의)";
    if (rsi <= 30) return "저체온증 주의 (과매도 구간)";
    return "딱 적당히 미지근함";
};

/**
 * CommunityDashboard Component
 * [백엔드] Supabase DB Function에서 가져온 실시간 데이터를 표시합니다.
 * dashboardData는 ChartContext를 통해 전달됩니다.
 */
const CommunityDashboard = ({ dashboardData }) => {
    // 데이터가 없으면 로딩 표시
    if (!dashboardData) {
        return (
            <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] p-6 border border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden mb-6 pointer-events-auto">
                <div className="flex items-center justify-center gap-3 py-8">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-neon-teal rounded-full animate-spin"></div>
                    <p className="text-white/40 text-sm font-bold">커뮤니티 데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    const data = dashboardData;

    if (data.mode === "PIONEER") {
        return (
            <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] p-6 border border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden mb-6 pointer-events-auto">
                <div className="relative z-10 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-neon-teal rounded-full"></div>
                            <p className="text-[13px] font-black text-neon-teal tracking-[0.3em] uppercase">Pioneer Status</p>
                        </div>
                        <h3 className="text-[22px] font-black text-white leading-tight font-brandKo">
                            아직은 빈집입니다.<br />먼저 깃발 꽂는 개미가 임자!
                        </h3>
                        <div className="bg-white/10 rounded-2xl p-5 border-l-4 border-neon-teal shadow-2xl">
                            <p className="text-[14px] font-bold text-white/95 leading-relaxed">
                                "동료들의 화력이 모이기 전입니다. 아래 지표로 분위기 먼저 파악하고 성지글 빌드업 시작하시죠."
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-lg font-black text-white tracking-tight">개미 체감 온도 (RSI)</span>
                            <span className="text-[14px] font-black text-neon-teal bg-neon-teal/20 px-3 py-1 rounded-md border border-neon-teal/30">{getRsiVibeText(data.market.rsi)}</span>
                        </div>
                        <div className="h-10 w-full bg-white/5 rounded-sm p-1 border border-white/10 overflow-hidden relative skew-x-[-2deg]">
                            <div className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-neon-teal rounded-sm transition-all duration-700 ease-out flex items-center justify-end px-3" style={{ width: `${data.market.rsi}%` }}>
                                <span className="text-white font-brandEn font-black text-xl drop-shadow-md">{data.market.rsi}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/60 rounded-2xl p-7 border border-white/15 space-y-8 shadow-inner">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-[15px] font-black text-white/70 tracking-wide flex items-center gap-1.5">
                                    구조대 위치 <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full uppercase font-black">Resistance</span>
                                </p>
                                <p className="text-4xl font-black text-white font-brandEn tracking-tighter">-{data.market.gap52.toLocaleString()}</p>
                            </div>
                            <div className="text-right space-y-2">
                                <p className="text-[15px] font-black text-white/70 tracking-wide flex items-center justify-end gap-1.5">
                                    <span className="text-[11px] bg-neon-teal/20 text-neon-teal px-2 py-0.5 rounded-full uppercase font-black tracking-tighter">Floor</span> 현재 층수
                                </p>
                                <p className="text-4xl font-black text-neon-teal font-brandEn italic tracking-tighter drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">LV. {data.market.level52}</p>
                            </div>
                        </div>
                        <div className="h-[1px] w-full bg-white/10"></div>
                        <div className="space-y-5">
                            <div className="flex justify-between items-end">
                                <p className="text-lg font-black text-white tracking-tight">주포들 매집 화력 <span className="text-xs text-white/50 ml-1 font-normal">(최근 5일)</span></p>
                                <span className="text-3xl font-black text-neon-teal font-brandEn leading-none drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{data.market.supply}%</span>
                            </div>
                            <div className="flex items-center gap-1 h-6">
                                {/* Segmented Block Graph */}
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className={`flex-1 h-full skew-x-[-10deg] rounded-sm transition-all duration-500 ${i < Math.round(data.market.supply / 10) ? 'bg-neon-teal shadow-[0_0_5px_rgba(34,211,238,0.3)]' : 'bg-white/5 border border-white/10'}`}></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-2xl rounded-[32px] p-6 border border-neon-teal/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden mb-6 pointer-events-auto">
            <div className="relative z-10 space-y-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-neon-pink rounded-full animate-pulse"></div>
                        <p className="text-[13px] font-black text-neon-pink tracking-[0.2em] uppercase italic">Consensus Active</p>
                    </div>
                    <h3 className="text-[22px] font-black text-white leading-tight">대동단결 완료!</h3>
                </div>

                <div className="py-12 border-y border-white/5 bg-white/[0.01]">
                    <div className="flex flex-col items-center justify-center text-center space-y-6 mb-6">
                        <div className="flex items-baseline justify-center gap-4 w-full px-2">
                            <span className="text-[20px] font-black text-white whitespace-nowrap hidden sm:block">희망회로 돌린 가격</span>
                            <h2 className="text-[72px] font-black text-neon-pink font-brandEn tracking-tighter leading-none drop-shadow-[0_0_25px_rgba(244,37,140,0.35)]">{data.vote.avgPrice.toLocaleString()}</h2>
                            <span className="text-[14px] font-black text-white/30 italic whitespace-nowrap hidden sm:block">(뇌피셜 99.9%)</span>
                        </div>
                        {/* Mobile version */}
                        <div className="sm:hidden flex flex-col items-center gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[16px] font-black text-white">희망회로 돌린 가격</span>
                                <span className="text-[11px] font-black text-white/30 italic">(뇌피셜 99.9%)</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-black text-white font-brandEn border-b-2 border-neon-pink/40 pb-1 px-1 tracking-widest">+22.5%</span>
                            <span className="text-xs font-black text-neon-pink/60 uppercase tracking-widest">UP</span>
                        </div>
                    </div>
                    <p className="text-[15px] font-bold text-white/60 tracking-tight text-center">전우 <span className="text-white font-black text-lg mx-0.5">{data.vowCount}명</span>의 상상력이 모였습니다.</p>
                    <p className="mt-6 text-[12px] font-black text-white/50 tracking-tight text-center">
                        * 본 수치는 사용자들의 상상력을 합산한 결과이며, 실제 투자 수익을 보장하지 않습니다.
                    </p>
                </div>

                <div className="space-y-6">
                    <p className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-neon-teal">swords</span>
                        커뮤니티 파이트 게이지
                    </p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-end font-brandKo font-black px-1">
                            <span className="text-[16px] text-neon-teal tracking-wide flex items-center gap-1.5">가즈아 <span className="font-brandEn text-2xl ml-1">{data.vote.bullRate}%</span></span>
                            <span className="text-[16px] text-neon-pink tracking-wide flex items-center gap-1.5"><span className="font-brandEn text-2xl mr-1">{data.vote.bearRate}%</span> 돔황차</span>
                        </div>
                        {/* Blocky Fight Gauge */}
                        <div className="h-10 w-full bg-white/5 p-1 border border-white/10 shadow-inner flex skew-x-[−2deg]">
                            <div className="h-full bg-neon-teal transition-all duration-700 ease-in-out border-r-4 border-black box-content flex items-center pl-3" style={{ width: `${data.vote.bullRate}%` }}>
                                {/* Optional inner detail */}
                                <div className="w-full h-[2px] bg-white/30 truncate"></div>
                            </div>
                            <div className="h-full bg-neon-pink transition-all duration-700 ease-in-out flex items-center justify-end pr-3" style={{ width: `${data.vote.bearRate}%` }}>
                                <div className="w-full h-[2px] bg-white/30 truncate"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                    <div className="bg-black/60 rounded-2xl p-6 border border-white/10 space-y-5">
                        <p className="text-[15px] font-black text-white/70 tracking-wide flex items-center gap-2">
                            <span className="w-1 h-3 bg-neon-teal rounded-full"></span>
                            우리팀 단합력
                        </p>
                        <div className="flex items-end gap-2 h-10">
                            <div className="flex-1 bg-white/10 h-[40%] rounded-md"></div>
                            <div className="flex-1 bg-white/20 h-[65%] rounded-md hover:h-[70%] transition-all"></div>
                            <div className="flex-1 bg-white/40 h-[85%] rounded-md"></div>
                            <div className="flex-1 bg-neon-teal h-[100%] rounded-md shadow-[0_0_10px_rgba(34,211,238,0.4)]"></div>
                        </div>
                    </div>
                    <div className="bg-black/40 rounded-[1.5rem] p-6 border border-white/5 space-y-3 flex flex-col justify-center items-center text-center transition-all duration-500 hover:border-white/10">
                        <p className="text-[14px] font-black text-white/50 tracking-wider">예상 탈출 시기</p>
                        <p className="text-3xl font-black text-white font-brandKo leading-tight">
                            {data.vote.term} <span className="text-xl">내에</span><br />
                            <span className="text-neon-teal text-[12px] font-black bg-neon-teal/5 px-4 py-1.5 rounded-full mt-3 inline-block border border-neon-teal/10">수익인증 가능?</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityDashboard;
