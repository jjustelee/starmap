import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, ChevronRight, Share2, Target } from 'lucide-react';
import { fetchStockInfo } from '../utils/mockData';
import { shareContent } from '../utils/shareContent';

export const RecordSuccess = ({ stock, targetPrice, onHome, onViewMyPredictions, onViewStock }) => {
    const [latestPrice, setLatestPrice] = useState(Number(stock?.currentPrice || 0));
    const [latestQuoteStatusLabel, setLatestQuoteStatusLabel] = useState(
        Number(stock?.currentPrice || 0) > 0 ? (stock?.quoteStatusLabel || '최근값') : '갱신중'
    );
    const [shareFeedback, setShareFeedback] = useState('');

    const stockUrl = useMemo(() => {
        if (!stock?.symbol) return '';
        if (typeof window === 'undefined') return `/stock/${stock.symbol}`;
        return `${window.location.origin}/stock/${stock.symbol}`;
    }, [stock?.symbol]);

    useEffect(() => {
        setLatestPrice(Number(stock?.currentPrice || 0));
        setLatestQuoteStatusLabel(Number(stock?.currentPrice || 0) > 0 ? (stock?.quoteStatusLabel || '최근값') : '갱신중');
        setShareFeedback('');
        if (!stock?.symbol) return;
        fetchStockInfo(stock.symbol)
            .then((info) => {
                const nextPrice = Number(info?.currentPrice || 0);
                if (nextPrice > 0) {
                    setLatestPrice(nextPrice);
                    setLatestQuoteStatusLabel(info?.quoteStatusLabel || '최근값');
                    return;
                }
                setLatestQuoteStatusLabel('갱신중');
            })
            .catch(() => {
                // 최신가 조회 실패 시 기존 표시값을 유지합니다.
            });
    }, [stock?.symbol, stock?.currentPrice, stock?.quoteStatusLabel]);

    const handleShare = async () => {
        const result = await shareContent({
            title: `${stock.name} 예언 박제`,
            text: latestPrice > 0
                ? `${stock.name} ${targetPrice.toLocaleString()}원 각으로 박제했습니다. 지금 현재가는 ${latestPrice.toLocaleString()}원입니다. 맞으면 성지 갑니다.`
                : `${stock.name} ${targetPrice.toLocaleString()}원 각으로 박제했습니다. 맞으면 성지 갑니다.`,
            url: stockUrl
        });

        if (result === 'shared') {
            setShareFeedback('공유창을 열었습니다');
            return;
        }
        if (result === 'copied') {
            setShareFeedback('링크를 복사했습니다');
            return;
        }
        if (result === 'unsupported') {
            setShareFeedback('이 기기에서는 공유를 지원하지 않습니다');
            return;
        }
        setShareFeedback('공유에 실패했습니다');
    };

    if (!stock) return <div className="text-white p-12 text-center font-bold">종목 정보를 찾을 수 없습니다.</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 sm:space-y-8 text-center animate-in zoom-in-95 duration-700">
            {/* Success Icon with Glow */}
            <div className="relative">
                <div className="absolute inset-0 bg-neon-teal blur-3xl opacity-40 rounded-full"></div>
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-tr from-neon-teal to-neon-pink p-1 shadow-glowTeal">
                    <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
                        <BadgeCheck className="w-10 h-10 sm:w-12 sm:h-12 text-neon-teal" />
                    </div>
                </div>
            </div>

            {/* Success Message */}
            <div className="space-y-2.5 sm:space-y-3">
                <h2 className="text-[30px] sm:text-4xl font-black text-white tracking-tight">예언 박제 완료!</h2>
                <p className="text-white/50 text-[14px] sm:text-base leading-6 sm:leading-relaxed">
                    이제 이 예언은 기록에 남았습니다.<br />
                    기한 종가가 맞으면 <span className="text-neon-pink font-bold">성지글</span>로 올라갑니다.
                </p>
            </div>

            {/* Record Card */}
            <div className="w-full max-w-sm crystal-glass p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-neon-teal/30 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-start">
                    <div className="text-left">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{stock.symbol}</p>
                        <h3 className="text-lg sm:text-xl font-black text-white">{stock.name}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-neon-teal bg-neon-teal/10 px-2 py-1 rounded">기록 완료</p>
                </div>

                <div className="h-px w-full bg-white/10"></div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white/30 uppercase">기록 목표가</p>
                        <p className="text-lg sm:text-xl font-black text-neon-pink">{targetPrice.toLocaleString()}원</p>
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white/30 uppercase">현재가</p>
                        <p className="text-lg sm:text-xl font-black text-white">
                            {latestPrice > 0 ? `${latestPrice.toLocaleString()}원` : '시세 동기화 중'}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-white/40 uppercase tracking-[0.14em]">
                            {latestPrice > 0 ? latestQuoteStatusLabel : '갱신중'}
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left">
                    <p className="text-[11px] font-bold text-white/35 uppercase tracking-[0.16em]">판정 기준</p>
                    <p className="mt-1 text-[13px] font-bold text-white/70">기한 종가 기준으로 최종 판정됩니다</p>
                </div>
            </div>

            {/* Actions */}
            <div className="w-full max-w-sm space-y-3">
                <button
                    onClick={onViewMyPredictions}
                    className="w-full rounded-2xl bg-white text-black py-4 sm:py-5 text-base sm:text-lg font-black flex items-center justify-center gap-2 hover:opacity-90 transition active:scale-95"
                >
                    <Target className="w-5 h-5" />
                    내 예언 기록 보기
                </button>
                <button
                    onClick={onViewStock}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 text-white/80 py-4 text-base font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition active:scale-95"
                >
                    <ChevronRight className="w-4 h-4" />
                    같은 종목 다시 보기
                </button>
                <button
                    onClick={handleShare}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 text-white/80 py-4 text-base font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition active:scale-95"
                >
                    <Share2 className="w-4 h-4" />
                    예언 공유하기
                </button>
                {shareFeedback && (
                    <p className="text-center text-[12px] font-bold text-white/45">
                        {shareFeedback}
                    </p>
                )}
                <button
                    onClick={onHome}
                    className="w-full text-center text-[14px] font-bold text-white/55 hover:text-white transition active:scale-95 pt-1"
                >
                    홈으로
                </button>
            </div>

            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                이제 이 기록도 성지 후보입니다
            </p>
        </div>
    );
};
