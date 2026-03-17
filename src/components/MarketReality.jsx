import React, { useState } from 'react';

/**
 * 지표별 해석 가이드 설명 데이터
 */
const INDICATOR_METADATA = {
    supply: {
        title: "수급 에너지 해석 가이드",
        description: "시장 주도세력(외인/기관)이 콕콕 찍은 종목인지 확인합니다. 수급이 뒷받침되어야 상승 에너지가 지속될 수 있습니다.",
        formulaLabel: "(최근 5일 외인 순매수 + 기관 순매수) 합계",
    },
    fundamental: {
        title: "기업 기본 체력 해석 가이드",
        description: "돈을 얼마나 잘 벌고(영업이익률), 빚(부채비율)은 적은지 체크하여 튼튼한 회사인지 판별합니다.",
        formulaLabel: "영업이익률 10%↑ & 부채 100%↓ 기준",
    },
    value: {
        title: "가치 평가 해석 가이드",
        description: "동종 업계 평균과 비교하여 현재 주가가 실적 대비 싼지 비싼지 판단합니다.",
        formulaLabel: "(현재 PER ÷ 업종 평균 PER) × 100",
    },
    risk: {
        title: "시장 위험성 해석 가이드",
        description: "지수 변동 대비 이 종목이 얼마나 민감하게 반응하는지 보여줍니다.",
        formulaLabel: "베타(β) 계수 (시장 변동 대비 민감도)",
    }
};

/**
 * 숫자를 읽기 쉬운 단위(억)로 변환
 */
const formatValue = (val) => {
    if (Math.abs(val) >= 1000000) {
        return `${(val / 1000000).toFixed(1)}억`;
    }
    return val.toLocaleString();
};

/**
 * 지표별 시각적 게이지 및 값 표시 컴포넌트
 */
const MetricGauge = ({ type, data }) => {
    if (type === 'supply') {
        const energyRaw = data.supply_5d || 0;
        const energy = Math.min(10, Math.max(0, (energyRaw / 1000000) + 5));
        return (
            <div className="flex flex-col items-end gap-1.5 min-w-[76px] min-[380px]:min-w-[100px]">
                <div className="flex gap-0.5 h-1 w-full justify-end">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-2 rounded-full transition-all duration-700 ${i < energy ? 'bg-neon-teal shadow-[0_0_8px_#22d3ee]' : 'bg-white/10'}`}
                        />
                    ))}
                </div>
                <span className="text-[10px] font-black text-neon-teal/80 bg-neon-teal/10 px-1.5 py-0.5 rounded-md border border-neon-teal/20">
                    {energyRaw > 0 ? '+' : ''}{formatValue(energyRaw)}
                </span>
            </div>
        );
    }
    if (type === 'fundamental') {
        const isSafe = data.op_margin >= 10 && data.debt_ratio <= 100;
        return (
            <div className="flex flex-col items-end gap-1.5 min-w-[76px] min-[380px]:min-w-[100px]">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                        className={`absolute left-0 top-0 h-full transition-all duration-1000 ${isSafe ? 'w-full bg-neon-teal shadow-[0_0_8px_#22d3ee]' : 'w-1/2 bg-yellow-400'}`}
                    />
                </div>
                <div className="flex gap-2">
                    <span className="text-[10px] font-black text-white/50">이익 {data.op_margin}%</span>
                    <span className="text-[10px] font-black text-white/50">부채 {data.debt_ratio}%</span>
                </div>
            </div>
        );
    }
    if (type === 'value') {
        const per = Number(data.per) || 0;
        const indPer = Number(data.ind_area_per) || 1;
        const ratio = per / indPer;
        const pos = Math.min(90, Math.max(10, (ratio / 2) * 100));
        return (
            <div className="flex flex-col items-end gap-1.5 min-w-[76px] min-[380px]:min-w-[100px]">
                <div className="w-full h-1 bg-white/10 rounded-full relative">
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/30 z-0"></div>
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-neon-teal rounded-full shadow-[0_0_10px_#22d3ee] z-10 transition-all duration-1000"
                        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>
                <span className="text-[10px] font-black text-white/80">{per}x</span>
            </div>
        );
    }
    if (type === 'risk') {
        const beta = Number(data.beta) || 1;
        const pos = Math.min(90, Math.max(10, ((beta - 0.5) / 1) * 100));
        return (
            <div className="flex flex-col items-end gap-1 min-w-[76px] min-[380px]:min-w-[100px]">
                <div className="w-full h-1 bg-gradient-to-r from-blue-400 via-neon-teal to-red-400 rounded-full relative">
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white rounded-full shadow-lg z-10 transition-all duration-1000"
                        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>
                <span className="text-[10px] font-black text-white/80">β {beta}</span>
            </div>
        );
    }
    return null;
};

/**
 * 실시간 값이 대입된 라이브 수식 렌더러
 */
const LiveFormula = ({ type, data }) => {
    if (type === 'supply') {
        return (
            <div className="text-[11px] font-mono leading-tight space-y-1">
                <p className="text-white/60 font-medium">{INDICATOR_METADATA.supply.formulaLabel}</p>
                <p className="text-neon-teal font-bold">{formatValue(data.supply_5d)}</p>
            </div>
        );
    }
    if (type === 'fundamental') {
        const isSafe = data.op_margin >= 10 && data.debt_ratio <= 100;
        return (
            <div className="text-[11px] font-mono leading-tight space-y-1">
                <p className="text-white/60 font-medium">이익률({data.op_margin}%) & 부채({data.debt_ratio}%)</p>
                <p className={`${isSafe ? 'text-neon-teal' : 'text-yellow-400'} font-bold`}>
                    {isSafe ? '판단: 재무 건전성 우수' : '판단: 주의 깊은 관찰 필요'}
                </p>
            </div>
        );
    }
    if (type === 'value') {
        const per = Number(data.per) || 0;
        const ind_area_per = Number(data.ind_area_per) || 1;
        const score = ((per / ind_area_per) * 100).toFixed(1);
        return (
            <div className="text-[11px] font-mono leading-tight space-y-1 text-white/90">
                <p className="text-white/60 font-medium">({per} ÷ {ind_area_per}) × 100</p>
                <p className="text-neon-teal font-bold">결과: {score}% (업종평균 대비)</p>
            </div>
        );
    }
    if (type === 'risk') {
        const beta = Number(data.beta) || 1;
        return (
            <div className="text-[11px] font-mono leading-tight space-y-1">
                <p className="text-white/60 font-medium">시장 민감도 지수</p>
                <p className="text-neon-teal font-bold">β {beta}</p>
            </div>
        );
    }
    return null;
};

/**
 * 판단 기준(Criteria) 목록 및 활성화 상태 표시 컴포넌트
 */
const CriteriaList = ({ type, data }) => {
    const getCriteria = () => {
        if (type === 'supply') {
            return [
                { label: "기관/외인 유입세", desc: "0보다큼", active: data.supply_5d > 0 },
                { label: "개인 위주 관망", desc: "0이하", active: data.supply_5d <= 0 }
            ];
        }
        if (type === 'fundamental') {
            const isSafe = data.op_margin >= 10 && data.debt_ratio <= 100;
            return [
                { label: "재무 매우 안전", desc: "이익10%↑ & 부채100%↓", active: isSafe },
                { label: "재무 상태 보통", desc: "기준 미달 시", active: !isSafe }
            ];
        }
        if (type === 'value') {
            const ratio = Number(data.per) / Number(data.ind_area_per);
            return [
                { label: "업종대비 저평가", desc: "80% 미만", active: ratio < 0.8 },
                { label: "업종 평균 수준", desc: "80% ~ 120%", active: ratio >= 0.8 && ratio <= 1.2 },
                { label: "성장 가치 반영", desc: "120% 초과", active: ratio > 1.2 }
            ];
        }
        if (type === 'risk') {
            const beta = Number(data.beta) || 1;
            return [
                { label: "방어적 민감도", desc: "0.8 미만", active: beta < 0.8 },
                { label: "시장 표준 민감도", desc: "0.8 ~ 1.2", active: beta >= 0.8 && beta <= 1.2 },
                { label: "공격적 민감도", desc: "1.2 초과", active: beta > 1.2 }
            ];
        }
        return [];
    };

    return (
        <div className="space-y-2">
            {getCriteria().map((c, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-500 ${c.active ? 'bg-neon-teal/20 border-neon-teal/50 scale-[1.03] shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]' : 'border-white/5 opacity-45'}`}>
                    <div className="flex items-center gap-2">
                        {c.active && <div className="w-1.5 h-1.5 bg-neon-teal rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />}
                        <span className={`text-[12px] transition-all duration-300 ${c.active ? 'font-black text-neon-teal drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'font-bold text-white/50'}`}>{c.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold transition-all duration-300 ${c.active ? 'text-neon-teal' : 'text-white/40'}`}>{c.desc}</span>
                </div>
            ))}
        </div>
    );
};

const IndicatorItem = ({ icon, label, tag, type, kisData, isExpanded, onToggle }) => (
    <div className="border-b border-white/5 last:border-0 overflow-hidden transition-all duration-300 border-x-0">
        <button 
            onClick={onToggle}
            className="w-full flex flex-col min-[380px]:flex-row items-start min-[380px]:items-center justify-between py-4 min-[380px]:py-5 hover:bg-white/[0.02] transition-colors group px-1 gap-3 min-[380px]:gap-0"
        >
            <div className="flex items-center gap-2.5 min-[380px]:gap-3 w-full min-w-0">
                <span className="material-symbols-outlined text-white/30 group-hover:text-neon-teal transition-colors text-[20px]">
                    {icon}
                </span>
                <div className="text-left">
                    <p className="text-[13px] sm:text-[14px] font-bold text-white/80">{label}</p>
                    <div className="mt-1">
                        <span className="text-[11px] sm:text-[12px] font-black text-neon-teal bg-neon-teal/10 px-2 py-0.5 rounded-full border border-neon-teal/20 tracking-tight shadow-[0_0_10px_-2px_rgba(34,211,238,0.1)]">
                            {tag}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 min-[380px]:gap-6 w-full min-[380px]:w-auto">
                <MetricGauge type={type} data={kisData} />
                <span className={`material-symbols-outlined text-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-neon-teal' : ''}`}>
                    expand_more
                </span>
            </div>
        </button>

        <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100 mb-6' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="bg-white/[0.05] mx-1 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 border border-white/10 shadow-xl backdrop-blur-md">
                <div className="space-y-1.5">
                    <p className="text-neon-teal text-[10px] font-black uppercase tracking-[0.2em]">Interpretation Guide</p>
                    <p className="text-white text-[13px] sm:text-[13.5px] font-bold leading-relaxed">
                        {INDICATOR_METADATA[type].description}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
                    <div className="bg-black/40 p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-2 shadow-inner">
                        <p className="text-white/60 text-[9px] font-black uppercase tracking-widest border-b border-white/10 pb-1">Live Formula</p>
                        <LiveFormula type={type} data={kisData} />
                    </div>
                    <div className="bg-black/40 p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-3 shadow-inner">
                        <p className="text-white/60 text-[9px] font-black uppercase tracking-widest border-b border-white/10 pb-1 text-right">Judgment Criteria</p>
                        <CriteriaList type={type} data={kisData} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const MarketReality = ({ kisData }) => {
    const [expandedType, setExpandedType] = useState(null);

    if (!kisData) return null;

    const indicators = [
        { type: 'supply', icon: 'electric_bolt', label: '수급 에너지', tag: kisData.supply_5d > 0 ? '기관/외인 유입세' : '개인 위주 관망' },
        { type: 'fundamental', icon: 'fitness_center', label: '기업 기본 체력', tag: (kisData.op_margin >= 10 && kisData.debt_ratio <= 100) ? '재무 매우 안전' : '재무 상태 보통' },
        { type: 'value', icon: 'analytics', label: '가치 평가', tag: (() => {
            const ratio = Number(kisData.per) / Number(kisData.ind_area_per);
            if (ratio < 0.8) return '업종대비 저평가';
            if (ratio > 1.2) return '성장 가치 반영';
            return '업종 평균 수준';
        })() },
        { type: 'risk', icon: 'emergency_home', label: '시장 위험성', tag: Number(kisData.beta) < 0.8 ? '방어적 민감도' : (Number(kisData.beta) > 1.2 ? '공격적 민감도' : '시장 표준 민감도') }
    ];

    return (
        <div className="bg-white/5 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 border border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden mb-6 pointer-events-auto">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-teal/5 blur-[60px] rounded-full"></div>
            
            <div className="relative z-10 space-y-5 sm:space-y-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-neon-teal text-[24px]">fact_check</span>
                            <h3 className="text-[17px] sm:text-[20px] font-black text-white tracking-tight leading-none font-brandKo">
                                팩트 체크
                            </h3>
                        </div>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-tighter">Verified by KIS</span>
                    </div>
                    <p className="text-[11px] sm:text-[12px] text-white/50 font-medium tracking-tight bg-white/5 px-3 py-2 rounded-xl border border-white/5 shadow-inner leading-relaxed">
                        수치가 대입된 라이브 수식으로 정확한 근거를 확인하세요.
                    </p>
                </div>

                <div className="bg-black/20 rounded-2xl px-3 sm:px-4 border border-white/5">
                    {indicators.map(ind => (
                        <IndicatorItem 
                            key={ind.type} 
                            {...ind} 
                            kisData={kisData}
                            isExpanded={expandedType === ind.type}
                            onToggle={() => setExpandedType(expandedType === ind.type ? null : ind.type)}
                        />
                    ))}
                </div>

                <div className="px-1">
                    <p className="text-[11px] font-bold text-white/40 italic">
                        ※ 이 영역은 한국투자증권의 공개된 수치만을 기반으로 판별합니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MarketReality;
