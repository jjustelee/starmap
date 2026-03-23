import React from 'react';
import { getMarketStatus } from '../utils/marketStatus';

const formatQuoteAge = (value) => {
    if (!value) return null;
    const updatedAtMs = new Date(value).getTime();
    if (!Number.isFinite(updatedAtMs)) return null;

    const diffMs = Date.now() - updatedAtMs;
    if (diffMs < 0) return '방금 전';

    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
};

const DetailHeader = ({ stock, basePrice, priceChange, priceChangeRate, quoteUpdatedAt, quoteErrorCode, onBack }) => {
    const market = getMarketStatus();
    const hasPrice = Number(basePrice) > 0;
    const statusText = hasPrice ? (formatQuoteAge(quoteUpdatedAt) || '시각없음') : '시각없음';
    const shouldShowQuoteStatus = market.isOpen;

    return (
        <header className="sticky top-3 z-50 mx-auto w-full transition-all duration-700 rounded-[1.25rem] crystal-glass px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <button onClick={onBack} className="text-[#9CA3AF] hover:text-[#F3F4F6] transition active:scale-95 bg-white/5 p-2 rounded-full shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[26px] leading-none">arrow_back_ios_new</span>
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-[19px] font-black text-[#F3F4F6] leading-tight tracking-tight truncate">{stock.name}</h1>
                    <p className="mt-0.5 font-brandEn text-[13px] font-black tracking-widest text-[#9CA3AF] uppercase truncate">{stock.symbol}</p>
                </div>
            </div>
            <div className="shrink-0 text-right flex flex-col items-end gap-1.5 min-w-0">
                <div className="flex items-center justify-end gap-2">
                    {market.isOpen ? (
                        <span className="flex h-2.5 w-2.5 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 duration-700"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.9)]"></span>
                        </span>
                    ) : null}
                    <p className="font-brandEn text-[26px] font-black text-[#F3F4F6] leading-none tracking-tighter truncate">
                        {hasPrice ? Number(basePrice).toLocaleString() : '갱신 중'}
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 min-h-[18px]">
                    {!market.isOpen ? (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-white/10 text-[#9CA3AF] uppercase tracking-tighter shrink-0">
                            {market.text}
                        </span>
                    ) : shouldShowQuoteStatus ? (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-white/10 text-[#9CA3AF] tracking-tighter shrink-0">
                            {statusText}
                        </span>
                    ) : null}
                    {hasPrice && (priceChange !== undefined && priceChangeRate !== undefined) ? (
                        <p className={`text-[12px] font-bold leading-none shrink-0 ${priceChange >= 0 ? 'text-[#FF86C3]' : 'text-[#7BD1FA]'}`}>
                            {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toLocaleString()} ({priceChangeRate.toFixed(2)}%)
                        </p>
                    ) : null}
                </div>
                {quoteErrorCode ? (
                    <p className="text-[10px] font-bold text-[#9CA3AF] leading-none tracking-tight">
                        {quoteErrorCode}
                    </p>
                ) : null}
            </div>
        </header>
    );
};

export default DetailHeader;
