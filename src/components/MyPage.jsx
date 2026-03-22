import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyNotifications, fetchMyPredictions, fetchStockInfo, markNotificationRead } from '../utils/mockData';
import { shareContent } from '../utils/shareContent';
import { Target, LogOut, Star, TrendingUp, Clock, ChevronRight, Trash2, Bell, Share2 } from 'lucide-react';

/**
 * MyPage Component
 * [UX] 비로그인: 카카오 로그인 유도 / 로그인: 내 예언 기록 관리
 * 전체 톤앤매너(누아르/글래스모피즘)를 유지합니다.
 */
const MyPage = ({ onBack, onStockClick, onNavigatePath }) => {
    const { user, isLoggedIn, isLoading, profile, signInWithKakao, signOut } = useAuth();
    const [predictions, setPredictions] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingPreds, setIsLoadingPreds] = useState(false);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteFeedbackId, setDeleteFeedbackId] = useState('');
    const [deleteFeedbackMessage, setDeleteFeedbackMessage] = useState('');
    const [shareFeedbackId, setShareFeedbackId] = useState('');
    const [shareFeedbackMessage, setShareFeedbackMessage] = useState('');
    const [isGuideExpanded, setIsGuideExpanded] = useState(false);

    const handleShare = async (e, pred) => {
        e.stopPropagation();
        setShareFeedbackId('');
        setShareFeedbackMessage('');
        const targetPrice = Number(pred.price_target || 0);
        const stockUrl = `${window.location.origin}/stock/${pred.stockSymbol}`;
        const result = await shareContent({
            title: `콕콕 KOKOK - ${pred.stockName} 예언`,
            text: `🎯 ${pred.stockName} ${targetPrice.toLocaleString()}원 각으로 예언 완료! 맞으면 성지 갑니다.`,
            url: stockUrl
        });

        setShareFeedbackId(pred.id);
        if (result === 'shared') {
            setShareFeedbackMessage('공유창을 띄웠습니다');
        } else if (result === 'copied') {
            setShareFeedbackMessage('예언 링크를 복사했습니다');
        } else if (result === 'unsupported') {
            setShareFeedbackMessage('해당 기기에서는 공유를 지원하지 않습니다');
        } else {
            setShareFeedbackMessage('공유에 실패했습니다');
        }

        setTimeout(() => setShareFeedbackId(''), 3000);
    };

    // [백엔드] 로그인 유저의 예언 기록 로드
    useEffect(() => {
        if (isLoggedIn && user) {
            const load = async () => {
                setIsLoadingPreds(true);
                const data = await fetchMyPredictions(user.id);
                setPredictions(data || []);
                setIsLoadingPreds(false);

                // 현재가가 비어 있는 종목만 백그라운드로 보강합니다.
                const targetSymbols = [
                    ...new Set(
                        (data || [])
                            .filter((p) => Number(p?.currentPrice || 0) <= 0)
                            .map((p) => p.stockSymbol)
                            .filter(Boolean)
                    )
                ];
                if (targetSymbols.length > 0) {
                    const updates = await Promise.all(
                        targetSymbols.map(async (symbol) => {
                            try {
                                const info = await fetchStockInfo(symbol);
                                const price = Number(info?.currentPrice || 0);
                                return price > 0
                                    ? {
                                        symbol,
                                        currentPrice: price,
                                        quoteStatusLabel: info?.quoteStatusLabel || '최근값'
                                    }
                                    : null;
                            } catch (e) {
                                return null;
                            }
                        })
                    );
                    const priceMap = updates.filter(Boolean).reduce((acc, item) => {
                        acc[item.symbol] = item;
                        return acc;
                    }, {});
                    if (Object.keys(priceMap).length > 0) {
                        setPredictions((prev) => prev.map((pred) => {
                            const nextInfo = priceMap[pred.stockSymbol];
                            if (!nextInfo) return pred;
                            return {
                                ...pred,
                                currentPrice: nextInfo.currentPrice,
                                quoteStatusLabel: nextInfo.quoteStatusLabel,
                                stock: pred.stock ? { ...pred.stock, currentPrice: nextInfo.currentPrice } : pred.stock
                            };
                        }));
                    }
                }
            };
            load();
        }
    }, [isLoggedIn, user]);

    useEffect(() => {
        if (isLoggedIn && user) {
            const loadNotifications = async () => {
                setIsLoadingNotifications(true);
                const data = await fetchMyNotifications();
                setNotifications(data || []);
                setIsLoadingNotifications(false);
            };
            loadNotifications();
        }
    }, [isLoggedIn, user]);

    // ── 로딩 상태 ──
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-8 h-8 border-4 border-neon-teal/20 border-t-neon-teal rounded-full animate-spin"></div>
                <p className="text-[#6B7280] text-sm font-bold">불러오는 중</p>
            </div>
        );
    }

    // ── 비로그인 상태 ──
    if (!isLoggedIn) {
        return (
            <div className="mx-auto max-w-2xl px-4 sm:px-5 animate-in fade-in duration-700">
                <div className="text-center pt-12 sm:pt-16 pb-8 space-y-6 sm:space-y-8">
                    {/* Hero Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-neon-teal/10 to-neon-pink/10 
                                            rounded-full flex items-center justify-center
                                            border border-white/10">
                                <Star className="w-10 h-10 sm:w-12 sm:h-12 text-[#6B7280]" />
                            </div>
                            <div className="absolute -inset-6 bg-neon-teal/5 rounded-full blur-2xl -z-10"></div>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-4">
                        <h2 className="text-[26px] sm:text-[32px] font-black text-[#F3F4F6] leading-tight">
                            내 예언을<br />관리하고 싶다면
                        </h2>
                        <p className="text-[15px] sm:text-sm text-[#9CA3AF] leading-6 sm:leading-relaxed max-w-xs mx-auto">
                            카카오로 시작하면 박제한 기록을 모아볼 수 있고,<br />
                            내 예언 기록과 적중 흐름을 한곳에서 차분하게 확인할 수 있습니다.
                        </p>
                    </div>

                    {/* Kakao Login */}
                    <div className="max-w-sm mx-auto space-y-3.5 sm:space-y-4">
                        <button
                            onClick={signInWithKakao}
                            className="w-full flex items-center justify-center gap-3
                                       bg-[#FEE500] hover:bg-[#FADA0A] active:bg-[#E5CF00]
                                       text-[#191919] font-black text-[17px] sm:text-base
                                       rounded-2xl py-3.5 sm:py-4 px-5 sm:px-6
                                       transition-all duration-200 active:scale-[0.98]
                                       shadow-[0_4px_20px_rgba(254,229,0,0.15)]"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#191919">
                                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.66 1.76 4.98 4.38 6.3-.14.52-.9 3.34-.93 3.56 0 0-.02.16.08.22.1.06.22.02.22.02.3-.04 3.44-2.26 3.98-2.64.72.1 1.48.16 2.26.16 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/>
                            </svg>
                            카카오로 시작하기
                        </button>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3 max-w-sm mx-auto pt-3 sm:pt-4">
                        {[
                            { icon: <Star className="w-4 h-4" />, text: '내 예언 기록 관리' },
                            { icon: <TrendingUp className="w-4 h-4" />, text: '적중률 추적 & 성지 기록 확인' },
                            { icon: <Clock className="w-4 h-4" />, text: '예측 히스토리 타임라인' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 
                                                      bg-white/5 border border-white/5 rounded-2xl">
                                <div className="text-neon-teal/60">{f.icon}</div>
                                <span className="text-[15px] sm:text-sm font-bold text-[#9CA3AF]">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── 로그인 상태 ──
    return (
        <div className="mx-auto max-w-2xl px-4 sm:px-5 animate-in fade-in duration-700">
            {/* Profile Card */}
            <div className="crystal-glass rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 mb-5 sm:mb-6 border border-white/10 
                            shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-5px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-3 sm:gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        {profile?.avatar ? (
                            <img 
                                src={profile.avatar} 
                                alt="프로필" 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-neon-teal/30 object-cover"
                            />
                        ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-neon-teal/20 to-neon-pink/20 
                                            border-2 border-white/10 flex items-center justify-center">
                                <span className="text-xl sm:text-2xl font-black text-[#9CA3AF]">
                                    {profile?.nickname?.charAt(0) || '⭐'}
                                </span>
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neon-teal rounded-full 
                                        flex items-center justify-center border-2 border-[#0a0a10]">
                            <span className="text-xs">✓</span>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-base sm:text-lg font-black text-neon-teal brightness-125 truncate`}>{profile?.nickname || '별지기'}</h3>
                        <p className="text-xs sm:text-[15px] font-bold text-neon-teal/40 truncate">{profile?.email || '카카오 로그인'}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/20 
                                             rounded-full text-xs font-black text-neon-teal uppercase tracking-wider">
                                정식 별지기
                            </span>
                            <span className="text-xs sm:text-xs font-bold text-neon-teal/30">
                                기록 {predictions.length}개
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-white/10 bg-white/5 p-4 sm:p-5 mb-5 sm:mb-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-neon-teal/10 border border-neon-teal/15 flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4 text-neon-teal" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[15px] sm:text-sm font-black text-neon-teal/70 uppercase tracking-[0.18em]">새 소식</p>
                            <p className="text-xs sm:text-[15px] text-[#9CA3AF]">기한 도래와 적중 흐름만 먼저 모아 보여줍니다</p>
                        </div>
                    </div>
                    <span className="text-xs sm:text-[15px] font-bold text-neon-teal/40 shrink-0">
                        새 알림 {notifications.filter(item => !item.is_read).length}개
                    </span>
                </div>

                {isLoadingNotifications ? (
                    <div className="py-4 text-center text-[15px] font-bold text-[#9CA3AF]">새 소식 불러오는 중</div>
                ) : notifications.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-[#121212]/20 px-4 py-4 text-center">
                        <p className="text-[15px] sm:text-sm font-bold text-[#9CA3AF]">아직 새 소식이 없습니다</p>
                        <p className="text-xs sm:text-[15px] text-[#6B7280] mt-1">기한 도래와 적중 소식이 여기에 뜹니다</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {notifications.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={async () => {
                                    setNotifications((prev) => prev.map((notif) => notif.id === item.id ? { ...notif, is_read: true } : notif));
                                    await markNotificationRead(item.id);
                                    if (item.target_path) {
                                        onNavigatePath?.(item.target_path);
                                    }
                                }}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${item.is_read ? 'border-white/5 bg-[#121212]/15' : 'border-neon-teal/15 bg-neon-teal/5'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className={`text-[15px] sm:text-sm font-black ${item.is_read ? 'text-[#D1D5DB]' : 'text-[#F3F4F6]'}`}>{item.title}</p>
                                        <p className="text-xs sm:text-[15px] text-[#9CA3AF] mt-1.5 leading-relaxed">{item.body}</p>
                                    </div>
                                    {!item.is_read ? (
                                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-neon-teal shadow-[0_0_10px_rgba(34,211,238,0.5)] shrink-0"></span>
                                    ) : null}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* My Predictions */}
            <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[15px] sm:text-sm font-black text-neon-teal/60 uppercase tracking-[0.22em]">내 예언 기록</h4>
                    <span className="text-xs sm:text-[15px] font-bold text-neon-teal/30">{predictions.length}건</span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 sm:px-4 sm:py-3.5 space-y-1.5">
                    <p className="text-xs sm:text-[15px] font-black text-neon-teal/70 tracking-wider uppercase">판정 룰</p>
                    <p className="text-xs sm:text-[15px] text-[#9CA3AF]">기한일 종가 기준 · <span className="text-joy-gold font-bold">1%</span> 적중 · <span className="text-joy-gold/90 font-bold">3%</span> 근접</p>
                    <button
                        type="button"
                        onClick={() => setIsGuideExpanded(prev => !prev)}
                        className="text-xs sm:text-[15px] font-bold text-neon-teal/80 hover:text-neon-teal transition-colors pt-1"
                    >
                        {isGuideExpanded ? '접기' : '더보기'}
                    </button>
                    {isGuideExpanded && (
                        <div className="mt-1.5 rounded-xl border border-white/10 bg-[#121212]/20 px-3 py-2.5 space-y-1.5">
                            <p className="text-xs sm:text-[15px] text-[#D1D5DB]">1. 기한일 종가로 최종 판정합니다.</p>
                            <p className="text-xs sm:text-[15px] text-[#D1D5DB]">2. 오차율 = `|실제 종가 - 예언가| / 예언가 × 100`</p>
                            <p className="text-xs sm:text-[15px] text-[#D1D5DB]">3. 5% 이내면 아슬아슬, 그 밖은 빗나감으로 봅니다.</p>
                            <p className="text-xs sm:text-[15px] text-[#D1D5DB]">4. 근접 적중은 적중 그룹으로 집계되고, 기한 전에는 진행중으로 표시됩니다.</p>
                            <p className="text-xs sm:text-[15px] text-[#9CA3AF]">시장 휴장/데이터 지연 시 실제 반영 시점이 늦어질 수 있습니다.</p>
                        </div>
                    )}
                </div>

                {isLoadingPreds ? (
                    <div className="flex items-center justify-center gap-3 py-12">
                        <div className="w-5 h-5 border-2 border-white/10 border-t-neon-teal rounded-full animate-spin"></div>
                        <span className="text-[#6B7280] text-sm font-bold">기록 불러오는 중</span>
                    </div>
                ) : predictions.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                        <div className="text-4xl opacity-30">🔮</div>
                        <p className="text-[17px] font-bold text-[#6B7280]">아직 예언이 없습니다</p>
                        <p className="text-[15px] text-[#6B7280]">종목 상세에서 예언을 남겨보세요</p>
                        <button
                            type="button"
                            onClick={() => onBack?.()}
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-neon-teal/25 bg-neon-teal/10 px-4 py-2 text-sm font-black text-neon-teal transition hover:bg-neon-teal/15"
                        >
                            종목 찾으러 가기
                        </button>
                    </div>
                ) : (
                    <div className="relative ml-2.5 sm:ml-4 pl-5 sm:pl-8 border-l border-white/10 space-y-5 sm:space-y-8 pb-7 sm:pb-10">
                        {predictions.map((pred, idx) => {
                            const dateStr = formatDisplayDate(pred.created_at);
                            const targetDateStr = formatDisplayDate(pred.target_date);
                            const currentPriceValue = Number(pred.currentPrice || 0);
                            
                            // 상태별 테마 설정 (감정 기반)
                            let theme = {
                                color: 'text-hope-green',
                                bg: 'bg-hope-green/10',
                                border: 'border-hope-green/30',
                                glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]',
                                label: '진행중',
                                dot: 'bg-hope-green shadow-[0_0_10px_#10b981]'
                            };

                            if (pred.judgmentStatus === 'HIT_EXACT' || pred.judgmentStatus === 'HIT_NEAR') {
                                theme = {
                                    color: 'text-joy-gold',
                                    bg: 'bg-joy-gold/15',
                                    border: 'border-joy-gold/40',
                                    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
                                    label: pred.judgmentLabel || '적중 완료',
                                    dot: 'bg-joy-gold shadow-[0_0_12px_#fbbf24]'
                                };
                            } else if (pred.judgmentStatus === 'MISSED') {
                                theme = {
                                    color: 'text-sad-blue',
                                    bg: 'bg-sad-blue/10',
                                    border: 'border-sad-blue/30',
                                    glow: 'shadow-none',
                                    label: pred.judgmentLabel || '빗나감',
                                    dot: 'bg-sad-blue shadow-[0_0_8px_#64748b]'
                                };
                            } else if (pred.judgmentStatus === 'CLOSE_CALL') {
                                theme = {
                                    color: 'text-hope-green',
                                    bg: 'bg-hope-green/10',
                                    border: 'border-hope-green/40',
                                    glow: 'shadow-[0_0_16px_rgba(16,185,129,0.12)]',
                                    label: pred.judgmentLabel || '아슬아슬',
                                    dot: 'bg-hope-green shadow-[0_0_10px_#10b981]'
                                };
                            } else {
                                // 진행중 (긍정/에메랄드) - 보더와 글로우 강화
                                theme = {
                                    color: 'text-hope-green',
                                    bg: 'bg-hope-green/10',
                                    border: 'border-hope-green/40',
                                    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                                    label: pred.judgmentLabel || '진행중',
                                    dot: 'bg-hope-green shadow-[0_0_10px_#10b981]'
                                };
                            }

                            return (
                                <div key={pred.id} className="relative animate-in slide-in-from-left duration-500" style={{ delay: `${idx * 100}ms` }}>
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[27px] sm:-left-[41px] top-4.5 sm:top-6 w-3 h-3 sm:w-4 sm:h-4 rounded-full border-[3px] sm:border-4 border-[#0a0a10] z-10 ${theme.dot}`}></div>
                                    
                                    {/* Date Header */}
                                    <div className="mb-2.5 sm:mb-3">
                                        <span className="text-xs font-black text-neon-teal/30 tracking-widest uppercase">{dateStr}</span>
                                    </div>

                                    {/* Card */}
                                    <div className={`group relative crystal-glass rounded-[1.35rem] sm:rounded-[2rem] p-3.5 sm:p-6 border-[0.5px] transition-all duration-300 ${theme.bg} ${theme.border} hover:bg-white/10 ${theme.glow}`}>
                                        {/* Header: Name + Status + Deletion */}
                                        <div className="flex justify-between items-start mb-3.5 sm:mb-6 gap-3">
                                            <div 
                                                className="cursor-pointer flex flex-col gap-1.5 min-w-0 flex-1"
                                                onClick={() => pred.stock && onStockClick?.(pred.stock)}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className={`text-xs sm:text-[15px] font-black uppercase tracking-widest px-2.5 sm:px-4 py-1.5 rounded-xl border ${theme.border} ${theme.color} bg-[#121212]/60 shadow-lg shadow-black/20 shrink-0`}>
                                                        {theme.label}
                                                    </span>
                                                    <span className={`text-xl sm:text-[40px] font-black ${theme.color} brightness-125 group-hover:brightness-150 transition-all leading-none tracking-tighter truncate`}>{pred.stockName}</span>
                                                    <span className={`text-xs sm:text-[15px] font-black ${theme.color} opacity-40 uppercase tracking-tighter bg-white/5 px-2 py-1 rounded-md border border-white/10 shrink-0`}>{pred.stockSymbol}</span>
                                                </div>
                                                <div className="flex items-center gap-2.5 sm:gap-5 mt-1.5 sm:mt-2 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className={`text-[15px] sm:text-[17px] font-black ${theme.color} opacity-30 uppercase tracking-tighter shrink-0`}>기한</span>
                                                        <span className={`text-sm sm:text-base font-black ${theme.color} tracking-tight truncate`}>{targetDateStr}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons Layer */}
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                {deletingId === pred.id ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const { deletePrediction } = await import('../utils/mockData');
                                                                    await deletePrediction(pred.id);
                                                                    setPredictions(prev => prev.filter(p => p.id !== pred.id));
                                                                    setDeletingId(null);
                                                                    setDeleteFeedbackId('');
                                                                    setDeleteFeedbackMessage('');
                                                                } catch (err) {
                                                                    setDeleteFeedbackId(pred.id);
                                                                    setDeleteFeedbackMessage('삭제에 실패했어요');
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-neon-pink text-[#F3F4F6] text-[15px] font-black rounded-xl shadow-lg shadow-neon-pink/20"
                                                        >
                                                            삭제
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeletingId(null);
                                                            }}
                                                            className="px-4 py-2 bg-white/10 text-[#9CA3AF] text-[15px] font-black rounded-xl"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={(e) => handleShare(e, pred)}
                                                            className={`p-2 ${theme.color} opacity-30 hover:opacity-100 hover:bg-white/5 rounded-full transition-all shrink-0`}
                                                            title="카카오톡/외부로 예언 공유하기"
                                                        >
                                                            <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeletingId(pred.id);
                                                            }}
                                                            className={`p-2 ${theme.color} opacity-25 hover:opacity-100 hover:bg-white/5 rounded-full transition-all shrink-0`}
                                                            title="삭제"
                                                        >
                                                            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {deleteFeedbackId === pred.id && deleteFeedbackMessage ? (
                                            <p className="mb-3 text-xs font-bold text-[#9CA3AF]">
                                                {deleteFeedbackMessage}
                                            </p>
                                        ) : shareFeedbackId === pred.id && shareFeedbackMessage ? (
                                            <p className="mb-3 text-xs font-bold text-neon-teal animate-in fade-in duration-300">
                                                {shareFeedbackMessage}
                                            </p>
                                        ) : null}

                                        {/* Content: Price Comparison (Super High Clarity Grid) */}
                                        <div className="grid grid-cols-2 gap-px bg-white/5 border-[0.5px] border-white/10 rounded-2xl overflow-hidden mb-5 sm:mb-8 shadow-2xl">
                                            <div className="bg-[#121212]/40 p-3.5 sm:p-7 space-y-2 sm:space-y-3">
                                                <p className={`text-xs sm:text-base font-black ${theme.color} opacity-40 uppercase tracking-widest`}>현재가</p>
                                                {currentPriceValue > 0 ? (
                                                    <p className={`text-[26px] sm:text-[34px] font-black font-brandEn ${theme.color} brightness-110 leading-none truncate`}>
                                                        {currentPriceValue.toLocaleString()}<span className="text-xs sm:text-[19px] ml-1 opacity-20 font-brandKo">원</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-base sm:text-[21px] font-black text-[#9CA3AF] leading-none">시세 동기화 중</p>
                                                )}
                                                <p className="text-xs font-black text-[#9CA3AF] tracking-[0.14em] uppercase">{currentPriceValue > 0 ? (pred.quoteStatusLabel || '최근값') : '갱신중'}</p>
                                            </div>
                                            <div className={`bg-[#121212]/60 p-3.5 sm:p-7 space-y-2 sm:space-y-3 text-right`}>
                                                <p className={`text-xs sm:text-base font-black ${theme.color} opacity-40 uppercase tracking-widest`}>목표가</p>
                                                <p className={`text-[26px] sm:text-[34px] font-black font-brandEn leading-none ${theme.color} brightness-125 truncate`}>
                                                    {Number(pred.price_target).toLocaleString()}<span className="text-xs sm:text-[19px] ml-1 opacity-20 font-brandKo">원</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer: Prominent Action */}
                                        <button 
                                            onClick={() => pred.stock && onStockClick?.(pred.stock)}
                                            className={`w-full flex items-center justify-between py-3.5 sm:py-4 px-5 sm:px-8 rounded-2xl text-sm sm:text-[17px] font-black ${theme.color} bg-white/5 hover:bg-white/10 border-[0.5px] ${theme.border} transition-all duration-300 group/btn shadow-lg`}
                                        >
                                            <span className="tracking-tight">이 종목 다시 보기</span>
                                            <ChevronRight className={`w-6 h-6 group-hover:translate-x-1.5 transition-transform`} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Logout */}
            <div className="mt-12 mb-8">
                <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-2 py-3 
                               text-sm font-bold text-[#6B7280] hover:text-[#9CA3AF] 
                               transition-colors duration-200 border-t border-white/5 pt-6"
                >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                </button>
            </div>
        </div>
    );
};

function formatDisplayDate(value) {
    if (typeof value !== 'string') return '-';
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}.${isoMatch[2]}.${isoMatch[3]}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

export default MyPage;
