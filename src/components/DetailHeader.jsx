import React from 'react';
import { getMarketStatus } from '../utils/marketStatus';

const DetailHeader = ({ stock, basePrice, priceChange, priceChangeRate, quoteStatusLabel, onBack }) => {
    const market = getMarketStatus();
    const hasPrice = Number(basePrice) > 0;
    const statusText = hasPrice ? (quoteStatusLabel || '최근값') : '갱신중';

    return (
        <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2.5rem)] max-w-2xl transition-all duration-700 rounded-2xl crystal-glass px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 shadow-2xl">
            <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto min-w-0">
                <button onClick={onBack} className="text-white/60 hover:text-white transition active:scale-95 bg-white/5 p-2 rounded-full flex-shrink-0">
                    <span className="material-symbols-outlined text-[24px] sm:text-[28px]">arrow_back_ios_new</span>
                </button>
                <div className="min-w-0">
                    <h1 className="text-[18px] sm:text-xl font-black text-white leading-tight tracking-tight truncate">{stock.name}</h1>
                    <p className="font-brandEn text-[12px] sm:text-[13px] font-black tracking-widest text-white/60 uppercase truncate">{stock.symbol}</p>
                </div>
            </div>
            <div className="w-full sm:w-auto text-left sm:text-right flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 sm:gap-1">
                <div className="flex items-center gap-2.5">
                    {market.isOpen ? (
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 duration-700"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.9)]"></span>
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-white/40 uppercase tracking-tighter">
                            {market.text}
                        </span>
                    )}
                    <p className="font-brandEn text-[28px] sm:text-3xl font-black text-white leading-none tracking-tighter">
                        {hasPrice ? Number(basePrice).toLocaleString() : '시세 동기화 중'}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-white/55 tracking-tighter">
                        {statusText}
                    </span>
                </div>
                {hasPrice && (priceChange !== undefined && priceChangeRate !== undefined) && (
                    <p className={`text-xs font-bold leading-none ${priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                        {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toLocaleString()} ({priceChangeRate.toFixed(2)}%)
                    </p>
                )}
            </div>
        </header>
    );
};

export default DetailHeader;
