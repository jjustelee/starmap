import React, { useState } from 'react';

const toNum = (value) => {
    const normalized = typeof value === 'string'
        ? value.replace(/,/g, '').replace(/%/g, '').trim()
        : value;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
};

const toNonZeroNum = (value) => {
    const n = toNum(value);
    return n === 0 ? null : n;
};

const formatUpdatedAt = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const formatRatio = (value, suffix = '%') => {
    const n = toNum(value);
    if (n === null) return '-';
    return `${trimNumber(n)}${suffix}`;
};

const formatSignedPercent = (value) => {
    const n = toNum(value);
    if (n === null) return '-';
    const sign = n > 0 ? '+' : '';
    return `${sign}${trimNumber(n)}%`;
};

const formatPlainNumber = (value) => {
    const n = toNum(value);
    if (n === null) return '-';
    return Math.round(n).toLocaleString();
};

const trimNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const fixed = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
    return fixed.replace(/\.00$/, '').replace(/(\.\d*[1-9])0$/, '$1');
};

const getSupplyState = (data) => {
    const supply = toNum(data.supply_5d);
    if (supply === null) {
        return { hasData: false, tag: '수급 데이터 대기', supply: null };
    }
    return {
        hasData: true,
        tag: supply > 0 ? '유입세' : '이탈세',
        supply
    };
};

const getFundamentalState = (data) => {
    const roe = toNonZeroNum(data.roe);
    const debt = toNonZeroNum(data.debt_ratio);
    const eps = toNonZeroNum(data.eps);
    const bps = toNonZeroNum(data.bps);

    if (roe === null && debt === null) {
        return { hasData: false, tag: '재무 데이터 대기', roe: null, debt: null, eps, bps, level: 'pending' };
    }

    let level = 'warning';
    let tag = '주의';

    if (roe !== null && debt !== null) {
        if (roe >= 10 && debt <= 100) {
            level = 'strong';
            tag = '탄탄';
        } else if (roe > 0 && debt <= 200) {
            level = 'mid';
            tag = '보통';
        }
    } else if (roe !== null) {
        if (roe >= 10) {
            level = 'strong';
            tag = '탄탄';
        } else if (roe > 0) {
            level = 'mid';
            tag = '보통';
        }
    } else if (debt !== null) {
        if (debt <= 100) {
            level = 'strong';
            tag = '탄탄';
        } else if (debt <= 200) {
            level = 'mid';
            tag = '보통';
        }
    }

    return { hasData: true, tag, roe, debt, eps, bps, level };
};

const getValueState = (data) => {
    const per = toNonZeroNum(data.per);
    const pbr = toNonZeroNum(data.pbr);
    const eps = toNonZeroNum(data.eps);
    const bps = toNonZeroNum(data.bps);

    if (per === null && pbr === null) {
        return { hasData: false, tag: '밸류 데이터 대기', per: null, pbr: null, eps, bps, level: 'pending', mode: 'none' };
    }

    let level = 'high';
    let tag = '비싼 편';
    let mode = 'both';

    if (per !== null && pbr !== null) {
        if (per <= 10 && pbr <= 1.5) {
            level = 'low';
            tag = '저렴한 편';
        } else if (per <= 20 && pbr <= 3) {
            level = 'mid';
            tag = '보통';
        }
    } else if (per !== null) {
        mode = 'per';
        if (per <= 10) {
            level = 'low';
            tag = '저렴한 편';
        } else if (per <= 20) {
            level = 'mid';
            tag = '보통';
        }
    } else {
        mode = 'pbr';
        if (pbr <= 1) {
            level = 'low';
            tag = '저렴한 편';
        } else if (pbr <= 3) {
            level = 'mid';
            tag = '보통';
        }
    }

    return { hasData: true, tag, per, pbr, eps, bps, level, mode };
};

const getRiskState = (data) => {
    const currentPrice = toNonZeroNum(data.currentPrice);
    const priceChangeRate = toNum(data.priceChangeRate);
    const priceHigh = toNonZeroNum(data.priceHigh);
    const priceLow = toNonZeroNum(data.priceLow);
    const intradaySwing = currentPrice && priceHigh !== null && priceLow !== null
        ? ((priceHigh - priceLow) / currentPrice) * 100
        : null;

    if (priceChangeRate === null && intradaySwing === null) {
        return {
            hasData: false,
            tag: '변동 데이터 대기',
            currentPrice,
            priceChangeRate,
            priceHigh,
            priceLow,
            intradaySwing: null,
            score: null,
            level: 'pending'
        };
    }

    const score = Math.max(Math.abs(priceChangeRate ?? 0), intradaySwing ?? 0);
    let tag = '큰 편';
    let level = 'high';

    if (score < 2) {
        tag = '잔잔';
        level = 'low';
    } else if (score < 5) {
        tag = '보통';
        level = 'mid';
    }

    return {
        hasData: true,
        tag,
        currentPrice,
        priceChangeRate,
        priceHigh,
        priceLow,
        intradaySwing,
        score,
        level
    };
};

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
        description: "자기자본 수익률(ROE)과 부채비율로 회사 체력이 얼마나 탄탄한지 빠르게 확인합니다.",
        formulaLabel: "ROE 10%↑ & 부채 100%↓ 기준",
    },
    value: {
        title: "가치 평가 해석 가이드",
        description: "PER와 PBR로 현재 가격이 저렴한 편인지, 보통인지, 비싼 편인지 참고합니다.",
        formulaLabel: "PER + PBR 참고",
    },
    risk: {
        title: "가격 흔들림 해석 가이드",
        description: "전일 등락률과 장중 고저폭으로 이 종목이 오늘 얼마나 출렁였는지 체감형으로 보여줍니다.",
        formulaLabel: "max(|전일등락률|, 일중 변동폭)",
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
const MetricGauge = ({ type, analysis }) => {
    if (type === 'supply') {
        const energyRaw = analysis.supply ?? 0;
        const energy = Math.min(10, Math.max(0, (energyRaw / 1000000) + 5));
        return (
            <div className="flex w-[118px] min-[380px]:w-[140px] flex-col items-end gap-1.5">
                <div className="grid h-1 w-full grid-cols-10 gap-0.5">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`rounded-full transition-all duration-700 ${i < energy ? 'bg-neon-teal shadow-[0_0_8px_#22d3ee]' : 'bg-white/10'}`}
                        />
                    ))}
                </div>
                <span className="text-xs font-black text-neon-teal/80 bg-neon-teal/10 px-1.5 py-0.5 rounded-md border border-neon-teal/20">
                    {energyRaw > 0 ? '+' : ''}{formatValue(energyRaw)}
                </span>
            </div>
        );
    }
    if (type === 'fundamental') {
        const fillClass = analysis.level === 'strong'
            ? 'w-full bg-neon-teal shadow-[0_0_8px_#22d3ee]'
            : (analysis.level === 'mid' ? 'w-3/5 bg-yellow-400' : 'w-1/4 bg-neon-pink');
        return (
            <div className="flex w-[118px] min-[380px]:w-[140px] flex-col items-end gap-1.5">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                        className={`absolute left-0 top-0 h-full transition-all duration-1000 ${fillClass}`}
                    />
                </div>
                <div className="flex gap-2">
                    <span className="text-xs font-black text-[#9CA3AF]">ROE {formatRatio(analysis.roe)} · 부채 {formatRatio(analysis.debt)}</span>
                </div>
            </div>
        );
    }
    if (type === 'value') {
        const pos = analysis.level === 'low' ? 18 : (analysis.level === 'mid' ? 50 : 82);
        return (
            <div className="flex w-[118px] min-[380px]:w-[140px] flex-col items-end gap-1.5">
                <div className="w-full h-1 bg-white/10 rounded-full relative">
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/30 z-0"></div>
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-neon-teal rounded-full shadow-[0_0_10px_#22d3ee] z-10 transition-all duration-1000"
                        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>
                <span className="text-xs font-black text-[#D1D5DB]">
                    {analysis.per !== null ? `PER ${formatRatio(analysis.per, '배')}` : `PBR ${formatRatio(analysis.pbr, '배')}`}
                </span>
            </div>
        );
    }
    if (type === 'risk') {
        const score = Math.min(10, Math.max(0, analysis.score ?? 0));
        const pos = Math.min(90, Math.max(10, (score / 10) * 100));
        return (
            <div className="flex w-[118px] min-[380px]:w-[140px] flex-col items-end gap-1">
                <div className="w-full h-1 bg-gradient-to-r from-blue-400 via-neon-teal to-red-400 rounded-full relative">
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white rounded-full shadow-lg z-10 transition-all duration-1000"
                        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>
                <span className="text-xs font-black text-[#D1D5DB]">
                    {analysis.score === null ? '동기화 중' : `${trimNumber(analysis.score)}%`}
                </span>
            </div>
        );
    }
    return null;
};

/**
 * 실시간 값이 대입된 라이브 수식 렌더러
 */
const LiveFormula = ({ type, analysis }) => {
    if (type === 'supply') {
        return (
            <div className="text-xs font-mono leading-tight space-y-1">
                <p className="text-[#9CA3AF] font-medium">{INDICATOR_METADATA.supply.formulaLabel}</p>
                <p className="text-neon-teal font-bold">{analysis.supply === null ? '동기화 중' : formatValue(analysis.supply)}</p>
            </div>
        );
    }
    if (type === 'fundamental') {
        if (analysis.roe === null && analysis.debt === null) {
            return (
                <div className="text-xs font-mono leading-tight space-y-1">
                    <p className="text-[#9CA3AF] font-medium">ROE · 부채비율</p>
                    <p className="text-neon-teal font-bold">동기화 중</p>
                </div>
            );
        }
        return (
            <div className="text-xs font-mono leading-tight space-y-1">
                <p className="text-[#9CA3AF] font-medium">ROE {formatRatio(analysis.roe)} · 부채 {formatRatio(analysis.debt)}</p>
                {(analysis.eps !== null || analysis.bps !== null) ? (
                    <p className="text-[#9CA3AF] font-medium">EPS {formatPlainNumber(analysis.eps)} / BPS {formatPlainNumber(analysis.bps)}</p>
                ) : null}
                <p className={`${analysis.level === 'strong' ? 'text-neon-teal' : (analysis.level === 'mid' ? 'text-yellow-400' : 'text-neon-pink')} font-bold`}>
                    판단: {analysis.tag}
                </p>
            </div>
        );
    }
    if (type === 'value') {
        if (analysis.per === null && analysis.pbr === null) {
            return (
                <div className="text-xs font-mono leading-tight space-y-1 text-[#D1D5DB]">
                    <p className="text-[#9CA3AF] font-medium">PER + PBR 참고</p>
                    <p className="text-neon-teal font-bold">결과: 동기화 중</p>
                </div>
            );
        }
        return (
            <div className="text-xs font-mono leading-tight space-y-1 text-[#D1D5DB]">
                <p className="text-[#9CA3AF] font-medium">PER {formatRatio(analysis.per, '배')} / PBR {formatRatio(analysis.pbr, '배')}</p>
                {(analysis.eps !== null || analysis.bps !== null) ? (
                    <p className="text-[#9CA3AF] font-medium">EPS {formatPlainNumber(analysis.eps)} / BPS {formatPlainNumber(analysis.bps)}</p>
                ) : null}
                <p className="text-neon-teal font-bold">결과: 밸류 부담 {analysis.tag}</p>
            </div>
        );
    }
    if (type === 'risk') {
        return (
            <div className="text-xs font-mono leading-tight space-y-1">
                <p className="text-[#9CA3AF] font-medium">전일등락률 {formatSignedPercent(analysis.priceChangeRate)}</p>
                <p className="text-[#9CA3AF] font-medium">일중 변동폭 {formatRatio(analysis.intradaySwing)}</p>
                <p className="text-neon-teal font-bold">체감 흔들림 {analysis.score === null ? '동기화 중' : `${trimNumber(analysis.score)}%`}</p>
            </div>
        );
    }
    return null;
};

/**
 * 판단 기준(Criteria) 목록 및 활성화 상태 표시 컴포넌트
 */
const CriteriaList = ({ type, analysis }) => {
    const getCriteria = () => {
        if (type === 'supply') {
            if (analysis.supply === null) {
                return [{ label: "수급 데이터 대기", desc: "동기화 중", active: true }];
            }
                return [
                    { label: "외인/기관 유입세", desc: "0 초과", active: analysis.supply > 0 },
                    { label: "이탈세", desc: "0 이하", active: analysis.supply <= 0 }
                ];
            }
        if (type === 'fundamental') {
            if (analysis.roe === null && analysis.debt === null) {
                return [{ label: "재무 데이터 대기", desc: "동기화 중", active: true }];
            }
            return [
                { label: "탄탄", desc: "ROE 10%↑ & 부채 100%↓", active: analysis.level === 'strong' },
                { label: "보통", desc: "ROE 0%↑ & 부채 200%↓", active: analysis.level === 'mid' },
                { label: "주의", desc: "그 외", active: analysis.level === 'warning' }
            ];
        }
        if (type === 'value') {
            if (analysis.per === null && analysis.pbr === null) {
                return [{ label: "밸류 데이터 대기", desc: "동기화 중", active: true }];
            }
            if (analysis.mode === 'per') {
                return [
                    { label: "저렴한 편", desc: "PER 10 이하", active: analysis.level === 'low' },
                    { label: "보통", desc: "PER 20 이하", active: analysis.level === 'mid' },
                    { label: "비싼 편", desc: "PER 20 초과", active: analysis.level === 'high' }
                ];
            }
            if (analysis.mode === 'pbr') {
                return [
                    { label: "저렴한 편", desc: "PBR 1 이하", active: analysis.level === 'low' },
                    { label: "보통", desc: "PBR 3 이하", active: analysis.level === 'mid' },
                    { label: "비싼 편", desc: "PBR 3 초과", active: analysis.level === 'high' }
                ];
            }
            return [
                { label: "저렴한 편", desc: "PER 10↓ & PBR 1.5↓", active: analysis.level === 'low' },
                { label: "보통", desc: "PER 20↓ & PBR 3↓", active: analysis.level === 'mid' },
                { label: "비싼 편", desc: "그 외", active: analysis.level === 'high' }
            ];
        }
        if (type === 'risk') {
            if (analysis.score === null) {
                return [{ label: "변동 데이터 대기", desc: "동기화 중", active: true }];
            }
            return [
                { label: "잔잔", desc: "2% 미만", active: analysis.level === 'low' },
                { label: "보통", desc: "2% ~ 5%", active: analysis.level === 'mid' },
                { label: "큰 편", desc: "5% 이상", active: analysis.level === 'high' }
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
                        <span className={`text-[15px] transition-all duration-300 ${c.active ? 'font-black text-neon-teal drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'font-bold text-[#9CA3AF]'}`}>{c.label}</span>
                    </div>
                    <span className={`text-xs font-bold transition-all duration-300 ${c.active ? 'text-neon-teal' : 'text-[#9CA3AF]'}`}>{c.desc}</span>
                </div>
            ))}
        </div>
    );
};

const IndicatorItem = ({ icon, label, tag, type, analysis, isExpanded, onToggle }) => (
    <div className="border-b border-white/5 last:border-0 overflow-hidden transition-all duration-300 border-x-0">
        <button 
            onClick={onToggle}
            className="w-full flex flex-col min-[340px]:flex-row items-start min-[340px]:items-center justify-between py-4 min-[380px]:py-5 hover:bg-white/[0.02] transition-colors group px-1 gap-3 min-[340px]:gap-0"
        >
            <div className="flex items-center gap-2.5 min-[380px]:gap-3 w-full min-w-0 min-[340px]:flex-1">
                <span className="material-symbols-outlined text-[#6B7280] group-hover:text-neon-teal transition-colors text-xl">
                    {icon}
                </span>
                <div className="text-left min-w-0">
                    <p className="text-sm sm:text-[17px] font-bold text-[#D1D5DB] break-keep">{label}</p>
                    <div className="mt-1">
                        <span className="text-xs sm:text-[15px] font-black text-neon-teal bg-neon-teal/10 px-2 py-0.5 rounded-full border border-neon-teal/20 tracking-tight shadow-[0_0_10px_-2px_rgba(34,211,238,0.1)]">
                            {tag}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 min-[380px]:gap-6 w-full min-[340px]:w-auto shrink-0">
                <MetricGauge type={type} analysis={analysis} />
                <span className={`material-symbols-outlined text-[#6B7280] transition-transform duration-300 ${isExpanded ? 'rotate-180 text-neon-teal' : ''}`}>
                    expand_more
                </span>
            </div>
        </button>

        <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100 mb-6' : 'max-h-0 opacity-0 pointer-events-none'}`}>
            <div className="bg-white/[0.05] mx-1 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 border border-white/10 shadow-xl backdrop-blur-md">
                <div className="space-y-1.5">
                    <p className="text-neon-teal text-xs font-black uppercase tracking-[0.2em]">Interpretation Guide</p>
                    <p className="text-[#F3F4F6] text-sm sm:text-[13.5px] font-bold leading-relaxed">
                        {INDICATOR_METADATA[type].description}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
                    <div className="bg-[#121212]/40 p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-2 shadow-inner">
                        <p className="text-[#9CA3AF] text-xs font-black uppercase tracking-widest border-b border-white/10 pb-1">Live Formula</p>
                        <LiveFormula type={type} analysis={analysis} />
                    </div>
                    <div className="bg-[#121212]/40 p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-3 shadow-inner">
                        <p className="text-[#9CA3AF] text-xs font-black uppercase tracking-widest border-b border-white/10 pb-1 text-right">Judgment Criteria</p>
                        <CriteriaList type={type} analysis={analysis} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const MarketReality = ({ kisData }) => {
    const [expandedType, setExpandedType] = useState(null);
    const safeData = kisData || {};
    const supplyState = getSupplyState(safeData);
    const fundamentalState = getFundamentalState(safeData);
    const valueState = getValueState(safeData);
    const riskState = getRiskState(safeData);
    const hasReliableData = [supplyState, fundamentalState, valueState, riskState].some((item) => item.hasData);
    const realityStatus = String(safeData.status || (hasReliableData ? 'live' : 'unavailable'));
    const statusLabel = realityStatus === 'live'
        ? 'KIS 기준'
        : (realityStatus === 'cached' ? '최근 기준' : '동기화 중');
    const statusTone = realityStatus === 'live'
        ? 'text-neon-teal/70'
        : (realityStatus === 'cached' ? 'text-[#9CA3AF]' : 'text-yellow-300/70');
    const updatedAtText = formatUpdatedAt(safeData.updatedAt);

    const indicators = [
        { type: 'supply', icon: 'electric_bolt', label: '수급 에너지', tag: supplyState.tag, analysis: supplyState },
        { type: 'fundamental', icon: 'fitness_center', label: '기업 기본 체력', tag: fundamentalState.tag, analysis: fundamentalState },
        { type: 'value', icon: 'analytics', label: '가치 평가', tag: valueState.tag, analysis: valueState },
        { type: 'risk', icon: 'show_chart', label: '가격 흔들림', tag: riskState.tag, analysis: riskState }
    ];

    return (
        <div className="bg-white/5 backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 border border-white/10 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden mb-6 pointer-events-auto">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-teal/5 blur-[60px] rounded-full"></div>
            
            <div className="relative z-10 space-y-5 sm:space-y-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-neon-teal text-3xl">fact_check</span>
                            <h3 className="text-lg sm:text-xl font-black text-[#F3F4F6] tracking-tight leading-none font-brandKo">
                                팩트 체크
                            </h3>
                        </div>
                        <span className={`text-xs font-black uppercase tracking-tighter ${statusTone}`}>{statusLabel}</span>
                    </div>
                    <p className="text-xs sm:text-[15px] text-[#9CA3AF] font-medium tracking-tight bg-white/5 px-3 py-2 rounded-xl border border-white/5 shadow-inner leading-relaxed">
                        {realityStatus === 'live'
                            ? '숫자를 먼저 보고, 태그는 참고만 하세요.'
                            : (realityStatus === 'cached'
                                ? '실시간 지연으로 최근 기준을 보여줍니다.'
                                : '실시간 지연 시 최근 기준 또는 대기 상태로 보입니다.')}
                    </p>
                    {updatedAtText ? (
                        <p className="text-xs font-bold text-[#9CA3AF] px-1">
                            기준일: {updatedAtText}
                        </p>
                    ) : null}
                </div>

                <div className="bg-[#121212]/20 rounded-2xl px-3 sm:px-4 border border-white/5">
                    {indicators.map(ind => (
                        <IndicatorItem 
                            key={ind.type} 
                            {...ind} 
                            isExpanded={expandedType === ind.type}
                            onToggle={() => setExpandedType(expandedType === ind.type ? null : ind.type)}
                        />
                    ))}
                </div>

                <div className="px-1">
                    <p className="text-xs font-bold text-[#9CA3AF] italic">
                        ※ 이 영역은 한국투자증권의 공개된 수치만을 기반으로 판별합니다.
                    </p>
                    {realityStatus === 'cached' && updatedAtText ? (
                        <p className="text-xs font-bold text-[#9CA3AF] mt-1">
                            최근 갱신 시각: {updatedAtText}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MarketReality;
