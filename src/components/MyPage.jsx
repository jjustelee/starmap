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
    const { user, isLoggedIn, profile, signInWithKakao, signOut } = useAuth();
    const [predictions, setPredictions] = useState([]);
    const [isLoadingPreds, setIsLoadingPreds] = useState(false);

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
                        <h3 className="text-lg font-black text-white truncate">{profile?.nickname || '별지기'}</h3>
                        <p className="text-[12px] font-bold text-white/30 truncate">{profile?.email || '카카오 로그인'}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-neon-teal/10 border border-neon-teal/20 
                                             rounded-full text-[10px] font-black text-neon-teal uppercase tracking-wider">
                                정식 별지기
                            </span>
                            <span className="text-[11px] font-bold text-white/30">
                                기록 {predictions.length}개
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* My Predictions */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[13px] font-black text-white/40 uppercase tracking-[0.2em]">내 예언 기록</h4>
                    <span className="text-[12px] font-bold text-white/20">{predictions.length}건</span>
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
                    <div className="space-y-2">
                        {predictions.map((pred) => (
                            <button
                                key={pred.id}
                                onClick={() => pred.stock && onStockClick?.(pred.stock)}
                                className="w-full crystal-glass rounded-2xl p-4 border border-white/5 
                                           hover:border-white/15 transition-all duration-300 
                                           flex items-center gap-4 text-left group active:scale-[0.99]"
                            >
                                {/* Status indicator */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                    ${pred.isHit ? 'bg-neon-teal/20 text-neon-teal' : 
                                      pred.isMissed ? 'bg-neon-pink/20 text-neon-pink' : 
                                      'bg-white/5 text-white/30'}`}>
                                    <Target className="w-5 h-5" />
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-black text-white truncate">
                                            {pred.stockName || '알 수 없음'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider
                                            ${pred.isHit ? 'bg-neon-teal/20 text-neon-teal' : 
                                              pred.isMissed ? 'bg-neon-pink/20 text-neon-pink' : 
                                              'bg-white/10 text-white/30'}`}>
                                            {pred.isHit ? '적중' : pred.isMissed ? '빗나감' : '진행중'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[12px] font-bold text-white/30">
                                        <span>목표가 {Number(pred.price_target).toLocaleString()}원</span>
                                        <span>•</span>
                                        <span>{pred.target_date || '미정'}</span>
                                    </div>
                                </div>

                                <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 
                                                          transition shrink-0" />
                            </button>
                        ))}
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
