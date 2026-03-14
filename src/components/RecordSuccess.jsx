import React from 'react';
import { BadgeCheck, Share2, ChevronRight, Home, ExternalLink } from 'lucide-react';

export const RecordSuccess = ({ stock, targetPrice, onHome }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center animate-in zoom-in-95 duration-700">
            {/* Success Icon with Glow */}
            <div className="relative">
                <div className="absolute inset-0 bg-neon-teal blur-3xl opacity-40 rounded-full"></div>
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-tr from-neon-teal to-neon-pink p-1 shadow-glowTeal">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
                        <BadgeCheck className="w-12 h-12 text-neon-teal" />
                    </div>
                </div>
            </div>

            {/* Success Message */}
            <div className="space-y-3">
                <h2 className="text-4xl font-black text-white tracking-tight">기록 박제 성공!</h2>
                <p className="text-white/50 text-base leading-relaxed">
                    당신의 예측이 박제되었습니다.<br />
                    이제 {stock.name}이(가) <span className="text-neon-pink font-bold">{targetPrice.toLocaleString()}원</span>에<br />
                    도달하면 이 기록은 성지글이 됩니다.
                </p>
            </div>

            {/* Record Card */}
            <div className="w-full max-w-sm crystal-glass p-6 rounded-3xl border-neon-teal/30 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="text-left">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{stock.symbol}</p>
                        <h3 className="text-xl font-black text-white">{stock.name}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-neon-teal bg-neon-teal/10 px-2 py-1 rounded">기록 완료</p>
                </div>

                <div className="h-px w-full bg-white/10"></div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white/30 uppercase">기록 목표가</p>
                        <p className="text-xl font-black text-neon-pink">{targetPrice.toLocaleString()}원</p>
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white/30 uppercase">현재가</p>
                        <p className="text-xl font-black text-white">{stock.currentPrice.toLocaleString()}원</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="w-full max-w-sm space-y-3">
                <button className="w-full rounded-2xl bg-white text-black py-5 text-lg font-black flex items-center justify-center gap-2 hover:opacity-90 transition active:scale-95">
                    <Share2 className="w-5 h-5" />
                    친구에게 자랑하기
                </button>
                <button
                    onClick={onHome}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 text-white/80 py-4 text-base font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition active:scale-95"
                >
                    <Home className="w-4 h-4" />
                    홈으로 돌아가기
                </button>
            </div>

            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                YOU ARE NOW PART OF THE LEGEND
            </p>
        </div>
    );
};
