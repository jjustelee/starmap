import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyPredictions } from '../utils/mockData';
import { Target, LogOut, Star, TrendingUp, Clock, ChevronRight } from 'lucide-react';

/**
 * MyPage Component
 * [UX] 비로그인: 카카오 로그인 유도 / 로그인: 내 예언 기록 관리
 * 전체 톤앤매너(누아르/글래스모피즘)를 유지합니다.
 */
const MyPage = ({ onBack, onStockClick }) => {
    const { user, isLoggedIn, isLoading, profile, signInWithKakao, signOut } = useAuth();
    const [predictions, setPredictions] = useState([]);
    const [isLoadingPreds, setIsLoadingPreds] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // [백엔드] 로그인 유저의 예언 기록 로드
    useEffect(() => {
        if (isLoggedIn && user) {
            const load = async () => {
                setIsLoadingPreds(true);
                const data = await fetchMyPredictions(user.id);
                setPredictions(data || []);
                setIsLoadingPreds(false);
            };
            load();
        }
    }, [isLoggedIn, user]);

    // ── 로딩 상태 ──
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-8 h-8 border-4 border-neon-teal/20 border-t-neon-teal rounded-full animate-spin"></div>
                <p className="text-white/20 text-[13px] font-bold">오성(五星)을 연결하는 중...</p>
            </div>
        );
    }

    // ── 비로그인 상태 ──
    if (!isLoggedIn) {
        return (
            <div className="mx-auto max-w-2xl px-5 animate-in fade-in duration-700">
                <div className="text-center pt-16 pb-8 space-y-8">
                    {/* Hero Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-24 h-24 bg-gradient-to-br from-neon-teal/10 to-neon-pink/10 
                                            rounded-full flex items-center justify-center
                                            border border-white/10">
                                <Star className="w-12 h-12 text-white/20" />
                            </div>
                            <div className="absolute -inset-6 bg-neon-teal/5 rounded-full blur-2xl -z-10"></div>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-4">
                        <h2 className="text-[28px] font-black text-white leading-tight">
                            내 예언을<br />관리하고 싶다면
                        </h2>
                        <p className="text-[14px] text-white/40 leading-relaxed max-w-xs mx-auto">
                            카카오로 시작하면 박제한 기록을 모아볼 수 있고,<br />
                            적중 시 <span className="text-neon-teal font-bold">성지글 알림</span>을 받을 수 있습니다.
                        </p>
                    </div>

                    {/* Kakao Login */}
                    <div className="max-w-sm mx-auto space-y-4">
                        <button
                            onClick={signInWithKakao}
                            className="w-full flex items-center justify-center gap-3
                                       bg-[#FEE500] hover:bg-[#FADA0A] active:bg-[#E5CF00]
                                       text-[#191919] font-black text-[16px]
                                       rounded-2xl py-4 px-6
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
                    <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto pt-4">
                        {[
                            { icon: <Star className="w-4 h-4" />, text: '내 예언 기록 관리' },
                            { icon: <TrendingUp className="w-4 h-4" />, text: '적중률 추적 & 성지글 알림' },
                            { icon: <Clock className="w-4 h-4" />, text: '예측 히스토리 타임라인' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 
                                                      bg-white/5 border border-white/5 rounded-2xl">
                                <div className="text-neon-teal/60">{f.icon}</div>
                                <span className="text-[13px] font-bold text-white/50">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── 로그인 상태 ──
    return (
        <div className="mx-auto max-w-2xl px-5 animate-in fade-in duration-700">
            {/* Profile Card */}
            <div className="crystal-glass rounded-[2rem] p-6 mb-6 border border-white/10 
                            shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_-5px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        {profile?.avatar ? (
                            <img 
                                src={profile.avatar} 
                                alt="프로필" 
                                className="w-16 h-16 rounded-full border-2 border-neon-teal/30 object-cover"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-teal/20 to-neon-pink/20 
                                            border-2 border-white/10 flex items-center justify-center">
                                <span className="text-2xl font-black text-white/60">
                                    {profile?.nickname?.charAt(0) || '⭐'}
                                </span>
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neon-teal rounded-full 
                                        flex items-center justify-center border-2 border-[#0a0a10]">
                            <span className="text-[9px]">✓</span>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-black text-neon-teal brightness-125 truncate`}>{profile?.nickname || '별지기'}</h3>
                        <p className="text-[12px] font-bold text-neon-teal/40 truncate">{profile?.email || '카카오 로그인'}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/20 
                                             rounded-full text-[10px] font-black text-neon-teal uppercase tracking-wider">
                                정식 별지기
                            </span>
                            <span className="text-[11px] font-bold text-neon-teal/30">
                                기록 {predictions.length}개
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* My Predictions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[13px] font-black text-neon-teal/60 uppercase tracking-[0.25em]">내 예언 기록</h4>
                    <span className="text-[12px] font-bold text-neon-teal/30">{predictions.length}건</span>
                </div>

                {isLoadingPreds ? (
                    <div className="flex items-center justify-center gap-3 py-12">
                        <div className="w-5 h-5 border-2 border-white/10 border-t-neon-teal rounded-full animate-spin"></div>
                        <span className="text-white/30 text-sm font-bold">기록을 불러오는 중...</span>
                    </div>
                ) : predictions.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                        <div className="text-4xl opacity-30">🔮</div>
                        <p className="text-[14px] font-bold text-white/25">아직 박제한 예언이 없습니다</p>
                        <p className="text-[12px] text-white/15">종목 상세에서 목표가를 조준해보세요</p>
                    </div>
                ) : (
                    <div className="relative ml-4 pl-8 border-l border-white/10 space-y-8 pb-10">
                        {predictions.map((pred, idx) => {
                            const date = new Date(pred.created_at);
                            const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                            
                            // 상태별 테마 설정 (감정 기반)
                            let theme = {
                                color: 'text-hope-green',
                                bg: 'bg-hope-green/10',
                                border: 'border-hope-green/30',
                                glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]',
                                label: '진행중',
                                dot: 'bg-hope-green shadow-[0_0_10px_#10b981]'
                            };

                            if (pred.isHit) {
                                theme = {
                                    color: 'text-joy-gold',
                                    bg: 'bg-joy-gold/15',
                                    border: 'border-joy-gold/40',
                                    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
                                    label: '적중 완료',
                                    dot: 'bg-joy-gold shadow-[0_0_12px_#fbbf24]'
                                };
                            } else if (pred.isMissed) {
                                theme = {
                                    color: 'text-sad-blue',
                                    bg: 'bg-sad-blue/10',
                                    border: 'border-sad-blue/30',
                                    glow: 'shadow-none',
                                    label: '빗나감',
                                    dot: 'bg-sad-blue shadow-[0_0_8px_#64748b]'
                                };
                            } else {
                                // 진행중 (긍정/에메랄드) - 보더와 글로우 강화
                                theme = {
                                    color: 'text-hope-green',
                                    bg: 'bg-hope-green/10',
                                    border: 'border-hope-green/40',
                                    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                                    label: '진행중',
                                    dot: 'bg-hope-green shadow-[0_0_10px_#10b981]'
                                };
                            }

                            return (
                                <div key={pred.id} className="relative animate-in slide-in-from-left duration-500" style={{ delay: `${idx * 100}ms` }}>
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[41px] top-6 w-4 h-4 rounded-full border-4 border-[#0a0a10] z-10 ${theme.dot}`}></div>
                                    
                                    {/* Date Header */}
                                    <div className="mb-3">
                                        <span className="text-[11px] font-black text-neon-teal/30 tracking-widest uppercase">{dateStr}</span>
                                    </div>

                                    {/* Card */}
                                    <div className={`group relative crystal-glass rounded-[2rem] p-6 border-[0.5px] transition-all duration-300 ${theme.bg} ${theme.border} hover:bg-white/10 ${theme.glow}`}>
                                        {/* Header: Name + Status + Deletion */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div 
                                                className="cursor-pointer flex flex-col gap-1.5"
                                                onClick={() => pred.stock && onStockClick?.(pred.stock)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-[42px] font-black ${theme.color} brightness-125 group-hover:brightness-150 transition-all leading-none tracking-tighter`}>{pred.stockName}</span>
                                                    <span className={`text-[12px] font-black ${theme.color} opacity-40 uppercase tracking-tighter bg-white/5 px-2 py-1 rounded-md border border-white/10`}>{pred.stockSymbol}</span>
                                                </div>
                                                <div className="flex items-center gap-5 mt-2">
                                                    <span className={`text-[12px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border ${theme.border} ${theme.color} bg-black/60 shadow-lg shadow-black/20`}>
                                                        {theme.label}
                                                    </span>
                                                    <div className="flex items-center gap-2.5">
                                                        <span className={`text-[14px] font-black ${theme.color} opacity-30 uppercase tracking-tighter`}>기한</span>
                                                        <span className={`text-[16px] font-black ${theme.color}`}>{pred.target_date}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Deletion Layer */}
                                            <div className="flex items-center">
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
                                                                } catch (err) {
                                                                    alert('삭제에 실패했습니다.');
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-neon-pink text-white text-[12px] font-black rounded-xl shadow-lg shadow-neon-pink/20"
                                                        >
                                                            삭제
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeletingId(null);
                                                            }}
                                                            className="px-4 py-2 bg-white/10 text-white/60 text-[12px] font-black rounded-xl"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingId(pred.id);
                                                        }}
                                                        className={`p-2 ${theme.color} opacity-20 hover:opacity-100 hover:bg-white/5 rounded-full transition-all`}
                                                    >
                                                        <LogOut className="w-6 h-6 rotate-180" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content: Price Comparison (Super High Clarity Grid) */}
                                        <div className="grid grid-cols-2 gap-px bg-white/5 border-[0.5px] border-white/10 rounded-2xl overflow-hidden mb-8 shadow-2xl">
                                            <div className="bg-black/40 p-7 space-y-3">
                                                <p className={`text-[15px] font-black ${theme.color} opacity-40 uppercase tracking-widest`}>현재가</p>
                                                <p className={`text-[34px] font-black font-brandEn ${theme.color} brightness-110 leading-none`}>
                                                    {Number(pred.currentPrice).toLocaleString()}<span className="text-[16px] ml-1 opacity-20 font-brandKo">원</span>
                                                </p>
                                            </div>
                                            <div className={`bg-black/60 p-7 space-y-3 text-right`}>
                                                <p className={`text-[15px] font-black ${theme.color} opacity-40 uppercase tracking-widest`}>목표가</p>
                                                <p className={`text-[34px] font-black font-brandEn leading-none ${theme.color} brightness-125`}>
                                                    {Number(pred.price_target).toLocaleString()}<span className="text-[16px] ml-1 opacity-20 font-brandKo">원</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer: Prominent Action */}
                                        <button 
                                            onClick={() => pred.stock && onStockClick?.(pred.stock)}
                                            className={`w-full flex items-center justify-between py-4 px-8 rounded-2xl text-[15px] font-black ${theme.color} bg-white/5 hover:bg-white/10 border-[0.5px] ${theme.border} transition-all duration-300 group/btn shadow-lg`}
                                        >
                                            <span className="tracking-tight">성지 분석 리포트 확인</span>
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
                               text-[13px] font-bold text-white/20 hover:text-white/40 
                               transition-colors duration-200 border-t border-white/5 pt-6"
                >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                </button>
            </div>
        </div>
    );
};

export default MyPage;
