import React from 'react';
import { BadgeCheck, ChevronLeft, Share2, TrendingUp, Calendar, Target } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchSacredPosts } from '../utils/mockData';
import { shareContent } from '../utils/shareContent';

export const SacredDetail = ({ onBack }) => {
    const { id } = useParams();
    const [post, setPost] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [shareFeedback, setShareFeedback] = React.useState('');

    React.useEffect(() => {
        let active = true;
        const load = async () => {
            setIsLoading(true);
            const result = await fetchSacredPosts('detail', { id });
            if (!active) return;
            setPost(result?.item || null);
            setIsLoading(false);
            setShareFeedback('');
        };
        load();
        return () => {
            active = false;
        };
    }, [id]);

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

            {/* Action CTA */}
            <div className="w-full rounded-2xl bg-white/5 border border-white/10 py-4 sm:py-5 text-center text-sm sm:text-base font-black text-white/60">
                댓글 기능은 다음 업데이트에서 열립니다
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
