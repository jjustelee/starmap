import React from 'react';
import { BadgeCheck, Award, ChevronRight, Search, Filter } from 'lucide-react';

export const SacredList = ({ posts, onSelect }) => {
    const [filter, setFilter] = React.useState('recent');

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="space-y-2 text-center pt-3 sm:pt-4">
                <h2 className="text-[30px] sm:text-4xl font-black text-white tracking-tight">성지글 아카이브</h2>
                <p className="text-white/50 text-sm">적중의 순간이 박제된 영광의 기록들</p>
            </div>

            {/* Filter & Search */}
            <div className="flex gap-2">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-white/30" />
                    </div>
                    <input
                        type="text"
                        placeholder="성지글 검색..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 sm:py-3 pl-10 pr-4 text-[13px] sm:text-sm font-bold text-white focus:outline-none focus:border-neon-teal/50 transition"
                    />
                </div>
                <button className="rounded-2xl bg-white/5 border border-white/10 p-2.5 sm:p-3 text-white/50 hover:text-white transition">
                    <Filter className="w-5 h-5" />
                </button>
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
                    많이 순례한 글
                </button>
            </div>

            {/* List */}
            <div className="grid gap-3 sm:gap-4">
                {posts.map((post) => (
                    <article
                        key={post.id}
                        onClick={() => onSelect(post)}
                        className={`group relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border ${post.color === 'neon-pink' ? 'border-neon-pink/25 shadow-glowPink' : 'border-neon-teal/25 shadow-glowTeal'} bg-white/5 p-4 sm:p-6 crystal-glass hover:scale-[1.01] transition-all cursor-pointer`}
                    >
                        <div className="relative">
                            <div className="mb-3 sm:mb-4 flex items-start justify-between gap-3 sm:gap-4">
                                <div className="flex items-center gap-3">
                                    {post.color === 'neon-teal' ? (
                                        <BadgeCheck className="w-8 h-8 sm:w-10 sm:h-10 text-neon-teal" />
                                    ) : (
                                        <Award className="w-8 h-8 sm:w-10 sm:h-10 text-neon-pink" />
                                    )}
                                    <div>
                                        <p className={`text-[10px] font-black tracking-widest uppercase ${post.color === 'neon-pink' ? 'text-neon-pink' : 'text-neon-teal'}`}>Holy Grail</p>
                                        <p className="text-[11px] font-bold text-white/30 truncate max-w-[120px]">작성자 {post.author}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-white/40 uppercase">성지순례</p>
                                    <p className="text-base font-black text-white">{post.members.toLocaleString()}</p>
                                </div>
                            </div>
                            <h4 className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-neon-teal transition-colors mb-2">
                                {post.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[10px] sm:text-[11px] font-bold text-white/40 uppercase tracking-tighter">
                                <span>기록: {post.date}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className={`${post.color === 'neon-pink' ? 'text-neon-pink/60' : 'text-neon-teal/60'}`}>적중: {post.hitDate}</span>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};
