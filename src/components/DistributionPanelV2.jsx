import React from 'react';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): 기간별 aggregate 뷰/RPC 결과를 stats 필드에 매핑.
 * - BACKEND_TODO(KIS): bullish/bearish는 현재가 기준 비교이므로 현재가 동기화 필요.
 * - BACKEND_TODO(API): snapshot.stats, snapshot.sampleSize 계약이 고정되면 이 컴포넌트는 변경 최소.
 */

/**
 * I/O Contract
 * props:
 * - snapshot: PredictionSnapshot | null
 * - isLoading: boolean
 */
const DistributionPanelV2 = ({ snapshot, isLoading }) => {
    const stats = snapshot?.stats;
    const sampleSize = snapshot?.sampleSize || 0;
    const hasPredictionData = sampleSize > 0;
    const modePrice = hasPredictionData ? formatPrice(stats?.mode) : '예언 대기';
    const sentiment = getSentiment(stats?.bullishRatio);
    const modeDelta = hasPredictionData ? formatDeltaPct(snapshot?.currentPrice, stats?.mode) : '-';
    const participantCount = hasPredictionData ? formatParticipantCount(sampleSize) : '아직 0명';

    return (
        <section className="bg-white/[0.06] backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 border border-white/10 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.5)] relative overflow-hidden pointer-events-auto">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-neon-teal text-[24px]">analytics</span>
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-white font-brandKo tracking-tight leading-none">목표가 합의</h2>
                </div>
                <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/30 rounded text-[10px] font-bold text-neon-teal uppercase tracking-widest">예언 {sampleSize.toLocaleString()}건</span>
            </div>

            {isLoading ? (
                <div className="text-[14px] text-white/55 py-2 mt-4">집계 중</div>
            ) : (
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <MiniMetric icon="star" label="대표" value={modePrice} />
                    <MiniMetric icon={sentiment.icon} label="방향" value={sentiment.label} valueClass={sentiment.textClass} />
                    <MiniMetric icon="trending_up" label="현재가 대비" value={modeDelta} valueClass={getDeltaClass(modeDelta)} />
                    <MiniMetric icon="group" label="참여" value={participantCount} />
                </div>
            )}
        </section>
    );
};

const MiniMetric = ({ icon, label, value, valueClass = 'text-white/92', noWrap = false }) => (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 sm:p-4">
        <p className="text-[11px] sm:text-[12px] text-white/55 font-bold mb-1.5 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">{icon}</span>
            {label}
        </p>
        <p className={`text-[13px] sm:text-[14px] ${valueClass} font-bold font-brandEn leading-snug ${noWrap ? 'whitespace-nowrap text-[12px] sm:text-[13px]' : ''}`}>{value}</p>
    </div>
);

function getSentiment(bullishRatio) {
    if (bullishRatio === null || bullishRatio === undefined || bullishRatio === '') {
        return {
            label: '대기',
            icon: 'schedule',
            className: 'bg-white/10 border-white/20 text-white/65',
            textClass: 'text-white/65'
        };
    }
    const bull = Number(bullishRatio);
    if (!Number.isFinite(bull)) {
        return {
            label: '대기',
            icon: 'schedule',
            className: 'bg-white/10 border-white/20 text-white/65',
            textClass: 'text-white/65'
        };
    }
    if (bull >= 0.57) {
        return {
            label: '상승',
            icon: 'rocket_launch',
            className: 'bg-neon-pink/15 border-neon-pink/35 text-neon-pink',
            textClass: 'text-neon-pink'
        };
    }
    if (bull <= 0.43) {
        return {
            label: '하락',
            icon: 'south',
            className: 'bg-neon-blue/15 border-neon-blue/35 text-neon-blue',
            textClass: 'text-neon-blue'
        };
    }
    return {
        label: '중립',
        icon: 'drag_handle',
        className: 'bg-white/10 border-white/20 text-white/70',
        textClass: 'text-white/80'
    };
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


export default DistributionPanelV2;
