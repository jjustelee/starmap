import React from 'react';
import { getMarketStatus } from '../utils/marketStatus';

const DetailHeader = ({ stock, basePrice, priceChange, priceChangeRate, onBack }) => {
    const market = getMarketStatus();

    return (
        <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2.5rem)] max-w-2xl transition-all duration-700 rounded-2xl crystal-glass px-6 py-5 flex justify-between items-center shadow-2xl">
            <div className="flex items-center gap-5">
                <button onClick={onBack} className="text-white/60 hover:text-white transition active:scale-95 bg-white/5 p-2 rounded-full">
                    <span className="material-symbols-outlined text-[28px]">arrow_back_ios_new</span>
                </button>
                <div>
                    <h1 className="text-xl font-black text-white leading-tight tracking-tight">{stock.name}</h1>
                    <p className="font-brandEn text-[13px] font-black tracking-widest text-white/60 uppercase">Symbol: {stock.symbol}</p>
                </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
                <div className="flex items-center gap-2.5">
                    {market.isOpen ? (
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-teal opacity-75 duration-700"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-teal shadow-[0_0_10px_rgba(34,211,238,0.9)]"></span>
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-white/40 uppercase tracking-tighter">
                            {market.text}
                        </span>
                    )}
                    <p className="font-brandEn text-3xl font-black text-white leading-none tracking-tighter">{basePrice.toLocaleString()}</p>
                </div>
                {(priceChange !== undefined && priceChangeRate !== undefined) && (
                    <p className={`text-xs font-bold leading-none ${priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                        {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toLocaleString()} ({priceChangeRate.toFixed(2)}%)
                    </p>
                )}
            </div>
        </header>
    );
};

export default DetailHeader;
