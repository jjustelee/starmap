import React from 'react';
import { getMarketStatus } from '../utils/marketStatus';

const formatQuoteAge = (value) => {
    if (!value) return null;
    const updatedAtMs = new Date(value).getTime();
    if (!Number.isFinite(updatedAtMs)) return null;

    const diffMs = Date.now() - updatedAtMs;
    if (diffMs < 0) return '1분 전';

    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    return null;
};

const DetailHeader = ({ stock, basePrice, priceChange, priceChangeRate, quoteUpdatedAt, onBack }) => {
    const market = getMarketStatus();
    const hasPrice = Number(basePrice) > 0;
    const statusText = hasPrice ? (formatQuoteAge(quoteUpdatedAt) || '갱신중') : '갱신중';
    const shouldShowQuoteStatus = market.isOpen;

    return (
        <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2.5rem)] max-w-2xl transition-all duration-700 rounded-2xl crystal-glass px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-2.5 sm:gap-5 shadow-2xl">
            <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
                <button onClick={onBack} className="text-white/60 hover:text-white transition active:scale-95 bg-white/5 p-2 rounded-full flex-shrink-0">
                    <span className="material-symbols-outlined text-[24px] sm:text-[28px]">arrow_back_ios_new</span>
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-[17px] sm:text-xl font-black text-white leading-tight tracking-tight break-keep line-clamp-2">{stock.name}</h1>
                    <p className="mt-0.5 font-brandEn text-[11px] sm:text-[13px] font-black tracking-widest text-white/60 uppercase truncate">{stock.symbol}</p>
                </div>
            </div>
            <div className="shrink-0 text-right flex flex-col items-end gap-1 sm:gap-1.5">
                <div className="flex items-center justify-end gap-2">
                    {market.isOpen ? (
                        <span className="flex h-3 w-3 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 duration-700"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.9)]"></span>
                        </span>
                    ) : null}
                    <p className="font-brandEn text-[22px] min-[420px]:text-[26px] sm:text-3xl font-black text-white leading-none tracking-tighter whitespace-nowrap">
                        {hasPrice ? Number(basePrice).toLocaleString() : '시세 동기화 중'}
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 min-h-[18px]">
                    {!market.isOpen ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-white/40 uppercase tracking-tighter whitespace-nowrap">
                            {market.text}
                        </span>
                    ) : shouldShowQuoteStatus ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-white/55 tracking-tighter whitespace-nowrap">
                            {statusText}
                        </span>
                    ) : null}
                    {hasPrice && (priceChange !== undefined && priceChangeRate !== undefined) ? (
                        <p className={`text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap ${priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                            {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toLocaleString()} ({priceChangeRate.toFixed(2)}%)
                        </p>
                    ) : null}
                </div>
            </div>
        </header>
    );
};

export default DetailHeader;
