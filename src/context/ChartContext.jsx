import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { callStockDetailPublic, fetchStockDetailBundle, fetchStockInfo } from '../utils/mockData';

const ChartContext = createContext(null);

const STOCK_INFO_CACHE_TTL_MS = 1000 * 60 * 15;
const STOCK_INFO_CACHE_PREFIX = 'kokok.detail.stockInfo:';

const readStockInfoCache = (symbol) => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(`${STOCK_INFO_CACHE_PREFIX}${symbol}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (Date.now() - Number(parsed.savedAt || 0) > STOCK_INFO_CACHE_TTL_MS) {
            window.localStorage.removeItem(`${STOCK_INFO_CACHE_PREFIX}${symbol}`);
            return null;
        }
        return parsed.stock || null;
    } catch {
        return null;
    }
};

const writeStockInfoCache = (symbol, stock) => {
    if (typeof window === 'undefined' || !symbol || !stock) return;
    try {
        window.localStorage.setItem(`${STOCK_INFO_CACHE_PREFIX}${symbol}`, JSON.stringify({
            savedAt: Date.now(),
            stock: {
                symbol: stock.symbol,
                id: stock.id || null,
                name: stock.name || null,
                currentPrice: Number(stock.currentPrice || stock.current_price || 0) || 0,
                price_change: Number(stock.price_change ?? stock.priceChange ?? 0),
                price_change_rate: Number(stock.price_change_rate ?? stock.priceChangeRate ?? 0),
                quoteStatusLabel: stock.quoteStatusLabel || stock.quote_status_label || '최근값',
                quoteUpdatedAt: stock.quoteUpdatedAt || stock.updatedAt || null,
                quoteErrorCode: stock.quoteErrorCode || null
            }
        }));
    } catch {
        // cache is best-effort
    }
};

export const useChartContext = () => {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error('useChartContext must be used within a ChartProvider');
    }
    return context;
};

export const ChartProvider = ({ children, symbol = '005930', seedStock = null }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isDetailLoading, setIsDetailLoading] = useState(true);
    const [stockInfo, setStockInfo] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [starsData, setStarsData] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [realityData, setRealityData] = useState(null);
    
    // UI States
    const [chartDims, setChartDims] = useState({ width: 0, height: 0 });
    const [isSealing, setIsSealing] = useState(false);
    const [vowCount, setVowCount] = useState(5);
    const refreshStockInfoInFlightRef = useRef(null);

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
            const normalizedSeed = normalizeSeedStock(seedStock, symbol) || readStockInfoCache(symbol);
            setIsLoading(true);
            setIsDetailLoading(true);
            setStockInfo(normalizedSeed);
            setHistoryData([]);
            setStarsData([]);
            setRealityData(null);
            setDashboardData(null);

            if (normalizedSeed) {
                setIsLoading(false);

                const seedPrice = Number(normalizedSeed.currentPrice || 0);
                const realPrice = Number.isFinite(seedPrice) && seedPrice > 0 ? seedPrice : 0;
                const iMin = Math.max(0, Math.round(realPrice * 0.75));
                const iMax = Math.round(realPrice * 1.25);

                const s = stateRef.current;
                s.currentPriceValue = realPrice;
                s.currentPriceMin = iMin;
                s.currentPriceMax = iMax;
                s.axisPriceMin = iMin;
                s.axisPriceMax = iMax;
            }

            const detailBundlePromise = callStockDetailPublic(symbol);
            const stock = await fetchStockInfo(symbol, { forceFresh: true });
            if (!stock) {
                setIsLoading(false);
                setIsDetailLoading(false);
                return;
            }

            applyStockInfo(stock);
            writeStockInfoCache(symbol, stock);

            setIsLoading(false);

            const {
                historyData: history,
                starsData: stars,
                realityData: reality,
                dashboardData: dashboard
            } = await fetchStockDetailBundle(symbol, stock, await detailBundlePromise);

            setHistoryData(history);
            setStarsData(stars);
            setRealityData(reality);
            setDashboardData(dashboard);
            setIsDetailLoading(false);
        };
        loadInitialData();
    }, [seedStock, symbol]);

    const applyStockInfo = useCallback((stock) => {
        if (!stock) return;
        setStockInfo(stock);

        const realPriceRaw = Number(stock.currentPrice || 0);
        const realPrice = Number.isFinite(realPriceRaw) && realPriceRaw > 0 ? realPriceRaw : 0;
        const iMin = Math.max(0, Math.round(realPrice * 0.75));
        const iMax = Math.round(realPrice * 1.25);

        const s = stateRef.current;
        s.currentPriceValue = realPrice;
        s.currentPriceMin = iMin;
        s.currentPriceMax = iMax;
        s.axisPriceMin = iMin;
        s.axisPriceMax = iMax;
    }, []);

    const refreshStockInfo = useCallback(async () => {
        if (refreshStockInfoInFlightRef.current) {
            return refreshStockInfoInFlightRef.current;
        }

        refreshStockInfoInFlightRef.current = (async () => {
            const stock = await fetchStockInfo(symbol, { forceFresh: true });
            if (stock) {
                applyStockInfo(stock);
                writeStockInfoCache(symbol, stock);
            }
            return stock;
        })().finally(() => {
            refreshStockInfoInFlightRef.current = null;
        });

        return refreshStockInfoInFlightRef.current;
    }, [applyStockInfo, symbol]);

    const value = useMemo(() => ({
        stateRef,
        isLoading,
        isDetailLoading,
        stockInfo,
        historyData,
        starsData,
        dashboardData,
        realityData,
        basePrice,
        initialMin: INITIAL_MIN,
        initialMax: INITIAL_MAX,
        refreshStockInfo,
        chartDims,
        setChartDims,
        isSealing,
        setIsSealing,
        vowCount,
        setVowCount
    }), [
        isLoading,
        isDetailLoading,
        stockInfo,
        historyData,
        starsData,
        dashboardData,
        realityData,
        basePrice,
        INITIAL_MIN,
        INITIAL_MAX,
        refreshStockInfo,
        chartDims,
        isSealing,
        vowCount
    ]);

    return (
        <ChartContext.Provider value={value}>
            {children}
        </ChartContext.Provider>
    );
};

function normalizeSeedStock(seedStock, symbol) {
    if (!seedStock) return null;
    if (String(seedStock.symbol || '') !== String(symbol || '')) return null;
    return {
        ...seedStock,
        currentPrice: Number(seedStock.currentPrice || seedStock.current_price || 0) || null,
        quoteStatusLabel: seedStock.quoteStatusLabel || seedStock.quote_status_label || '최근값',
        quoteErrorCode: seedStock.quoteErrorCode || null
    };
}
