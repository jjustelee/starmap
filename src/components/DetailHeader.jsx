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
                <button onClick={onBack} className="text-[#9CA3AF] hover:text-[#F3F4F6] transition active:scale-95 bg-white/5 p-2 rounded-full flex-shrink-0">
                    <span className="material-symbols-outlined text-3xl sm:text-[34px]">arrow_back_ios_new</span>
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl font-black text-[#F3F4F6] leading-tight tracking-tight break-keep line-clamp-2">{stock.name}</h1>
                    <p className="mt-0.5 font-brandEn text-xs sm:text-sm font-black tracking-widest text-[#9CA3AF] uppercase truncate">{stock.symbol}</p>
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
                    <p className="font-brandEn text-[26px] min-[420px]:text-[32px] sm:text-3xl font-black text-[#F3F4F6] leading-none tracking-tighter whitespace-nowrap">
                        {hasPrice ? Number(basePrice).toLocaleString() : '시세 동기화 중'}
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 min-h-[18px]">
                    {!market.isOpen ? (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-white/10 text-[#9CA3AF] uppercase tracking-tighter whitespace-nowrap">
                            {market.text}
                        </span>
                    ) : shouldShowQuoteStatus ? (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-white/10 text-[#9CA3AF] tracking-tighter whitespace-nowrap">
                            {statusText}
                        </span>
                    ) : null}
                    {hasPrice && (priceChange !== undefined && priceChangeRate !== undefined) ? (
                        <p className={`text-xs sm:text-xs font-bold leading-none whitespace-nowrap ${priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                            {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toLocaleString()} ({priceChangeRate.toFixed(2)}%)
                        </p>
                    ) : null}
                </div>
            </div>
        </header>
    );
};

export default DetailHeader;
