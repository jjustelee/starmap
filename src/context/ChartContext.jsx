import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchStockInfo, fetchPriceHistory, fetchPredictions, fetchCommunityDashboard, fetchMarketReality } from '../utils/mockData';

const ChartContext = createContext(null);

export const useChartContext = () => {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error('useChartContext must be used within a ChartProvider');
    }
    return context;
};

export const ChartProvider = ({ children, symbol = '005930' }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [stockInfo, setStockInfo] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [starsData, setStarsData] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [realityData, setRealityData] = useState(null);
    
    // UI States
    const [chartDims, setChartDims] = useState({ width: 0, height: 0 });
    const [isSealing, setIsSealing] = useState(false);
    const [vowCount, setVowCount] = useState(5);

    // Initial constants (will be updated after loading)
    const basePrice = stockInfo?.currentPrice || stockInfo?.base_price || 0;
    const INITIAL_MIN = Math.max(0, Math.round(basePrice * 0.75));
    const INITIAL_MAX = Math.round(basePrice * 1.25);

    // Mutable state (Ref)
    const stateRef = useRef({
        currentPriceValue: 0,
        currentPriceMin: 0,
        currentPriceMax: 0,
        axisPriceMin: 0,
        axisPriceMax: 0,
        selectedDateText: '',
        isTargeting: false,
        isSheetOpen: false,
        isManualMode: false,
        finalTargetDate: null,
        isDragging: false,
        dragStartY: 0,
        dragStartPrice: 0,
        scaleTimer: null,
        doSyncSheet: null // To be populated by StockDetail
    });

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            const stock = await fetchStockInfo(symbol);
            if (stock) {
                setStockInfo(stock);
                
                // [백엔드] 병렬 데이터 로드 (하나라도 실패해도 나머지는 진행되도록 catch 처리)
                const [history, stars, reality, dashboard] = await Promise.all([
                    fetchPriceHistory(stock.id, stock.symbol).catch(() => []),
                    fetchPredictions(stock.id).catch(() => []),
                    fetchMarketReality(stock.symbol).catch(() => null),
                    fetchCommunityDashboard(stock.symbol).catch(() => null)
                ]);

                // [백엔드] 히스토리 데이터가 없는 신규 종목은 현재가 기반 더미 생성
                // KIS history가 실패하거나 데이터가 없을 때만 dummy 생성
                const realPrice = Number(stock.currentPrice || stock.base_price) || 50000;
                if (!history || history.length < 2) {
                    const dummyHistory = [];
                    for (let i = 0; i < 30; i++) {
                        const noise = (Math.random() - 0.5) * (realPrice * 0.04);
                        dummyHistory.push(Math.round(realPrice + noise));
                    }
                    setHistoryData(dummyHistory);
                } else {
                    setHistoryData(history);
                }
                
                setStarsData(stars || []);
                setRealityData(reality);
                
                // [백엔드] 가격 및 지표 미러링: DB 집계 결과보다 KIS 실시간 시세를 우선순위로 적용 (Single Source of Truth)
                if (dashboard && dashboard.distribution && dashboard.distribution.history) {
                    const hist = dashboard.distribution.history;
                    const mkt = dashboard.market || {};
                    
                    // 1. 현재 가격 동기화
                    hist.current = realPrice;
                    
                    // 2. 52주 지표 재계산 (DB 반영 전 Race Condition 해결)
                    if (hist.high52 && hist.low52 && (hist.high52 - hist.low52) > 0) {
                        mkt.level52 = Math.round(((realPrice - hist.low52) / (hist.high52 - hist.low52)) * 100);
                        mkt.gap52 = Math.max(0, hist.high52 - realPrice);
                    }
                    dashboard.market = mkt;
                }
                setDashboardData(dashboard);

                // Update mutable state with real-time price
                const iMin = Math.max(0, Math.round(realPrice * 0.75));
                const iMax = Math.round(realPrice * 1.25);

                const s = stateRef.current;
                s.currentPriceValue = realPrice;
                s.currentPriceMin = iMin;
                s.currentPriceMax = iMax;
                s.axisPriceMin = iMin;
                s.axisPriceMax = iMax;
            }
            setIsLoading(false);
        };
        loadInitialData();
    }, [symbol]);

    const value = {
        stateRef,
        isLoading,
        stockInfo,
        historyData,
        starsData,
        dashboardData,
        realityData,
        basePrice,
        initialMin: INITIAL_MIN,
        initialMax: INITIAL_MAX,
        chartDims,
        setChartDims,
        isSealing,
        setIsSealing,
        vowCount,
        setVowCount
    };

    return (
        <ChartContext.Provider value={value}>
            {children}
        </ChartContext.Provider>
    );
};
