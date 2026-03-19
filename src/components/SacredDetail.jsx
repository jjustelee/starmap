import React from 'react';
import { BadgeCheck, ChevronLeft, Share2, TrendingUp, Calendar, Target } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchSacredPosts } from '../utils/mockData';
import { shareContent } from '../utils/shareContent';
import { useAuth } from '../context/AuthContext';
import { fetchUserSacredReactions, toggleSacredReaction } from '../utils/sacredReactions';

const SACRED_REACTION_OPTIONS = [
    { key: 'sacred_ack', label: '성지 인정' },
    { key: 'nailed_it', label: '이건 맞았다' },
    { key: 'legend_call', label: '전설각 인정' },
    { key: 'close_but_great', label: '근접해도 대단' },
    { key: 'wish_i_saw_it', label: '나도 봤어야 했는데' }
];

export const SacredDetail = ({ onBack }) => {
    const { id } = useParams();
    const { user, isLoggedIn, signInWithKakao } = useAuth();
    const [post, setPost] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [shareFeedback, setShareFeedback] = React.useState('');
    const [myReactionKey, setMyReactionKey] = React.useState('');
    const [reactionFeedback, setReactionFeedback] = React.useState('');

    React.useEffect(() => {
        let active = true;
        const load = async () => {
            if (active) {
                setIsLoading(true);
            }
            try {
                const result = await fetchSacredPosts('detail', { id });
                if (!active) return;
                setPost(result?.item || null);
                setShareFeedback('');
                setReactionFeedback('');
            } catch (error) {
                if (!active) return;
                console.error('Failed to load sacred detail:', error);
                setPost(null);
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };
        load();
        return () => {
            active = false;
        };
    }, [id]);

    React.useEffect(() => {
        let active = true;
        const loadMyReaction = async () => {
            if (!isLoggedIn || !user?.id || !id) {
                setMyReactionKey('');
                return;
            }
            const result = await fetchUserSacredReactions([id], user.id);
            if (!active) return;
            setMyReactionKey(String(result?.[id] || ''));
        };
        loadMyReaction();
        return () => {
            active = false;
        };
    }, [id, isLoggedIn, user]);

    const handleShare = async () => {
        const sacredUrl = typeof window === 'undefined'
            ? `/sacred/${id}`
            : `${window.location.origin}/sacred/${id}`;

        const result = await shareContent({
            title: `${post.stockName} 성지 입성`,
            text: `${post.stockName} ${Number(post.targetPrice).toLocaleString()}원 예언이 ${post.judgmentStatus === 'HIT_EXACT' ? '전설급' : '근접 적중'}으로 맞아버렸습니다. 성지 기록 보러 오세요.`,
            url: sacredUrl
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

    const handleReaction = async (reactionKey) => {
        if (!id) return;
        setReactionFeedback('');

        if (!isLoggedIn || !user?.id) {
            setReactionFeedback('축하 반응은 로그인 후 남길 수 있어요');
            await signInWithKakao?.();
            return;
        }

        const previousReaction = myReactionKey;
        const nextReaction = previousReaction === reactionKey ? '' : reactionKey;
        const previousCounts = { ...(post?.reactionCounts || {}) };
        const previousTotalReactionCount = Number(post?.totalReactionCount || 0);
        setMyReactionKey(nextReaction);
        setPost((prev) => {
            if (!prev) return prev;
            const nextCounts = { ...(prev.reactionCounts || {}) };
            if (previousReaction) {
                nextCounts[previousReaction] = Math.max(0, Number(nextCounts[previousReaction] || 0) - 1);
            }
            if (nextReaction) {
                nextCounts[nextReaction] = Number(nextCounts[nextReaction] || 0) + 1;
            }
            return {
                ...prev,
                reactionCounts: nextCounts,
                totalReactionCount: Math.max(0, Number(prev.totalReactionCount || 0) + (nextReaction ? 1 : 0) - (previousReaction ? 1 : 0))
            };
        });

        const ok = await toggleSacredReaction({
            predictionId: id,
            userId: user.id,
            reactionKey,
            currentReactionKey: previousReaction
        });

        if (!ok) {
            setMyReactionKey(previousReaction);
            setPost((prev) => prev ? {
                ...prev,
                reactionCounts: previousCounts,
                totalReactionCount: previousTotalReactionCount
            } : prev);
            setReactionFeedback('반응 저장에 실패했어요');
        }
    };

    if (isLoading) {
        return <div className="py-16 text-center text-white/45">성지글을 불러오는 중...</div>;
    }

    if (!post) {
        return (
            <div className="py-16 text-center space-y-3">
                <p className="text-white/60 font-bold">아직 이 성지 기록은 비어 있습니다</p>
                <p className="text-sm text-white/35">적중한 예언이 쌓이면 여기서 상세 기록을 볼 수 있습니다</p>
                <button onClick={onBack} className="inline-flex items-center gap-1 text-white/60 hover:text-white transition">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="font-bold">목록으로</span>
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-1 text-white/60 hover:text-white transition">
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="font-bold">목록으로</span>
                </button>
                <button
                    onClick={handleShare}
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 transition hover:bg-white/10"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>
            {shareFeedback ? (
                <p className="text-right -mt-3 text-[12px] font-bold text-white/45">
                    {shareFeedback}
                </p>
            ) : null}

            {/* Hero Title */}
            <div className="space-y-3 sm:space-y-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-teal/10 border border-neon-teal/20 text-neon-teal text-xs font-black uppercase tracking-widest">
                    <BadgeCheck className="w-3 h-3" />
                    성지 입성 기록
                </div>
                <h2 className="text-[30px] sm:text-4xl font-black text-white tracking-tight leading-tight px-2 sm:px-4">
                    {post.stockName} {Number(post.targetPrice).toLocaleString()}원 적중
                </h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">작성자 {post.authorNickname} • {formatSacredDate(post.hitDate)} 적중</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 sm:pb-4">
                <div className="crystal-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-2">
                    <Target className="w-5 h-5 text-neon-teal mb-3 sm:mb-4" />
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">목표가</p>
                    <p className="text-2xl font-black text-white">{Number(post.targetPrice).toLocaleString()}<span className="text-sm ml-1 text-white/20">원</span></p>
                </div>
                <div className="crystal-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-2">
                    <TrendingUp className="w-5 h-5 text-neon-pink mb-3 sm:mb-4" />
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">적중 난이도</p>
                    <p className="text-2xl font-black text-white">{post.judgmentStatus === 'HIT_EXACT' ? '전설급' : '근접 적중'}</p>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="crystal-glass rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-5 sm:p-8 opacity-5">
                    <BadgeCheck className="w-32 h-32 text-neon-teal" />
                </div>

                <h3 className="text-xl font-black text-white relative">적중 타임라인</h3>

                <div className="relative space-y-8 sm:space-y-12">
                    {/* Vertical Line */}
                    <div className="absolute left-5 sm:left-6 top-2 bottom-2 w-px bg-white/10"></div>

                    <div className="relative flex gap-4 sm:gap-6">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 z-10">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white/40" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-neon-teal uppercase tracking-widest">{formatSacredDate(post.createdAt)}</p>
                            <h4 className="text-[16px] sm:text-lg font-black text-white mt-1">목표가 박제 완료</h4>
                            <p className="text-[13px] sm:text-sm text-white/50 mt-1 leading-relaxed">
                                작성자가 {post.stockName} {Number(post.targetPrice).toLocaleString()}원을 예측하며<br />
                                최초 기록을 남겼습니다.
                            </p>
                        </div>
                    </div>

                    <div className="relative flex gap-4 sm:gap-6">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-neon-pink/20 border border-neon-pink/30 flex items-center justify-center shrink-0 z-10 shadow-glowPink">
                            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-neon-pink" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-neon-pink uppercase tracking-widest">{formatSacredDate(post.hitDate)}</p>
                            <h4 className="text-lg sm:text-xl font-black text-white mt-1">목표가 도달 (성지 등극)</h4>
                            <p className="text-[13px] sm:text-sm text-white/50 mt-1 leading-relaxed">
                                실제 종가 {Number(post.currentOrHitPrice).toLocaleString()}원이 기준에 들어와<br />
                                이 기록은 영속적인 **성지글**이 되었습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Celebration Reactions */}
            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[12px] sm:text-[13px] font-black text-neon-teal/70 uppercase tracking-[0.18em]">축하 반응</p>
                        <p className="text-[11px] sm:text-[12px] text-white/35 mt-1">성지 기록에 짧고 가볍게 축하를 남겨보세요</p>
                    </div>
                    <span className="text-[11px] sm:text-[12px] font-bold text-neon-teal/40 shrink-0">
                        {Number(post.totalReactionCount || 0)}개 반응
                    </span>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {SACRED_REACTION_OPTIONS.map((option) => {
                        const count = Number(post.reactionCounts?.[option.key] || 0);
                        const isActive = myReactionKey === option.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => handleReaction(option.key)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-[12px] font-black transition ${
                                    isActive
                                        ? 'border-neon-pink/40 bg-neon-pink/15 text-neon-pink'
                                        : 'border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white'
                                }`}
                            >
                                <span>{option.label}</span>
                                {count > 0 ? (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${isActive ? 'bg-neon-pink/15 text-neon-pink' : 'bg-white/5 text-white/45'}`}>
                                        {count}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                {reactionFeedback ? (
                    <p className="text-[11px] sm:text-[12px] font-bold text-white/45 pt-0.5">{reactionFeedback}</p>
                ) : null}
            </div>

            <p className="text-center text-[11px] font-bold text-white/20 uppercase tracking-[0.4em] pb-8">
                성지는 계속 쌓입니다
            </p>
        </div>
    );
};

function formatSacredDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}
