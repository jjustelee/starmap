import React from 'react';
import { useParams } from 'react-router-dom';
import StockDetailV2 from './StockDetailV2';
import { ChartProvider, useChartContext } from '../context/ChartContext';

/**
 * Integration Notes
 * - 상세 페이지는 V2 단일 경로로 고정됩니다.
 * - BACKEND_TODO(API): 상세 응답은 stock-detail-public + quote-public 조합을 유지하다가 V2 계약으로 수렴.
 * - BACKEND_TODO(KIS): 현재가와 팩트/분포 데이터는 서버 캐시를 단일 진실 원천으로 사용.
 */

export const StockDetailContent = (props) => {
    const { isLoading, stockInfo } = useChartContext();

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-[#08080c] flex flex-col items-center justify-center z-[1000] p-6 text-center">
                <div className="w-16 h-16 border-4 border-white/10 border-t-neon-pink rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-black text-white/90 mb-2 font-brandEn tracking-tighter uppercase italic">Scanning Ecosystem...</h2>
                <p className="text-white/40 text-[13px] font-medium leading-relaxed max-w-[240px]">
                    데이터베이스에 접속하여 실시간 <br />종목 및 예측 데이터를 수집 중입니다.
                </p>
            </div>
        );
    }

    if (!stockInfo) {
        return (
            <div className="fixed inset-0 bg-[#08080c] flex flex-col items-center justify-center z-[1000] p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center mb-6">
                    <span className="text-neon-pink text-3xl font-black">!</span>
                </div>
                <h2 className="text-xl font-black text-white/90 mb-2 font-brandKo tracking-tight">종목을 찾을 수 없습니다</h2>
                <p className="text-white/40 text-[13px] font-medium leading-relaxed max-w-[280px] mb-8">
                    해당 종목의 데이터를 불러오는데 실패했거나 <br />유효하지 않은 종목 코드입니다.
                </p>
                <button
                    onClick={props.onBack}
                    className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all active:scale-95"
                >
                    홈으로 돌아가기
                </button>
            </div>
        );
    }

    return <StockDetailV2 {...props} />;
};

export const StockDetail = (props) => {
    const { symbol } = useParams();
    const effectiveStock = props.stock || { symbol };

    return (
        <ChartProvider symbol={effectiveStock.symbol}>
            <StockDetailContent {...props} stock={effectiveStock} />
        </ChartProvider>
    );
};
