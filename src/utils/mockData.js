import { supabase } from './supabaseClient';

/**
 * [백엔드] 성지 인증 고유 번호(Sacred ID) 생성
 * 구조: [종목코드]-[유저해시]-[적중날짜]-[체크섬]
 */
export const generateSacredId = (symbol, userId, targetDate) => {
    const s = symbol.substring(0, 6).toUpperCase();
    const u = userId ? userId.substring(0, 4).toUpperCase() : 'ANON';
    const d = targetDate.replace(/-/g, '').substring(2); // YYMMDD
    
    // 간단한 체크섬 생성 (보안성 강조용)
    const combined = `${s}${u}${d}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }
    const checksum = Math.abs(hash % 100).toString().padStart(2, '0');
    
    return `${s}-${u}-${d}-${checksum}`;
};

/**
 * [백엔드] 한국투자증권 API 게이트웨이 호출 (Edge Function)
 * @param {string} symbol - 종목 코드 (예: '005930')
 * @param {string} type - 'price' | 'history'
 */
export const callKisGateway = async (symbol, type = 'price') => {
    const { data, error } = await supabase.functions.invoke('kis-gateway', {
        body: { symbol, type }
    });

    if (error) {
        console.error(`Error calling kis-gateway (${type}):`, error);
        return null;
    }
    return data;
};

/**
 * Fetch stock information from Supabase
 * [백엔드] DB의 기본 정보와 KIS의 실시간 시세를 결합
 */
export const fetchStockInfo = async (symbol) => {
    // 1. DB에서 기본 정보(이름 등) 가져오기
    const { data: dbData, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('symbol', symbol)
        .maybeSingle();
    
    if (error) {
        console.error('Error fetching stock from DB:', error);
        return null;
    }

    if (!dbData) return null;

    // 2. KIS API에서 실시간 시세 가져오기 (시도)
    try {
        const kisData = await callKisGateway(symbol, 'price');
        if (kisData && kisData.output) {
            return {
                ...dbData,
                currentPrice: Number(kisData.output.stck_prpr),
                change: Number(kisData.output.prdy_vrss),
                changeRate: Number(kisData.output.prdy_ctrt),
                high: Number(kisData.output.stck_hgpr),
                low: Number(kisData.output.stck_lwpr),
            };
        }
    } catch (e) {
        console.warn('Failed to fetch real-time price, falling back to base_price', e);
    }

    return {
        ...dbData,
        currentPrice: Number(dbData.current_price || dbData.base_price)
    };
};

/**
 * Fetch price history
 * [백엔드] KIS 차트 데이터(history)가 있으면 우선 사용, 없으면 DB 이력 사용
 */
export const fetchPriceHistory = async (stockId, symbol) => {
    // 1. KIS 실시간 차트 데이터 시도
    if (symbol) {
        try {
            const kisHistory = await callKisGateway(symbol, 'history');
            if (kisHistory && kisHistory.output2) {
                // KIS 데이터는 최근일이 앞이므로 뒤집어서 반환
                return kisHistory.output2
                    .map(day => Number(day.stck_clpr))
                    .reverse();
            }
        } catch (e) {
            console.warn('KIS history fetch failed, falling back to DB');
        }
    }

    // 2. Fallback: DB 이력
    const { data, error } = await supabase
        .from('price_history')
        .select('price')
        .eq('stock_id', stockId)
        .order('recorded_at', { ascending: true });

    if (error) return [];
    return data.map(item => Number(item.price));
};

/**
 * Fetch user predictions (Stars)... (생략 - 기존 유지)
 */
export const fetchPredictions = async (stockId) => {
    const { data, error } = await supabase
        .from('predictions')
        .select('price_target, x_future_ratio, opacity')
        .eq('stock_id', stockId);

    if (error) {
        console.error('Error fetching predictions:', error);
        return [];
    }
    return data.map(item => ({
        priceTarget: Number(item.price_target),
        xFutureRatio: Number(item.x_future_ratio),
        opacity: Number(item.opacity)
    }));
};

/**
 * Fetch community dashboard data from Supabase DB Function
 * [백엔드] PIONEER/CONSENSUS 모드 자동 분기, 투표 통계, 52주 고저, 예측 분포 일괄 반환
 * @param {string} symbol - 종목 심볼 (예: '005930')
 */
export const fetchCommunityDashboard = async (symbol) => {
    const { data, error } = await supabase
        .rpc('get_community_dashboard', { stock_symbol: symbol });
    
    if (error) {
        console.error('Error fetching dashboard:', error);
        return null;
    }
    return data;
};

/**
 * Submit a new prediction to Supabase
 * [백엔드] user_id가 있으면 로그인 유저의 기록, 없으면 익명 박제
 */
export const submitPrediction = async (stockId, priceTarget, xFutureRatio, opacity, userId = null, targetDate = '3개월') => {
    const { data, error } = await supabase
        .from('predictions')
        .insert([{
            stock_id: stockId,
            price_target: priceTarget,
            x_future_ratio: xFutureRatio,
            opacity: opacity,
            user_id: userId,
            target_date: targetDate
        }]);

    if (error) {
        console.error('Error submitting prediction:', error);
        throw error;
    }
    return data;
};

/**
 * Fetch predictions for a specific user (My Page)
 * [백엔드] user_id로 필터링하여 내 기록만 조회. stocks JOIN으로 종목명도 반환.
 */
export const fetchMyPredictions = async (userId) => {
    const { data, error } = await supabase
        .from('predictions')
        .select(`
            id,
            price_target,
            x_future_ratio,
            target_date,
            created_at,
            stock_id,
            stocks ( id, name, symbol, base_price )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching my predictions:', error);
        return [];
    }
    return data.map(item => ({
        id: item.id,
        price_target: item.price_target,
        target_date: item.target_date,
        created_at: item.created_at,
        stockName: item.stocks?.name || '알 수 없음',
        stockSymbol: item.stocks?.symbol,
        currentPrice: item.stocks?.current_price ? Number(item.stocks.current_price) : (item.stocks?.base_price ? Number(item.stocks.base_price) : 0),
        // [백엔드] 적중/빗나감 판정 (MVP: 단순 비교)
        isHit: false, // 추후 price 도달 여부로 확장
        isMissed: false,
        stock: item.stocks ? {
            id: item.stocks.id,
            name: item.stocks.name,
            symbol: item.stocks.symbol,
            currentPrice: item.stocks.current_price ? Number(item.stocks.current_price) : Number(item.stocks.base_price)
        } : null
    }));
};

// --- Legacy Dummy Generators (Falling back if needed) ---
/**
 * Generate dummy history data (Line Chart Points)
 */
export const generateDummyHistory = (basePrice) => {
    const points = [];
    for (let i = 0; i < 30; i++) {
        const progress = i / 29;
        const target = basePrice * 0.8 + (basePrice * 0.2 * progress);
        const noise = (Math.random() - 0.5) * (basePrice * 0.05);
        points.push(i === 29 ? basePrice : target + noise);
    }
    return points;
};

/**
 * Generate dummy star data (Future Hit Targets)
 */
export const generateDummyStars = (basePrice) => {
    const stars = [];
    for (let i = 0; i < 50; i++) {
        const xFutureRatio = Math.pow(Math.random(), 1.5);
        const priceTarget = basePrice * (0.85 + (Math.random() * 0.3));
        const opacity = 0.30 + (Math.random() * 0.25);
        stars.push({ xFutureRatio, priceTarget, opacity });
    }
    return stars;
};
