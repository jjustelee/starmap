import React from 'react';
import { BadgeCheck, ChevronLeft, Share2, CornerDownRight, TrendingUp, Users, Calendar } from 'lucide-react';

export const SacredDetail = ({ post, onBack }) => {
    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-1 text-white/60 hover:text-white transition">
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="font-bold">목록으로</span>
                </button>
                <button className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 transition hover:bg-white/10">
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            {/* Hero Title */}
            <div className="space-y-3 sm:space-y-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-teal/10 border border-neon-teal/20 text-neon-teal text-xs font-black uppercase tracking-widest">
                    <BadgeCheck className="w-3 h-3" />
                    Verified Holy Grail
                </div>
                <h2 className="text-[30px] sm:text-4xl font-black text-white tracking-tight leading-tight px-2 sm:px-4">
                    {post.title}
                </h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">작성자 {post.author} • {post.hitDate} 적중</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 sm:pb-4">
                <div className="crystal-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-2">
                    <Users className="w-5 h-5 text-neon-teal mb-3 sm:mb-4" />
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">성지순례</p>
                    <p className="text-2xl font-black text-white">{post.members.toLocaleString()}<span className="text-sm ml-1 text-white/20">명</span></p>
                </div>
                <div className="crystal-glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-2">
                    <TrendingUp className="w-5 h-5 text-neon-pink mb-3 sm:mb-4" />
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">적중 난이도</p>
                    <p className="text-2xl font-black text-white">전설급</p>
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
                            <p className="text-xs font-black text-neon-teal uppercase tracking-widest">2026.03.01</p>
                            <h4 className="text-[16px] sm:text-lg font-black text-white mt-1">목표가 박제 완료</h4>
                            <p className="text-[13px] sm:text-sm text-white/50 mt-1 leading-relaxed">
                                작성자가 SK하이닉스 200,000원을 예측하며<br />
                                최초 기록을 남겼습니다.
                            </p>
                        </div>
                    </div>

                    <div className="relative flex gap-4 sm:gap-6">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-neon-pink/20 border border-neon-pink/30 flex items-center justify-center shrink-0 z-10 shadow-glowPink">
                            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-neon-pink" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-neon-pink uppercase tracking-widest">{post.hitDate}</p>
                            <h4 className="text-lg sm:text-xl font-black text-white mt-1">목표가 도달 (성지 등극)</h4>
                            <p className="text-[13px] sm:text-sm text-white/50 mt-1 leading-relaxed">
                                실제 가격이 목표가에 도달하여<br />
                                이 기록은 영속적인 **성지글**이 되었습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action CTA */}
            <button className="w-full rounded-2xl bg-white text-black py-4 sm:py-5 text-base sm:text-lg font-black flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition active:scale-95">
                나도 성지순례 댓글 남기기
            </button>

            <p className="text-center text-[11px] font-bold text-white/20 uppercase tracking-[0.4em] pb-8">
                THE LEGEND CONTINUES
            </p>
        </div>
    );
};
