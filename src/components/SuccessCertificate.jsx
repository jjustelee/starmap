import React, { useEffect, useState } from 'react';
import { X, Share2, Download, CheckCircle2 } from 'lucide-react';

/**
 * [프론트엔드] 성지글 성공 인증서 오버레이
 * 박제 성공 시 화려한 애니메이션과 함께 등장합니다.
 */
const SuccessCertificate = ({ isOpen, onClose, data }) => {
    const [animate, setAnimate] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const handleShare = async () => {
        const shareData = {
            title: 'KOKOK 성지글 인증',
            text: `[KOKOK] ${data.nickname}님의 ${data.stockName} 성지글 예언이 박제되었습니다! 고유번호: ${data.sacredId}`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                showToast('공유 창을 열었습니다.');
            } catch (err) {
                console.log('Share failed:', err);
            }
        } else {
            // Clipboard fallback
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                showToast('인증 정보가 클립보드에 복사되었습니다.');
            } catch (err) {
                showToast('공유하기에 실패했습니다.');
            }
        }
    };

    const handleSave = () => {
        showToast('인증서 이미지를 생성 중입니다... (스크린샷을 권장합니다)');
        // 실제 이미지 생성 로직은 html2canvas 등이 필요하므로 현재는 안내로 대체
    };

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setAnimate(true), 100);
        } else {
            setAnimate(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-700 ${animate ? 'bg-black/90' : 'bg-transparent'}`}>
            {/* 배경 파티클 효과 (CSS 처리가능) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] animate-pulse delay-700"></div>
            </div>

            <div 
                className={`relative w-full max-w-md transition-all duration-1000 transform 
                ${animate ? 'scale-100 opacity-100 rotate-0' : 'scale-75 opacity-0 rotate-3'}`}
            >
                {/* 닫기 버튼 */}
                <button 
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                {/* 인증서 본체: Glassmorphism Card */}
                <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                    
                    {/* 상단 장식 라인 */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
                    
                    {/* 콘텐츠 내부 패딩 */}
                    <div className="p-8 h-full flex flex-col items-center text-center">
                        
                        {/* 헤더 */}
                        <div className="space-y-1 mb-8">
                            <p className="text-[10px] tracking-[0.3em] text-blue-400 font-medium uppercase">KOKOK Official Prophet</p>
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-400/10 border border-blue-400/20 text-[10px] text-blue-300">
                                TOP 0.1% AUTHENTICATED
                            </div>
                        </div>

                        {/* 메인 타이틀 */}
                        <div className="mb-10 text-white">
                            <h2 className="text-3xl font-bold tracking-tight mb-1">{data.stockName}</h2>
                            <p className="text-sm text-white/40 font-light tracking-widest uppercase">{data.symbol}</p>
                        </div>

                        {/* 데이터 그리드 */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 w-full mb-10 border-t border-b border-white/5 py-8">
                            <div className="text-left">
                                <p className="text-[10px] text-white/30 uppercase mb-1">Target Price</p>
                                <p className="text-lg font-semibold text-white">{data.targetPrice}원</p>
                            </div>
                            <div className="text-left border-l border-white/5 pl-8">
                                <p className="text-[10px] text-white/30 uppercase mb-1">Record Date</p>
                                <p className="text-sm font-medium text-white/80">{new Date().toLocaleDateString()}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-white/30 uppercase mb-1">Impact Date</p>
                                <p className="text-sm font-medium text-white/80">{data.targetDateText}</p>
                            </div>
                            <div className="text-left border-l border-white/5 pl-8">
                                <p className="text-[10px] text-white/30 uppercase mb-1">Prophet</p>
                                <p className="text-sm font-medium text-blue-300">{data.nickname}</p>
                            </div>
                        </div>

                        {/* 하단 고유 번호 & 인장 */}
                        <div className="mt-auto w-full flex flex-col items-center gap-4">
                            <div className="py-1 px-3 bg-white/5 rounded border border-white/10">
                                <code className="text-[9px] text-white/40 tracking-wider">ID: {data.sacredId}</code>
                            </div>
                            
                            <div className="relative group">
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full transition-all group-hover:scale-125"></div>
                                <div className="relative w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center bg-gradient-to-tr from-white/10 to-white/20 backdrop-blur-sm">
                                    <CheckCircle2 size={32} className="text-blue-400" />
                                </div>
                                <div className="mt-2 text-[9px] text-blue-300/60 font-medium tracking-tighter uppercase whitespace-nowrap">
                                    Sacred Verification
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 무지개 반사광 효과 */}
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-transparent via-white/5 to-transparent rotate-45 pointer-events-none animate-[shimmer_5s_infinite]"></div>
                </div>

                {/* 공유/다운로드 버튼 */}
                <div className={`mt-8 flex gap-4 transition-all duration-700 delay-500 overflow-hidden ${animate ? 'h-12 opacity-100' : 'h-0 opacity-0'}`}>
                    <button 
                        onClick={handleSave}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/10 backdrop-blur-md"
                    >
                        <Download size={18} />
                        <span className="text-sm font-medium">이미지 저장</span>
                    </button>
                    <button 
                        onClick={handleShare}
                        className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <Share2 size={18} />
                        <span className="text-sm font-medium">자랑하기</span>
                    </button>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full text-white text-sm font-medium shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300">
                        {toast}
                    </div>
                )}
            </div>
            
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translate(-30%, -30%) rotate(45deg); }
                    100% { transform: translate(30%, 30%) rotate(45deg); }
                }
            `}</style>
        </div>
    );
};

export default SuccessCertificate;
