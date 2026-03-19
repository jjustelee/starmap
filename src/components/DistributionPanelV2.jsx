import React, { useState } from 'react';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): 기간별 aggregate 뷰/RPC 결과를 stats 필드에 매핑.
 * - BACKEND_TODO(KIS): bullish/bearish는 현재가 기준 비교이므로 현재가 동기화 필요.
 * - BACKEND_TODO(API): snapshot.stats, snapshot.sampleSize 계약이 고정되면 이 컴포넌트는 변경 최소.
 */

const WINDOWS = ['24h', '7d', '30d', 'all'];
const WINDOW_META = {
    '24h': { label: '오늘', icon: 'today' },
    '7d': { label: '1주', icon: 'date_range' },
    '30d': { label: '1달', icon: 'calendar_month' },
    all: { label: '전체', icon: 'all_inclusive' }
};

/**
 * I/O Contract
 * props:
 * - selectedWindow: "24h"|"7d"|"30d"|"all"
 * - onWindowChange: (window) => void
 * - snapshot: PredictionSnapshot | null
 * - isLoading: boolean
 */
const DistributionPanelV2 = ({ selectedWindow, onWindowChange, snapshot, isLoading }) => {
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const stats = snapshot?.stats;
    const sampleSize = snapshot?.sampleSize || 0;
    const hasPredictionData = sampleSize > 0;
    const modePrice = hasPredictionData ? formatPrice(stats?.mode) : '예언 대기';
    const modePriceCompact = hasPredictionData ? formatCompactPrice(stats?.mode) : '첫 예언을 기다리는 중';
    const avgPrice = hasPredictionData ? formatPrice(stats?.avg) : '데이터 대기';
    const spreadText = hasPredictionData ? formatSpread(stats?.q1, stats?.q3) : '데이터 대기';
    const bullRatio = hasPredictionData ? clampRatio(stats?.bullishRatio) : 0;
    const bearRatio = hasPredictionData ? clampRatio(stats?.bearishRatio) : 0;
    const bull = hasPredictionData ? toPct(bullRatio) : '-';
    const bear = hasPredictionData ? toPct(bearRatio) : '-';
    const sentiment = getSentiment(stats?.bullishRatio);
    const modeDelta = hasPredictionData ? formatDeltaPct(snapshot?.currentPrice, stats?.mode) : '-';
    const participantCount = hasPredictionData ? formatParticipantCount(sampleSize) : '아직 0명';

    return (
        <section className="bg-white/[0.06] backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 border border-white/10 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.5)] relative overflow-hidden pointer-events-auto">
            <div className="absolute top-0 right-0 w-28 h-28 bg-neon-teal/5 blur-[55px] rounded-full pointer-events-none" />
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-neon-teal text-[24px]">analytics</span>
                    <h2 className="text-[17px] sm:text-[20px] font-bold text-white font-brandKo tracking-tight leading-none">커뮤니티 감성 합의</h2>
                </div>
                <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/30 rounded text-[10px] font-bold text-neon-teal uppercase tracking-widest">N={sampleSize.toLocaleString()}</span>
            </div>
            <p className="mt-3 text-[12px] sm:text-[13px] text-white/55 font-medium leading-relaxed">
                핵심 예언가, 심리, 참여수만 먼저 보여주고 평균/분포는 필요할 때만 펼쳐서 확인합니다.
            </p>

            <div className="grid grid-cols-4 gap-2 mt-4 mb-5">
                {WINDOWS.map((window) => {
                    const active = selectedWindow === window;
                    const meta = WINDOW_META[window];
                    return (
                        <button
                            key={window}
                            type="button"
                            onClick={() => onWindowChange(window)}
                            className={`relative h-12 rounded-xl text-[12px] sm:text-[13px] font-bold transition border overflow-hidden ${
                                active
                                    ? 'bg-gradient-to-b from-neon-teal/25 to-neon-teal/10 text-neon-teal border-neon-teal/45 shadow-[0_0_12px_rgba(34,211,238,0.24)]'
                                    : 'bg-white/5 text-white/65 border-white/10'
                            }`}
                        >
                            {active ? <span className="absolute top-0 left-3 right-3 h-[2px] bg-neon-teal rounded-b" /> : null}
                            <span className="inline-flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
                                {meta.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {isLoading ? (
                <div className="text-[14px] text-white/55 py-4">개미들 예언 모으는 중...</div>
            ) : (
                <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] sm:text-[13px] text-white/55 font-bold inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">star</span>
                                핵심 예언가
                            </p>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-black border ${sentiment.className}`}>
                                <span className="material-symbols-outlined text-[16px]">{sentiment.icon}</span>
                                {sentiment.label}
                            </span>
                        </div>
                        <p className="text-[32px] sm:text-[40px] text-white font-black font-brandEn leading-none mt-2 tracking-tight">{modePrice}</p>
                        <p className="mt-1 text-[12px] text-white/55 font-bold">{modePriceCompact}</p>
                        <p className="mt-2 text-[13px] sm:text-[14px] font-bold inline-flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-white/60">trending_up</span>
                            <span className="text-white/60">현재가 대비</span>
                            <span className={getDeltaClass(modeDelta)}>{modeDelta}</span>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
                            <p className="text-[11px] sm:text-[12px] text-white/55 font-bold mb-1.5 inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">swords</span>
                                심리
                            </p>
                            <div className="flex items-center justify-between text-[12px] font-black font-brandEn mb-1.5">
                                <span className="text-neon-pink">{bull}</span>
                                <span className="text-neon-blue">{bear}</span>
                            </div>
                            <div className="h-2 w-full rounded-full overflow-hidden border border-white/10 bg-white/5 flex">
                                <span className="h-full bg-neon-pink" style={{ width: `${bullRatio * 100}%` }} />
                                <span className="h-full bg-neon-blue" style={{ width: `${bearRatio * 100}%` }} />
                            </div>
                            {!hasPredictionData ? (
                                <p className="mt-2 text-[11px] text-white/45 font-bold">아직 모인 예언이 없어 심리 집계는 대기 중입니다.</p>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <MiniMetric icon="group" label="참여수" value={participantCount} />
                            <button
                                type="button"
                                onClick={() => setIsDetailOpen((prev) => !prev)}
                                className="min-h-11 rounded-2xl border border-white/15 bg-white/5 px-3 text-[13px] sm:text-[14px] font-bold text-white/88 inline-flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {isDetailOpen ? 'expand_less' : 'expand_more'}
                                </span>
                                {isDetailOpen ? '요약만 보기' : '평균·분포 보기'}
                            </button>
                        </div>

                        {isDetailOpen ? (
                            <div className="grid grid-cols-2 gap-2">
                                <MiniMetric icon="paid" label="평균" value={avgPrice} />
                                <MiniMetric icon="swap_horiz" label="분포" value={spreadText} noWrap />
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </section>
    );
};

const MiniMetric = ({ icon, label, value, noWrap = false }) => (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
        <p className="text-[11px] sm:text-[12px] text-white/55 font-bold mb-1.5 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">{icon}</span>
            {label}
        </p>
        <p className={`text-[13px] sm:text-[14px] text-white/92 font-bold font-brandEn leading-snug ${noWrap ? 'whitespace-nowrap text-[12px] sm:text-[13px]' : ''}`}>{value}</p>
    </div>
);

function getSentiment(bullishRatio) {
    if (bullishRatio === null || bullishRatio === undefined || bullishRatio === '') {
        return {
            label: '대기',
            icon: 'schedule',
            className: 'bg-white/10 border-white/20 text-white/65'
        };
    }
    const bull = Number(bullishRatio);
    if (!Number.isFinite(bull)) {
        return {
            label: '대기',
            icon: 'schedule',
            className: 'bg-white/10 border-white/20 text-white/65'
        };
    }
    if (bull >= 0.57) {
        return {
            label: '상승',
            icon: 'rocket_launch',
            className: 'bg-neon-pink/15 border-neon-pink/35 text-neon-pink'
        };
    }
    if (bull <= 0.43) {
        return {
            label: '하락',
            icon: 'south',
            className: 'bg-neon-blue/15 border-neon-blue/35 text-neon-blue'
        };
    }
    return {
        label: '중립',
        icon: 'drag_handle',
        className: 'bg-white/10 border-white/20 text-white/70'
    };
}

function clampRatio(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0.5;
    return Math.min(1, Math.max(0, num));
}

function formatDeltaPct(base, target) {
    const b = Number(base);
    const t = Number(target);
    if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(t)) return '-';
    const delta = ((t - b) / b) * 100;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
}

function getDeltaClass(deltaText) {
    if (typeof deltaText !== 'string') return 'text-white/70';
    if (deltaText === '-') return 'text-white/60';
    if (deltaText.startsWith('+')) return 'text-neon-pink';
    if (deltaText.startsWith('-')) return 'text-neon-blue';
    return 'text-white/70';
}

function formatParticipantCount(value) {
    const count = Math.max(0, Number(value || 0));
    return `${count.toLocaleString()}명`;
}

function formatPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '-';
    return `${Math.round(num).toLocaleString()}원`;
}

function formatCompactPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '-';
    if (num >= 10000) {
        const man = num / 10000;
        const rounded = man >= 100 ? Math.round(man) : Math.round(man * 10) / 10;
        return `${trimDecimal(rounded)}만`;
    }
    return `${Math.round(num).toLocaleString()}원`;
}

function formatSpread(min, max) {
    const left = formatCompactPrice(min);
    const right = formatCompactPrice(max);
    return `${left}~${right}`;
}

function trimDecimal(value) {
    const text = String(value);
    return text.endsWith('.0') ? text.slice(0, -2) : text;
}

function toPct(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return `${(num * 100).toFixed(1)}%`;
}

export default DistributionPanelV2;
