import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * NicknameSetupSheet
 * [UX] 최초 로그인 시 닉네임을 설정하는 온보딩 바텀시트.
 */
const NicknameSetupSheet = ({ isOpen }) => {
    const { profile, hasProfileRecord, updateProfile } = useAuth();
    const [nickname, setNickname] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (hasProfileRecord && profile?.nickname) {
            setNickname(profile.nickname);
        } else if (isOpen) {
            setNickname('');
        }
    }, [profile, hasProfileRecord, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nickname.trim()) {
            setError('별명을 입력해주세요.');
            return;
        }
        if (nickname.length < 2) {
            setError('별명은 최소 2자 이상이어야 합니다.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await updateProfile({
                nickname: nickname.trim(),
                is_onboarded: true
            });
        } catch (err) {
            setError('저장에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-[#121212]/80 backdrop-blur-md z-[10000] animate-in fade-in duration-500" />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[10001] animate-in slide-in-from-bottom duration-500 cubic-bezier(0.32, 0.72, 0, 1)">
                <div className="mx-auto max-w-[430px]">
                    <div className="bg-[#141419]/95 backdrop-blur-[60px] border-t border-x border-white/10 
                                    rounded-t-[2rem] sm:rounded-t-[2.5rem] p-6 sm:p-8 pb-9 sm:pb-12
                                    shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.05)]">
                        
                        {/* Handle */}
                        <div className="flex justify-center mb-6 sm:mb-8">
                            <div className="w-10 h-1 bg-white/20 rounded-full"></div>
                        </div>

                        {/* Title & Description */}
                        <div className="text-center space-y-2.5 sm:space-y-3 mb-8 sm:mb-10">
                            <h3 className="text-2xl sm:text-3xl font-black text-[#F3F4F6] leading-tight">
                                당신의 별명을<br />정해주세요
                            </h3>
                            <p className="text-sm sm:text-[17px] text-[#9CA3AF] font-medium leading-6 sm:leading-normal">
                                성지글의 예언자로 활동할 별명을 입력해주세요.<br />
                                나중에도 언제든 변경할 수 있습니다.
                            </p>
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => {
                                        setNickname(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="별명을 입력하세요"
                                    className={`w-full bg-white/5 border ${error ? 'border-red-500/50' : 'border-white/10'} 
                                               group-focus-within:border-neon-teal/50
                                               rounded-2xl py-4 sm:py-5 px-4 sm:px-6 
                                               text-[19px] sm:text-[21px] font-bold text-[#F3F4F6] placeholder:text-[#6B7280]
                                               transition-all duration-300 outline-none
                                               shadow-inner`}
                                    maxLength={12}
                                    autoFocus
                                />
                                <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-[#6B7280] text-xs sm:text-xs font-bold">
                                    {nickname.length}/12
                                </div>
                                {error && (
                                    <p className="absolute -bottom-6 left-2 text-red-500 text-xs font-bold animate-pulse">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-neon-teal hover:bg-neon-teal/90 active:bg-neon-teal/80
                                           disabled:opacity-50 disabled:cursor-not-allowed
                                           text-black font-black text-[19px] sm:text-lg
                                           rounded-2xl py-4.5 sm:py-5
                                           transition-all duration-300 active:scale-[0.98]
                                           shadow-[0_10px_30px_rgba(34,211,238,0.3)]"
                            >
                                {isSubmitting ? '설정 중...' : '별지기로 활동 시작하기'}
                            </button>
                        </form>

                        {/* Social Proof */}
                        <p className="text-center text-xs sm:text-[15px] text-[#6B7280] mt-6 sm:mt-8 font-medium">
                            이미 <span className="text-neon-teal font-black">1,247명</span>이 성지글을 기다리고 있습니다
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NicknameSetupSheet;
