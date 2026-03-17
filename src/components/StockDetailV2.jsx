import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DetailHeader from './DetailHeader';
import PredictionChartV2 from './PredictionChartV2';
import PredictionComposerV2 from './PredictionComposerV2';
import DistributionPanelV2 from './DistributionPanelV2';
import DistributionSummary from './DistributionSummary';
import MarketReality from './MarketReality';
import { useChartContext } from '../context/ChartContext';
import {
    loadCurrentPrice,
    loadPredictionSnapshot,
    submitPredictionDraft,
    validatePredictionDraft
} from '../services/predictionGatewayV2';

/**
 * Integration Notes
 * - BACKEND_TODO(SUPABASE): predictions, prediction_aggregates, dashboard_distribution_history를 한 응답으로 조합.
 * - BACKEND_TODO(KIS): currentPrice/realityData는 KIS 원천 단일 소스로 주입하고 fallback을 줄인다.
 * - BACKEND_TODO(API): GET /api/v1/stocks/{symbol}/detail-v2(팩트+52주+합의), POST /api/v1/predictions로 수렴.
 */

/**
 * I/O Contract
 * props:
 * - stock: object
 * - onBack: () => void
 * - onRecord: (price: number) => void
 */
const StockDetailV2 = ({ stock, onBack, onRecord }) => {
    const { stockInfo, basePrice, dashboardData, realityData } = useChartContext();
    const symbol = stockInfo?.symbol || stock?.symbol || '000000';
    const initialPrice = Number(stockInfo?.currentPrice || basePrice || 50000);
    const initialDate = useMemo(() => toISODate(addDays(new Date(), 90)), []);

    const [windowKey, setWindowKey] = useState('7d');
    const [currentPrice, setCurrentPrice] = useState(initialPrice);
    const [snapshot, setSnapshot] = useState(null);
    const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [draft, setDraft] = useState({
        symbol,
        targetPrice: initialPrice,
        targetDate: initialDate,
        window: '7d',
        source: 'slider',
        rangeLevel: 'L1'
    });

    useEffect(() => {
        let alive = true;
        (async () => {
            const price = await loadCurrentPrice(symbol, initialPrice);
            if (!alive) return;
            setCurrentPrice(price);
            setDraft((prev) => ({
                ...prev,
                symbol,
                targetPrice: Math.max(100, Math.round(price)),
                targetDate: prev.targetDate || initialDate,
                rangeLevel: prev.rangeLevel || 'L1'
            }));
        })();
        return () => {
            alive = false;
        };
    }, [symbol, initialPrice, initialDate]);

    const reloadSnapshot = useCallback(async () => {
        setIsLoadingSnapshot(true);
        const data = await loadPredictionSnapshot(symbol, windowKey, { currentPrice });
        setSnapshot(data);
        setIsLoadingSnapshot(false);
    }, [symbol, windowKey, currentPrice]);

    useEffect(() => {
        reloadSnapshot();
    }, [reloadSnapshot]);

    const handleDraftChange = useCallback((partial) => {
        setDraft((prev) => ({
            ...prev,
            ...partial,
            symbol,
            window: windowKey
        }));
        setErrorMessage('');
    }, [symbol, windowKey]);

    const handleSubmit = useCallback(async () => {
        const payload = {
            ...draft,
            symbol,
            window: windowKey
        };
        const result = validatePredictionDraft(payload);
        if (!result.ok) {
            setErrorMessage(result.reason || '입력한 예언값을 다시 확인해 주세요.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await submitPredictionDraft(payload);
            if (typeof onRecord === 'function') onRecord(Number(payload.targetPrice));
            await reloadSnapshot();
        } catch (error) {
            setErrorMessage(error?.message || '예언 박제에 실패했어요.');
        } finally {
            setIsSubmitting(false);
        }
    }, [draft, symbol, windowKey, onRecord, reloadSnapshot]);

    const mergedSnapshot = useMemo(() => {
        // BACKEND_TODO(API): snapshot.stats/overlay/currentPrice를 detail-v2 응답에서 1:1로 수신.
        // BACKEND_TODO(SUPABASE): distribution_history(low52/high52/current)는 dashboardData 대신 API payload 사용.
        // BACKEND_TODO(KIS): currentPrice는 서버 갱신 시각(updatedAt)과 함께 내려서 stale 판별.
        if (snapshot) return snapshot;
        return {
            sampleSize: 0,
            stats: {
                avg: dashboardData?.distribution?.consensus?.avg || currentPrice,
                mode: dashboardData?.distribution?.consensus?.mode || currentPrice,
                q1: dashboardData?.distribution?.consensus?.min || Math.round(currentPrice * 0.9),
                q3: dashboardData?.distribution?.consensus?.max || Math.round(currentPrice * 1.1),
                bullishRatio: 0.5,
                bearishRatio: 0.5
            },
            overlay: {
                type: 'dot',
                dots: [],
                xDomain: { min: 0, max: 1095 },
                yDomain: {
                    min: Math.round(currentPrice * 0.8),
                    max: Math.round(currentPrice * 1.2)
                }
            }
        };
    }, [snapshot, dashboardData, currentPrice]);

    return (
        <>
            <div
                className="fixed inset-0 z-[-1] pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at 20% 30%, rgba(34,211,238,0.05), transparent 60%), radial-gradient(circle at 80% 70%, rgba(244,63,94,0.05), transparent 60%)',
                    filter: 'blur(100px)'
                }}
            />

            <DetailHeader
                stock={stockInfo || stock}
                basePrice={currentPrice}
                priceChange={stockInfo?.price_change}
                priceChangeRate={stockInfo?.price_change_rate}
                onBack={onBack}
            />

            <main className="w-full mt-6 relative z-40 pb-28 sm:pb-32">
                <div className="mx-auto max-w-2xl px-5 space-y-6 sm:space-y-8">
                    <MarketReality kisData={realityData} />

                    <DistributionSummary
                        displayMode="rangeOnly"
                        history={{
                            low52: dashboardData?.distribution?.history?.low52 || Math.round(currentPrice * 0.65),
                            high52: dashboardData?.distribution?.history?.high52 || Math.round(currentPrice * 1.5),
                            // BACKEND_TODO(API): 상세 헤더/52주 카드 currentPrice를 동일 응답의 canonical currentPrice로 통일.
                            current: Math.round(currentPrice)
                        }}
                    />

                    <DistributionPanelV2
                        selectedWindow={windowKey}
                        onWindowChange={setWindowKey}
                        snapshot={mergedSnapshot}
                        isLoading={isLoadingSnapshot}
                    />

                    <PredictionChartV2
                        snapshot={mergedSnapshot}
                        currentPrice={currentPrice}
                        targetPrice={draft.targetPrice}
                        targetDate={draft.targetDate}
                        selectedWindow={windowKey}
                        onWindowChange={setWindowKey}
                    />
                </div>
            </main>

            <PredictionComposerV2
                currentPrice={currentPrice}
                draft={draft}
                onChange={handleDraftChange}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                errorMessage={errorMessage}
            />
        </>
    );
};

function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default StockDetailV2;
