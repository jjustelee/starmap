import React from 'react';
import { BadgeCheck, Award, ChevronRight } from 'lucide-react';
import { fetchSacredPosts } from '../utils/mockData';

export const SacredList = ({ onSelect }) => {
    const [filter, setFilter] = React.useState('recent');
    const [posts, setPosts] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let active = true;
        const load = async () => {
            setIsLoading(true);
            const result = await fetchSacredPosts('list', {
                sort: filter === 'recent' ? 'recent' : 'accuracy'
            });
            if (!active) return;
            setPosts(Array.isArray(result?.items) ? result.items : []);
            setIsLoading(false);
        };
        load();
        return () => {
            active = false;
        };
    }, [filter]);

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="space-y-2 text-center pt-3 sm:pt-4">
                <h2 className="text-[30px] sm:text-4xl font-black text-white tracking-tight">성지글 아카이브</h2>
                <p className="text-white/50 text-sm">맞아버린 예언만 차곡차곡 쌓이는 기록 보관함</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                    onClick={() => setFilter('recent')}
                    className={`flex-1 py-2.5 sm:py-3 text-[13px] sm:text-sm font-black rounded-xl transition ${filter === 'recent' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                    최근 적중
                </button>
                <button
                    onClick={() => setFilter('popular')}
                    className={`flex-1 py-2.5 sm:py-3 text-[13px] sm:text-sm font-black rounded-xl transition ${filter === 'popular' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                    정확도 높은 글
                </button>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-center text-white/45">
                    성지글을 불러오는 중...
                </div>
            ) : posts.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-center">
                    <p className="text-white/60 font-bold">아직 박제된 성지글이 없습니다</p>
                    <p className="mt-2 text-sm text-white/35">첫 적중이 나오면 이 아카이브에 순서대로 쌓입니다</p>
                </div>
            ) : (
            <div className="grid gap-3 sm:gap-4">
                {posts.map((post) => (
                    <article
                        key={post.id}
                        onClick={() => onSelect(post)}
                        className={`group relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border ${post.judgmentStatus === 'HIT_EXACT' ? 'border-neon-pink/25 shadow-glowPink' : 'border-neon-teal/25 shadow-glowTeal'} bg-white/5 p-4 sm:p-6 crystal-glass hover:scale-[1.01] transition-all cursor-pointer`}
                    >
                        <div className="relative">
                            <div className="mb-3 sm:mb-4 flex items-start justify-between gap-3 sm:gap-4">
                                <div className="flex items-center gap-3">
                                    {post.judgmentStatus === 'HIT_EXACT' ? (
                                        <Award className="w-8 h-8 sm:w-10 sm:h-10 text-neon-pink" />
                                    ) : (
                                        <BadgeCheck className="w-8 h-8 sm:w-10 sm:h-10 text-neon-teal" />
                                    )}
                                    <div>
                                        <p className={`text-[10px] font-black tracking-widest uppercase ${post.judgmentStatus === 'HIT_EXACT' ? 'text-neon-pink' : 'text-neon-teal'}`}>성지 기록</p>
                                        <p className="text-[11px] font-bold text-white/30 truncate max-w-[180px]">작성자 {post.authorNickname}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-white/45 uppercase">{post.judgmentLabel}</span>
                            </div>
                            <h4 className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-neon-teal transition-colors mb-2">
                                {post.stockName} {Number(post.targetPrice).toLocaleString()}원 적중
                            </h4>
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px] font-bold text-white/40 uppercase tracking-tighter">
                                <span>기록: {formatSacredDate(post.createdAt)}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className={`${post.judgmentStatus === 'HIT_EXACT' ? 'text-neon-pink/60' : 'text-neon-teal/60'}`}>적중: {formatSacredDate(post.hitDate)}</span>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
            )}
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
