import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * LoginBottomSheet
 * [UX] 박제 시점에 비로그인 유저에게 표시되는 글래스모피즘 바텀시트.
 * "선 체험, 후 가입" 전략의 핵심 전환 UI입니다.
 * 
 * Props:
 * - isOpen: 바텀시트 표시 여부
 * - onClose: 닫기 핸들러
 * - onSkip: "나중에 할게요" 선택 시 (익명 박제 진행)
 */
const LoginBottomSheet = ({ isOpen, onClose, onSkip, onSuccessAction }) => {
    const { signInWithKakao, signInWithEmail } = useAuth();
    const [showEmailForm, setShowEmailForm] = React.useState(false);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handleEmailLogin = async (e) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await signInWithEmail(email, password, onSuccessAction);
            onClose();
        } catch (err) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] transition-opacity duration-500"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-in slide-in-from-bottom duration-500">
                <div className="mx-auto max-w-lg">
                    <div className="bg-[#141419]/95 backdrop-blur-[60px] border-t border-x border-white/10 
                                    rounded-t-[2rem] sm:rounded-t-[2.5rem] p-6 sm:p-8 pb-9 sm:pb-12
                                    shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.05)]">
                        
                        {/* Handle */}
                        <div className="flex justify-center mb-6 sm:mb-8">
                            <div className="w-10 h-1 bg-white/20 rounded-full"></div>
                        </div>

                        {/* Icon */}
                        <div className="flex justify-center mb-5 sm:mb-6">
                            <div className="relative">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-neon-teal/20 to-neon-pink/20 
                                                rounded-full flex items-center justify-center
                                                border border-white/10">
                                    <span className="text-[26px] sm:text-3xl">⭐</span>
                                </div>
                                <div className="absolute -inset-4 bg-neon-teal/10 rounded-full blur-xl -z-10 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Message */}
                        <div className="text-center space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                            <h3 className="text-[20px] sm:text-[22px] font-black text-white leading-tight">
                                이번 예언, 계정에 박제할까요?
                            </h3>
                            <p className="text-[13px] sm:text-[14px] text-white/50 leading-6 sm:leading-relaxed font-medium">
                                카카오로 1초만에 시작하면<br />
                                당신의 예언이 성지글이 되었을 때<br />
                                <span className="text-neon-teal font-bold">적중 뜨면 바로 알림</span>을 보내드립니다.
                            </p>
                        </div>

                        {/* Kakao Login Button */}
                        <button
                            onClick={() => signInWithKakao(onSuccessAction)}
                            className="w-full flex items-center justify-center gap-3
                                       bg-[#FEE500] hover:bg-[#FADA0A] active:bg-[#E5CF00]
                                       text-[#191919] font-black text-[15px] sm:text-[16px]
                                       rounded-2xl py-3.5 sm:py-4 px-5 sm:px-6
                                       transition-all duration-200 active:scale-[0.98]
                                       shadow-[0_4px_20px_rgba(254,229,0,0.25)]"
                        >
                            {/* Kakao Icon SVG */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="#191919">
                                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.66 1.76 4.98 4.38 6.3-.14.52-.9 3.34-.93 3.56 0 0-.02.16.08.22.1.06.22.02.22.02.3-.04 3.44-2.26 3.98-2.64.72.1 1.48.16 2.26.16 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/>
                            </svg>
                            카카오로 시작하기
                        </button>

                        {/* Email Login Section */}
                        {!showEmailForm ? (
                            <button
                                onClick={() => setShowEmailForm(true)}
                                className="w-full mt-3.5 sm:mt-4 py-2.5 sm:py-3 text-center text-[12px] sm:text-[13px] font-bold text-white/40 
                                           hover:text-white/60 transition-colors duration-200"
                            >
                                이메일로 로그인하기
                            </button>
                        ) : (
                            <form onSubmit={handleEmailLogin} className="mt-5 sm:mt-6 space-y-3.5 sm:space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                    <input 
                                        type="email" 
                                        placeholder="이메일" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-neon-teal/50 transition-colors"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <input 
                                        type="password" 
                                        placeholder="비밀번호" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-neon-teal/50 transition-colors"
                                        required
                                    />
                                </div>

                                {error && (
                                    <p className="text-neon-pink text-[12px] font-bold text-center">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3
                                               bg-white/10 hover:bg-white/20 active:bg-white/30
                                               text-white font-black text-[15px]
                                               rounded-xl py-3.5 px-6
                                               transition-all duration-200 active:scale-[0.98]
                                               disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : '로그인'}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setShowEmailForm(false)}
                                    className="w-full text-center text-[12px] text-white/30 hover:text-white/50 py-1"
                                >
                                    뒤로 가기
                                </button>
                            </form>
                        )}

                        {/* Skip */}
                        <button
                            onClick={onSkip}
                            className="w-full mt-5 sm:mt-6 py-2.5 sm:py-3 text-center text-[12px] sm:text-[13px] font-bold text-white/30 
                                       hover:text-white/50 transition-colors duration-200"
                        >
                            나중에 할게요
                        </button>

                        {/* Social Proof */}
                        <p className="text-center text-[10px] sm:text-[11px] text-white/20 mt-3 sm:mt-4">
                            지금까지 <span className="text-white/40 font-bold">1,247명</span>의 별지기가 예언을 기록했습니다
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LoginBottomSheet;
