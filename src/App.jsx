import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './utils/supabaseClient'
import { 
    ChevronRight, TrendingUp, TrendingDown, Search, X, Star, Bell, Home, 
    Edit3, User, MessageCircle, BarChart2, Pencil, BadgeCheck, Award, BookOpen, Settings, Target
} from 'lucide-react';
import { fetchCommunityHomeFeed, fetchSacredPosts, fetchStockInfo } from './utils/mockData';
import { searchStocksLocal } from './utils/searchEngine';
import { StockDetail } from './components/StockDetail';
import { RecordSuccess } from './components/RecordSuccess'
import { SacredList } from './components/SacredList'
import { SacredDetail } from './components/SacredDetail'
import MyPage from './components/MyPage'
import NicknameSetupSheet from './components/NicknameSetupSheet'
import { AuthProvider, useAuth } from './context/AuthContext'

// [백엔드] 종목 리스트는 Supabase에서 동적으로 로드됩니다.

const HeaderProfileButton = () => {
    const { isLoggedIn, isLoading: authLoading, profile } = useAuth();
    const navigate = useNavigate();
    
    if (authLoading) return null;

    return (
        <button
            onClick={() => navigate('/mypage')}
            aria-label="마이페이지"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 overflow-hidden"
        >
            {isLoggedIn && profile?.avatar ? (
                <img src={profile.avatar} alt="P" className="w-full h-full object-cover" />
            ) : isLoggedIn && profile?.nickname ? (
                <span className="text-[14px] font-black text-neon-teal">{profile.nickname.charAt(0)}</span>
            ) : (
                <User className="w-5 h-5 text-white/80" />
            )}
        </button>
    );
};

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [stars, setStars] = useState([]);
    const [selectedStock, setSelectedStock] = useState(null);
    const [lastTargetPrice, setLastTargetPrice] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [popularStocks, setPopularStocks] = useState([]);
    const [sacredHomePosts, setSacredHomePosts] = useState([]);
    const [communityHomeFeed, setCommunityHomeFeed] = useState({ recentPredictions: [], hotStocks: [] });
    const [searchResults, setSearchResults] = useState([]);
    const [stocksLoading, setStocksLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [visibleCount, setVisibleCount] = useState(20); // 무한 스크롤: 현재 보여줄 개수
    const [allStockMaster, setAllStockMaster] = useState([]); // [백엔드] 전 종목 캐싱용
    const observerTarget = useRef(null); // 무한 스크롤 감지용 타겟
    const searchInputRef = useRef(null);
    const searchQuoteInFlightRef = useRef(new Set());
    const searchQuoteCacheRef = useRef({});
    const [openComposerSignal, setOpenComposerSignal] = useState(0);
    const [isDetailComposerVisible, setIsDetailComposerVisible] = useState(false);

    // 현재 경로를 기반으로 view 상태 유도 (UI 조건부 렌더링용)
    const getViewFromPath = () => {
        const path = location.pathname;
        if (path === '/') return 'home';
        if (path.startsWith('/stock/')) return 'detail';
        if (path === '/success') return 'success';
        if (path === '/sacred') return 'sacred';
        if (path.startsWith('/sacred/')) return 'sacred-detail';
        if (path === '/mypage') return 'mypage';
        return 'home';
    };
    const view = getViewFromPath();

    useEffect(() => {
        if (view !== 'home') return;
        if (location.state?.intent !== 'focus-search') return;

        const frame = window.requestAnimationFrame(() => {
            searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            searchInputRef.current?.focus();
        });

        navigate(location.pathname, { replace: true, state: null });
        return () => window.cancelAnimationFrame(frame);
    }, [view, location.pathname, location.state, navigate]);

    // [백엔드] stock_master 전체 로드 (앱 시작 시 1회)
    useEffect(() => {
        const loadStockMaster = async () => {
            try {
                let allData = [];
                let from = 0;
                let step = 1000;
                let hasMore = true;

                // [백엔드] PostgREST 기본 제한(1000개)을 우회하기 위해 페이징 처리
                while (hasMore) {
                    const { data, error } = await supabase
                        .from('stock_master')
                        .select('code, name, chosung, market_type')
                        .range(from, from + step - 1);
                    
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                        allData = [...allData, ...data];
                        if (data.length < step) {
                            hasMore = false;
                        } else {
                            from += step;
                        }
                    } else {
                        hasMore = false;
                    }
                }

                if (allData.length > 0) {
                    setAllStockMaster(allData);
                    console.log(`[stock_master] ${allData.length}개 종목 캐싱 완료`);
                }
            } catch (err) {
                console.error('Failed to load stock master:', err);
            }
        };
        loadStockMaster();
    }, []);

    useEffect(() => {
        const loadSacredHomePosts = async () => {
            const result = await fetchSacredPosts('home');
            setSacredHomePosts(Array.isArray(result?.items) ? result.items : []);
        };
        loadSacredHomePosts();
    }, []);

    useEffect(() => {
        const loadCommunityHomeFeed = async () => {
            const result = await fetchCommunityHomeFeed();
            setCommunityHomeFeed({
                recentPredictions: Array.isArray(result?.recentPredictions) ? result.recentPredictions : [],
                hotStocks: Array.isArray(result?.hotStocks) ? result.hotStocks : []
            });
        };
        loadCommunityHomeFeed();
    }, []);

    // [백엔드] 데이터 기반 인기 종목 로드 (박제 기록이 많은 순) 및 실시간 가격 동기화 (Level 1)
    useEffect(() => {
        const loadPopularStocks = async () => {
            setStocksLoading(true);
            try {
                const { data, error } = await supabase
                    .from('stocks')
                    .select(`
                        id, 
                        symbol, 
                        name, 
                        base_price, 
                        current_price,
                        price_change,
                        price_change_rate,
                        predictions:predictions(id)
                    `);

                if (!error && data) {
                    const sorted = data.map(s => ({
                        id: s.id,
                        name: s.name,
                        symbol: s.symbol,
                        currentPrice: Number(s.current_price || 0),
                        priceChange: Number(s.price_change || 0),
                        priceChangeRate: Number(s.price_change_rate || 0),
                        quoteStatusLabel: Number(s.current_price || 0) > 0 ? '최근값' : '갱신중',
                        predictionCount: s.predictions ? s.predictions.length : 0
                    }))
                    .sort((a, b) => b.predictionCount - a.predictionCount)
                    .slice(0, 10);

                    // 1단계: 먼저 DB 데이터를 표시
                    setPopularStocks(sorted);

                    // 2단계: 상위 종목에 대해 현재가 동기화 (quote-public 기반, TTL 60초 캐시 우선)
                    const topSymbols = sorted.slice(0, 10);
                    
                    // 병렬로 API 호출
                    const syncPromises = topSymbols.map(async (stock) => {
                        try {
                            const info = await fetchStockInfo(stock.symbol);
                            if (info && Number(info.currentPrice) > 0) {
                                return {
                                    ...stock,
                                    currentPrice: Number(info.currentPrice),
                                    priceChange: Number(info.price_change || 0),
                                    priceChangeRate: Number(info.price_change_rate || 0),
                                    quoteStatusLabel: info.quoteStatusLabel || stock.quoteStatusLabel
                                };
                            }
                        } catch (err) {
                            console.warn(`Failed to sync price for ${stock.symbol}:`, err);
                        }
                        return stock;
                    });

                    const results = await Promise.all(syncPromises);
                    
                    // 업데이트된 가격을 기존 리스트와 병합
                    setPopularStocks(prev => {
                        const updated = [...prev];
                        results.forEach(res => {
                            const idx = updated.findIndex(u => u.symbol === res.symbol);
                            if (idx !== -1) updated[idx] = res;
                        });
                        return updated;
                    });
                }
            } catch (err) {
                console.error("Failed to load popular stocks:", err);
            }
            setStocksLoading(false);
        };
        loadPopularStocks();
    }, []);

    // [프론트엔드] 로컬 전 종목 검색 (메모리 내 즉시 필터링, < 5ms)
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        // [UX] 입력 즉시 로딩 상태 및 결과 비우기 (잔상 제거)
        setIsSearching(true);
        setSearchResults([]);

        const timer = setTimeout(() => {
            // stock_master 캐싱 데이터에서 즉시 필터링
            const localResults = searchStocksLocal(allStockMaster, searchQuery);
            
            // 검색 결과를 기존 UI 형식에 맞게 변환
            const formatted = localResults.map(s => {
                const cachedQuote = searchQuoteCacheRef.current[s.code];
                return {
                symbol: s.code,
                name: s.name,
                market: s.market_type,
                currentPrice: Number(cachedQuote?.currentPrice ?? s.current_price ?? 0),
                priceChange: Number(cachedQuote?.priceChange ?? s.price_change ?? 0),
                priceChangeRate: Number(cachedQuote?.priceChangeRate ?? s.price_change_rate ?? 0),
                quoteStatusLabel: cachedQuote?.quoteStatusLabel || (Number(s.current_price || 0) > 0 ? '최근값' : '갱신중'),
                isFromDb: false
                };
            });

            setSearchResults(formatted);
            setVisibleCount(20); // 검색어 변경 시 개수 초기화
            setIsSearching(false);
        }, 150); // 디바운싱 살짝 단축 (200ms -> 150ms)

        return () => clearTimeout(timer);
    }, [searchQuery, allStockMaster]);

    // [UI] 무한 스크롤 핸들러 (Intersection Observer)
    useEffect(() => {
        if (!observerTarget.current || searchResults.length <= visibleCount) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => prev + 20);
                }
            },
            { threshold: 1.0 }
        );

        observer.observe(observerTarget.current);

        return () => observer.disconnect();
    }, [searchResults, visibleCount]);

    // [백엔드] 검색 결과 현재가 동기화: 화면에 보이는 항목부터 quote-public 기반으로 보강
    useEffect(() => {
        if (!searchResults.length) return;
        const visibleItems = searchResults.slice(0, visibleCount);
        visibleItems.forEach((stock) => {
            if (Number(stock.currentPrice || 0) > 0) return;
            if (searchQuoteInFlightRef.current.has(stock.symbol)) return;
            searchQuoteInFlightRef.current.add(stock.symbol);

            fetchStockInfo(stock.symbol)
                .then((info) => {
                    const price = Number(info?.currentPrice || 0);
                    if (price <= 0) return;
                    const nextQuote = {
                        currentPrice: price,
                        priceChange: Number(info?.price_change || 0),
                        priceChangeRate: Number(info?.price_change_rate || 0),
                        quoteStatusLabel: info?.quoteStatusLabel || '최근값'
                    };
                    searchQuoteCacheRef.current[stock.symbol] = nextQuote;
                    setSearchResults((prev) => prev.map((item) => (
                        item.symbol === stock.symbol ? { ...item, ...nextQuote } : item
                    )));
                })
                .catch((err) => {
                    console.warn(`Failed to sync search quote for ${stock.symbol}:`, err);
                })
                .finally(() => {
                    searchQuoteInFlightRef.current.delete(stock.symbol);
                });
        });
    }, [searchResults, visibleCount]);

    // [백엔드 Level 3] Supabase Realtime 구독: stocks 테이블 변경 시 즉시 UI 반영
    useEffect(() => {
        const channel = supabase
            .channel('public:stocks')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'stocks' 
            }, (payload) => {
                const updatedStock = payload.new;
                setPopularStocks(prev => {
                    const idx = prev.findIndex(s => s.symbol === updatedStock.symbol);
                    if (idx === -1) return prev;
                    
                    const next = [...prev];
                    next[idx] = {
                        ...next[idx],
                        currentPrice: Number(updatedStock.current_price || 0),
                        quoteStatusLabel: Number(updatedStock.current_price || 0) > 0 ? '최근값' : '갱신중'
                    };
                    return next;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        // [성능 최적화] 모바일 기기(768px 미만)에서는 별 데이터를 생성하지 않음
        if (window.innerWidth < 768) {
            setStars([]);
            return;
        }

        const starCount = 75;
        const newStars = Array.from({ length: starCount }).map((_, i) => ({
            id: i,
            size: Math.random() * 2.2 + 0.5,
            top: Math.random() * 100 + "%",
            left: Math.random() * 100 + "%",
            duration: (Math.random() * 3 + 2) + "s",
        }));
        setStars(newStars);
    }, []);

    const handleStockClick = (stock) => {
        // [보안] 클라이언트에서의 stocks 테이블 INSERT 로직은 서버로 이관되었습니다.
        // 하지만 UI 전반(RecordSuccess 등)에서 현재 선택된 종목 정보를 참조하므로 상태는 유지합니다.
        setSelectedStock(stock);
        fetchStockInfo(stock.symbol)
            .then((info) => {
                const price = Number(info?.currentPrice || 0);
                if (price <= 0) return;
                setSelectedStock((prev) => {
                    if (!prev || prev.symbol !== stock.symbol) return prev;
                    return {
                        ...prev,
                        currentPrice: price,
                        priceChange: Number(info?.price_change || prev.priceChange || 0),
                        priceChangeRate: Number(info?.price_change_rate || prev.priceChangeRate || 0),
                        quoteStatusLabel: info?.quoteStatusLabel || prev.quoteStatusLabel || '최근값'
                    };
                });
            })
            .catch(() => {
                // 선택 후 상세 화면에서 재시도되므로 클릭 흐름을 막지 않습니다.
            });
        navigate(`/stock/${stock.symbol}`);
        window.scrollTo(0, 0);
    };

    const handleRecordComplete = (price) => {
        setLastTargetPrice(Number(price));
        navigate('/success');
        window.scrollTo(0, 0);
    };

    const handleSacredSelect = (post) => {
        navigate(`/sacred/${post.id}`);
        window.scrollTo(0, 0);
    };

    const handleCommunityPredictionClick = (item) => {
        if (item?.promotionStatus === 'sacred' && item?.sacredPostId) {
            handleSacredSelect({ id: item.sacredPostId });
            return;
        }
        handleStockClick({ symbol: item.stockSymbol, name: item.stockName });
    };

    const navigateHome = () => {
        setSearchQuery('');
        setSearchResults([]);
        setVisibleCount(20);
        navigate('/');
        window.scrollTo(0, 0);
    };

    const navigateToSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setVisibleCount(20);
        navigate('/', { state: { intent: 'focus-search' } });
        window.scrollTo(0, 0);
    };

    const handlePrimaryCta = () => {
        if (view === 'detail') {
            setOpenComposerSignal((prev) => prev + 1);
            return;
        }
        navigateToSearch();
    };

    const changeView = (newView) => {
        const pathMap = {
            'home': '/',
            'sacred': '/sacred',
            'mypage': '/mypage'
        };
        if (newView === 'home') {
            navigateHome();
            return;
        }
        navigate(pathMap[newView] || '/');
        window.scrollTo(0, 0);
    };

    const { isLoggedIn, isLoading: authLoading, profile } = useAuth();
    
    // 온보딩(닉네임 설정) 노출 여부: 로그인 상태이며 온보딩 미완료인 경우
    const showOnboarding = Boolean(isLoggedIn && profile && !profile.isOnboarded);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black text-soft-white flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-white/10 border-t-neon-teal rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-white/60">인증 상태를 확인하는 중...</p>
            </div>
        );
    }

    return (
        <div className="font-display overflow-x-hidden min-h-screen text-soft-white pb-36">
            {/* Onboarding Sheet */}
            <NicknameSetupSheet isOpen={showOnboarding} />
            {/* Background Layer (Desktop only) */}
            <div className="star-container hidden md:block">
                {stars.map((star) => (
                    <div
                        key={star.id}
                        className="star"
                        style={{
                            width: star.size + "px",
                            height: star.size + "px",
                            top: star.top,
                            left: star.left,
                            backgroundColor: '#ffffff',
                            "--duration": star.duration
                        }}
                    />
                ))}
            </div>

            {/* Global Header */}
            {(view === 'home' || view === 'sacred' || view === 'mypage') && (
                <header className="sticky top-3 sm:top-4 z-50 mx-auto mt-3 sm:mt-4 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-2xl rounded-2xl crystal-glass">
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4">
                        <div 
                            className="flex items-center gap-3 cursor-pointer group/logo"
                            onClick={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                                setVisibleCount(20);
                                navigate('/');
                                window.scrollTo(0, 0);
                            }}
                        >
                            <Target className="w-7 h-7 text-neon-teal group-hover:scale-110 transition-transform" />
                            <div className="leading-none">
                                <h1 className="flex items-end gap-2">
                                    <span className="font-brandKo text-[22px] sm:text-[24px] font-extrabold tracking-[-0.03em] text-white/95 group-hover:text-white transition-colors">콕콕</span>
                                    <span className="font-brandEn text-[22px] sm:text-[24px] font-extrabold tracking-[0.05em] uppercase text-neon-teal/90 group-hover:text-neon-teal transition-colors">KOKOK</span>
                                </h1>
                            </div>
                        </div>

                        <HeaderProfileButton />
                    </div>
                </header>
            )}

            <main className={view === 'detail' ? 'w-full py-8' : 'mx-auto max-w-2xl px-4 sm:px-5 py-6 sm:py-8'}>
                <Routes>
                    <Route path="/" element={
                        <div className="space-y-8 sm:space-y-12 animate-in fade-in duration-700">
                            {/* Hero - Hide when searching */}
                            {!searchQuery && (
                                <section className="space-y-6 sm:space-y-8 pt-2 sm:pt-4 text-center">
                                    <div className="space-y-3 sm:space-y-4">
                                        <p className="text-[11px] font-bold tracking-[0.32em] text-white/40 uppercase">사람들이 보는 목표가 • 기록 • 성지글</p>
                                        <h2 className="text-[30px] sm:text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
                                            사람들이 많이 적는<br /> 목표가를 확인하고<br />
                                            <span className="bg-gradient-to-r from-neon-teal to-neon-pink bg-clip-text text-transparent">
                                                내 목표가를 기록하세요
                                            </span>
                                        </h2>
                                        <p className="mx-auto max-w-md text-[13px] sm:text-sm leading-5 sm:leading-6 text-white/60 md:text-base">
                                            맞추면 당신의 기록은 성지글이 되고,<br className="hidden sm:block" />
                                            적중하면 성지글 아카이브로 올라갑니다
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-md mx-auto">
                                        <button
                                            onClick={() => popularStocks.length > 0 && handleStockClick(popularStocks[0])}
                                            className="rounded-2xl bg-gradient-to-r from-neon-teal to-neon-pink px-4 sm:px-5 py-3.5 sm:py-4 text-[13px] sm:text-sm font-extrabold text-white shadow-glowPink transition hover:scale-[1.01] active:scale-95"
                                        >
                                            목표가 기록하기
                                        </button>
                                        <button
                                            onClick={() => navigate('/sacred')}
                                            className="rounded-2xl border border-white/12 bg-white/5 px-4 sm:px-5 py-3.5 sm:py-4 text-[13px] sm:text-sm font-bold text-white/85 transition hover:bg-white/10 active:scale-95"
                                        >
                                            오늘 뜨는 성지글 보기
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* Search & Popular */}
                            <section className="space-y-5 sm:space-y-6">
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-neon-teal/30 to-neon-pink/30 opacity-20 blur transition duration-700 group-hover:opacity-90"></div>
                                    <div className="relative crystal-glass flex items-center rounded-2xl border-white/15 px-4 sm:px-5">
                                        <Search className="mr-3 text-white/35 w-5 h-5" />
                                                <input
                                            ref={searchInputRef}
                                            aria-label="종목 검색"
                                            className="w-full bg-transparent py-4 sm:py-5 text-[15px] sm:text-base font-semibold text-white placeholder:text-white/35 focus:outline-none"
                                            placeholder="종목명을 검색해 목표가를 확인하세요"
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white transition">
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {searchQuery ? (
                                        <div className="space-y-2">
                                            <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">
                                                검색 결과 {searchResults.length > 0 && `(${searchResults.length.toLocaleString()}개)`}
                                            </p>
                                            <div className="grid gap-2">
                                                {isSearching ? (
                                                    <div className="py-12 text-center crystal-glass rounded-2xl border-white/5 bg-white/5 space-y-3">
                                                        <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-neon-teal rounded-full animate-spin"></div>
                                                        <p className="text-white/30 text-xs font-bold font-brandEn tracking-widest uppercase">Searching...</p>
                                                    </div>
                                                ) : searchResults.length > 0 ? (
                                                    <>
                                                        {searchResults.slice(0, visibleCount).map((stock) => {
                                                            // [UI] 키워드 하이라이팅 (네이버 증권 스타일)
                                                            const renderHighlightedName = (name, query) => {
                                                                if (!query) return name;
                                                                const parts = name.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
                                                                return (
                                                                    <span>
                                                                        {parts.map((part, i) => 
                                                                            part.toLowerCase() === query.toLowerCase() ? 
                                                                            <span key={i} className="text-[#FF6B35] font-black">{part}</span> : 
                                                                            <span key={i}>{part}</span>
                                                                        )}
                                                                    </span>
                                                                );
                                                            };

                                                            return (
                                                                <button
                                                                    key={stock.symbol}
                                                                    onClick={() => handleStockClick(stock)}
                                                                    type="button"
                                                                    className="flex items-center justify-between w-full p-3 sm:p-4 rounded-2xl border border-white/10 bg-white/5 transition hover:border-neon-teal/40 hover:bg-white/10 group animate-in slide-in-from-left-2 duration-300"
                                                                >
                                                                    <div className="flex flex-col items-start gap-0.5">
                                                                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{stock.symbol}</span>
                                                                        <span className="text-base sm:text-lg font-black text-white group-hover:text-neon-teal transition-colors max-w-[180px] sm:max-w-none truncate">
                                                                            {renderHighlightedName(stock.name, searchQuery)}
                                                                        </span>
                                                                    </div>
                                                                    {stock.currentPrice > 0 && (
                                                                        <div className="text-right mr-4 ml-auto">
                                                                            <p className="text-sm font-black text-white">{stock.currentPrice.toLocaleString()}</p>
                                                                            <p className={`text-[10px] font-bold ${stock.priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                                                                                {stock.priceChange >= 0 ? '▲' : '▼'} {Math.abs(stock.priceChange).toLocaleString()} ({stock.priceChangeRate.toFixed(2)}%)
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-neon-teal transition-colors" />
                                                                </button>
                                                            );
                                                        })}
                                                        {/* 무한 스크롤 트리거 요소 */}
                                                        {searchResults.length > visibleCount && (
                                                            <div ref={observerTarget} className="flex justify-center py-4">
                                                                <div className="w-6 h-6 border-2 border-white/10 border-t-neon-teal/40 rounded-full animate-spin"></div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="py-12 text-center crystal-glass rounded-2xl border-white/5 bg-white/5">
                                                        <p className="text-white/30 font-bold mb-1">검색 결과가 없습니다</p>
                                                        <p className="text-[11px] text-white/20">종목명이나 코드를 다시 확인해 주세요</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">인기 종목</p>
                                            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                                                {popularStocks.map((stock) => (
                                                    <button
                                                        key={stock.symbol}
                                                        onClick={() => handleStockClick(stock)}
                                                        type="button"
                                                        className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 sm:px-4 py-1.5 sm:py-2 text-[13px] sm:text-sm font-semibold text-white/80 transition hover:border-neon-teal/40 hover:bg-white/10"
                                                    >
                                                        {stock.name}
                                                    </button>
                                                ))}
                                                {stocksLoading && (
                                                    <div className="flex items-center gap-2 px-4 py-2 text-white/30 text-sm">
                                                        <div className="w-3 h-3 border border-white/20 border-t-neon-teal rounded-full animate-spin"></div>
                                                        로딩 중...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Featured Distribution - Hide when searching */}
                            {!searchQuery && popularStocks.length > 0 && (
                                <section
                                    className="crystal-glass relative overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] p-5 sm:p-7 md:p-8 cursor-pointer group"
                                    onClick={() => handleStockClick(popularStocks[0])}
                                >
                                    <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-neon-teal/10 blur-3xl"></div>
                                    <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-neon-teal/70">많이 적는 목표가</p>
                                            <h3 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase leading-none">지금 뜨는 종목</h3>
                                        </div>
                                        <span className="text-sm font-bold text-neon-teal group-hover:translate-x-1 transition">더 보기 →</span>
                                    </div>
                                    <div className="rounded-[1.5rem] sm:rounded-[1.75rem] glass-soft p-4 sm:p-5 border border-white/5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-sm font-bold text-white/40 mb-1">{popularStocks[0].name}</p>
                                                <p className="text-[28px] sm:text-3xl font-black text-white">
                                                    {popularStocks[0].currentPrice > 0 ? popularStocks[0].currentPrice.toLocaleString() : '시세 동기화 중'}
                                                    <span className="text-sm font-medium opacity-30 ml-2">KRW</span>
                                                </p>
                                                <p className="text-[10px] font-bold text-neon-teal/70 uppercase tracking-[0.16em] mt-1">
                                                    {popularStocks[0].currentPrice > 0 ? (popularStocks[0].quoteStatusLabel || '최근값') : '갱신중'}
                                                </p>
                                                <p className={`text-sm font-bold mt-1 ${popularStocks[0].priceChange >= 0 ? 'text-neon-pink' : 'text-neon-blue'}`}>
                                                    {popularStocks[0].priceChange >= 0 ? '▲' : '▼'} {Math.abs(popularStocks[0].priceChange).toLocaleString()} ({popularStocks[0].priceChangeRate.toFixed(2)}%)
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] font-black text-neon-pink uppercase tracking-widest">기록 수</p>
                                                <p className="text-xl font-black text-white">{popularStocks[0].predictionCount.toLocaleString()}건</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-xs font-bold text-white/50">
                                                <span>실시간 데이터 기반 랭킹</span>
                                                <span>TOP PICK</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full w-full bg-gradient-to-r from-neon-teal to-neon-pink animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {!searchQuery && (
                                <section className="space-y-5 sm:space-y-6">
                                    <div className="flex items-end justify-between px-1">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">홈 커뮤니티</p>
                                            <h3 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white">방금 박제된 예언</h3>
                                            <p className="mt-2 text-sm font-bold text-white/40">지금 올라온 예언이 맞으면 바로 성지글로 올라갑니다</p>
                                        </div>
                                        <span className="text-sm font-bold text-white/40">최근 7일 기준</span>
                                    </div>

                                    {communityHomeFeed.hotStocks.length > 0 ? (
                                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                                            {communityHomeFeed.hotStocks.map((stock) => (
                                                <button
                                                    key={stock.stockSymbol}
                                                    onClick={() => handleStockClick({ symbol: stock.stockSymbol, name: stock.stockName })}
                                                    type="button"
                                                    className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-neon-teal/40 hover:bg-white/10"
                                                >
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-teal/70">요즘 각 보는 종목</p>
                                                    <p className="mt-1 text-sm font-black text-white">{stock.stockName}</p>
                                                    <p className="mt-1 text-[11px] font-bold text-white/45">{stock.predictionCount}건 찍힘</p>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
                                            <p className="text-white/55 font-bold">아직 분위기 타는 종목이 없습니다</p>
                                            <p className="mt-1 text-sm text-white/35">예언이 쌓이면 여기서 바로 뜨기 시작합니다</p>
                                        </div>
                                    )}

                                    {communityHomeFeed.recentPredictions.length > 0 ? (
                                        <div className="grid gap-3">
                                            {communityHomeFeed.recentPredictions.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleCommunityPredictionClick(item)}
                                                    type="button"
                                                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:border-neon-pink/30 hover:bg-white/10"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-pink/75">방금 박제</p>
                                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getPromotionStatusClasses(item.promotionStatus)}`}>
                                                                    {item.promotionLabel}
                                                                </span>
                                                            </div>
                                                            <h4 className="mt-1 truncate text-lg font-black text-white">{item.stockName}</h4>
                                                            <p className="mt-1 text-sm font-bold text-white/55">
                                                                {item.authorNickname} · {formatRelativeTime(item.createdAt)}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <p className="text-base font-black text-white">{Number(item.targetPrice || 0).toLocaleString()}원</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white/40">기한 {formatSacredDate(item.targetDate)}</p>
                                                            <p className={`mt-2 text-[11px] font-black ${item.promotionStatus === 'sacred' ? 'text-neon-pink' : 'text-neon-teal'}`}>
                                                                {item.promotionStatus === 'sacred' ? '성지글 보러 →' : '예언 보러 →'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-center">
                                            <p className="text-white/60 font-bold">아직 방금 올라온 예언이 없습니다</p>
                                            <p className="mt-2 text-sm text-white/35">첫 박제가 올라오면 여기서 바로 흐름이 잡힙니다</p>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Sacred Posts Section - Hide when searching */}
                            {!searchQuery && (
                                <section className="space-y-5 sm:space-y-6">
                                    <div className="flex items-end justify-between px-1">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">최근 성지글</p>
                                            <h3 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white">최근 성지글</h3>
                                            <p className="mt-2 text-sm font-bold text-white/40">이미 맞은 예언만 따로 모아둔 성지 아카이브입니다</p>
                                        </div>
                                        <button onClick={() => navigate('/sacred')} className="text-sm font-bold text-neon-pink hover:text-white transition">더 보기 →</button>
                                    </div>

                                <div className="space-y-4">
                                    {sacredHomePosts.length > 0 ? sacredHomePosts.map((post) => (
                                        <article
                                            key={post.id}
                                            onClick={() => handleSacredSelect(post)}
                                            className={`group relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border ${post.judgmentStatus === 'HIT_EXACT' ? 'border-neon-pink/25 shadow-glowPink' : 'border-neon-teal/25 shadow-glowTeal'} bg-white/5 p-4 sm:p-6 crystal-glass hover:scale-[1.01] transition-all cursor-pointer`}
                                        >
                                            <div className="relative">
                                                <div className="mb-5 flex items-start justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        {post.judgmentStatus === 'HIT_EXACT' ? (
                                                            <Award className="w-8 h-8 sm:w-10 sm:h-10 text-neon-pink" />
                                                        ) : (
                                                            <BadgeCheck className="w-8 h-8 sm:w-10 sm:h-10 text-neon-teal" />
                                                        )}
                                                        <div>
                                                            <p className={`text-xs font-black tracking-[0.18em] uppercase ${post.judgmentStatus === 'HIT_EXACT' ? 'text-neon-pink' : 'text-neon-teal'}`}>성지글</p>
                                                            <p className="text-[11px] font-bold text-white/35">작성자 {post.authorNickname}</p>
                                                        </div>
                                                    </div>
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">적중 완료</span>
                                                </div>
                                                <h4 className={`text-xl sm:text-2xl font-black tracking-tight text-white ${post.judgmentStatus === 'HIT_EXACT' ? 'group-hover:text-neon-pink' : 'group-hover:text-neon-teal'} transition-colors`}>
                                                    {post.stockName} {Number(post.targetPrice).toLocaleString()}원 적중
                                                </h4>
                                                <p className="mt-2 text-xs font-medium text-white/50">
                                                    작성자 {post.authorNickname} • 기록일 {formatSacredDate(post.createdAt)} • 적중일 {formatSacredDate(post.hitDate)}
                                                </p>
                                            </div>
                                        </article>
                                    )) : (
                                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-center">
                                            <p className="text-white/60 font-bold">아직 오늘 뜬 성지글이 없습니다</p>
                                            <p className="mt-2 text-sm text-white/35">첫 적중 기록이 올라오면 여기서 바로 보입니다</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                            )}
                        </div>
                    } />
                    <Route path="/stock/:symbol" element={
                        <StockDetail
                            stock={selectedStock}
                            onBack={() => navigate('/')}
                            onRecord={(price) => handleRecordComplete(price)}
                            openComposerSignal={openComposerSignal}
                            onComposerVisibilityChange={setIsDetailComposerVisible}
                        />
                    } />
                    <Route path="/success" element={
                        <RecordSuccess
                            stock={selectedStock}
                            targetPrice={lastTargetPrice}
                            onHome={navigateHome}
                            onViewMyPredictions={() => navigate('/mypage')}
                            onViewStock={() => selectedStock?.symbol && navigate(`/stock/${selectedStock.symbol}`)}
                        />
                    } />
                    <Route path="/sacred" element={
                        <SacredList
                            onSelect={(post) => handleSacredSelect(post)}
                        />
                    } />
                    <Route path="/sacred/:id" element={
                        <SacredDetail
                            onBack={() => navigate('/sacred')}
                        />
                    } />
                    <Route path="/mypage" element={
                        <MyPage 
                            onBack={() => navigate('/')}
                            onStockClick={(stock) => handleStockClick(stock)}
                        />
                    } />
                </Routes>
            </main>

            {/* Bottom Nav */}
            {view !== 'success' && !(view === 'detail' && isDetailComposerVisible) && (
                <div className="fixed bottom-4 sm:bottom-6 left-1/2 z-50 w-[94%] sm:w-[92%] max-w-md -translate-x-1/2">
                    <nav className="crystal-glass rounded-[1.5rem] sm:rounded-[2rem] border-white/10 px-2.5 sm:px-3 py-2 sm:py-2.5 shadow-glass">
                        <ul className="grid grid-cols-5 items-end">
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('home')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'home' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <Home className="w-5 h-5 sm:w-6 sm:h-6" />
                                    <span className="text-[10px] font-black tracking-[0.12em]">홈</span>
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button
                                    onClick={navigateToSearch}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition hover:text-white active:scale-95 ${(view === 'home' && searchQuery.trim()) ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">검색</span>
                                </button>
                            </li>
                            <li className="relative flex justify-center">
                                <button
                                    onClick={handlePrimaryCta}
                                    aria-label="예언하기"
                                    className="group relative -mt-7 sm:-mt-8 flex h-14 w-14 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-neon-teal via-neon-pink to-purple-600 text-white shadow-lg transition active:scale-95"
                                >
                                    <div className="absolute -inset-2 rounded-full bg-neon-pink/20 opacity-60 blur-xl"></div>
                                    <div className="relative flex flex-col items-center leading-none">
                                        <Pencil className="w-6 h-6 sm:w-7 sm:h-7" />
                                        <span className="mt-0.5 text-[8px] sm:text-[9px] font-black">예언하기</span>
                                    </div>
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('sacred')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'sacred' || view === 'sacred-detail' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">성지글</span>
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('mypage')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'mypage' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">내 기록</span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}
        </div>
    );
}

function formatSacredDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

function formatRelativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '방금 전';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    return `${Math.floor(diffHour / 24)}일 전`;
}

function getPromotionStatusClasses(status) {
    if (status === 'sacred') {
        return 'border-neon-pink/30 bg-neon-pink/10 text-neon-pink';
    }
    if (status === 'judging') {
        return 'border-white/15 bg-white/5 text-white/70';
    }
    return 'border-neon-teal/30 bg-neon-teal/10 text-neon-teal';
}

export default App;
