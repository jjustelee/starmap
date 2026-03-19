import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchStockDetailBundle } from '../utils/mockData';

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
    const basePrice = stockInfo?.currentPrice || 0;
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
            const {
                stock,
                historyData: history,
                starsData: stars,
                realityData: reality,
                dashboardData: dashboard
            } = await fetchStockDetailBundle(symbol);
            if (stock) {
                setStockInfo(stock);

                // [백엔드] 히스토리 데이터가 없으면 더미를 만들지 않고 빈 상태로 유지합니다.
                const realPriceRaw = Number(stock.currentPrice || 0);
                const realPrice = Number.isFinite(realPriceRaw) && realPriceRaw > 0 ? realPriceRaw : 0;
                setHistoryData(history);
                setStarsData(stars);
                setRealityData(reality);
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
