import { useState, useEffect } from 'react'
import { supabase } from './utils/supabaseClient'
import {
    Target,
    User,
    Search,
    Home,
    Compass,
    Pencil,
    BookOpen,
    Settings,
    X,
    BadgeCheck,
    Award,
    ChevronRight
} from 'lucide-react'
import { StockDetail } from './components/StockDetail'
import { RecordSuccess } from './components/RecordSuccess'
import { SacredList } from './components/SacredList'
import { SacredDetail } from './components/SacredDetail'
import MyPage from './components/MyPage'
import { AuthProvider, useAuth } from './context/AuthContext'

// [백엔드] 종목 리스트는 Supabase에서 동적으로 로드됩니다.

const SACRED_POSTS = [
    { id: 1, title: 'SK하이닉스 20만 적중', author: '별지기A', date: '2026.03.01', hitDate: '2026.03.07', members: 8400, color: 'neon-teal' },
    { id: 2, title: '삼성전자 8만 돌파 적중', author: '달빛지도사', date: '2026.03.02', hitDate: '2026.03.06', members: 6210, color: 'neon-pink' },
    { id: 3, title: '비트코인 1억 고지 적중', author: '코인도사', date: '2026.02.25', hitDate: '2026.03.05', members: 12500, color: 'neon-teal' },
    { id: 4, title: '에코프로 반등 성공 적중', author: '배터리왕', date: '2026.03.01', hitDate: '2026.03.08', members: 4300, color: 'neon-pink' },
];

const HeaderProfileButton = ({ setView }) => {
    const { isLoggedIn, profile } = useAuth();
    
    return (
        <button
            onClick={() => setView('mypage')}
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
    const [stars, setStars] = useState([]);
    const [view, setView] = useState('home'); // 'home' | 'detail' | 'success' | 'sacred' | 'sacred-detail' | 'mypage'
    const [selectedStock, setSelectedStock] = useState(null);
    const [selectedSacredPost, setSelectedSacredPost] = useState(null);
    const [lastTargetPrice, setLastTargetPrice] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [popularStocks, setPopularStocks] = useState([]);
    const [stocksLoading, setStocksLoading] = useState(true);

    // [백엔드] Supabase에서 종목 리스트 동적 로드
    useEffect(() => {
        const loadStocks = async () => {
            setStocksLoading(true);
            const { data, error } = await supabase
                .from('stocks')
                .select('id, symbol, name, base_price, current_price')
                .order('name');
            if (!error && data) {
                setPopularStocks(data.map(s => ({
                    id: s.id,
                    name: s.name,
                    symbol: s.symbol,
                    currentPrice: Number(s.current_price || s.base_price)
                })));
            }
            setStocksLoading(false);
        };
        loadStocks();
    }, []);

    // 검색 필터링
    const filteredStocks = searchQuery
        ? popularStocks.filter(s => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : popularStocks;

    useEffect(() => {
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
        setSelectedStock(stock);
        setView('detail');
        window.scrollTo(0, 0);
    };

    const handleRecordComplete = (price) => {
        setLastTargetPrice(Number(price));
        setView('success');
        window.scrollTo(0, 0);
    };

    const handleSacredSelect = (post) => {
        setSelectedSacredPost(post);
        setView('sacred-detail');
        window.scrollTo(0, 0);
    };

    const changeView = (newView) => {
        setView(newView);
        window.scrollTo(0, 0);
    };

    return (
        <AuthProvider>
        <div className="font-display overflow-x-hidden min-h-screen text-soft-white pb-36">
            {/* Background Layer */}
            <div className="star-container">
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
                <header className="sticky top-4 z-50 mx-auto mt-4 w-[calc(100%-2rem)] max-w-2xl rounded-2xl crystal-glass">
                    <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Target className="w-7 h-7 text-neon-teal" />
                            <div className="leading-none">
                                <h1 className="flex items-end gap-2">
                                    <span className="font-brandKo text-[24px] font-extrabold tracking-[-0.03em] text-white/95">콕콕</span>
                                    <span className="font-brandEn text-[24px] font-extrabold tracking-[0.05em] uppercase text-neon-teal/90">KOKOK</span>
                                </h1>
                            </div>
                        </div>

                        <HeaderProfileButton setView={setView} />
                    </div>
                </header>
            )}

            <main className={view === 'detail' ? 'w-full py-8' : 'mx-auto max-w-2xl px-5 py-8'}>
                {view === 'home' ? (
                    <div className="space-y-12 animate-in fade-in duration-700">
                        {/* Hero - Hide when searching */}
                        {!searchQuery && (
                            <section className="space-y-8 pt-4 text-center">
                                <div className="space-y-4">
                                    <p className="text-[11px] font-bold tracking-[0.32em] text-white/40 uppercase">사람들이 보는 목표가 • 기록 • 성지글</p>
                                    <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
                                        사람들이 많이 적는<br /> 목표가를 확인하고<br />
                                        <span className="bg-gradient-to-r from-neon-teal to-neon-pink bg-clip-text text-transparent">
                                            내 목표가를 기록하세요
                                        </span>
                                    </h2>
                                    <p className="mx-auto max-w-md text-sm leading-6 text-white/60 md:text-base">
                                        맞추면 당신의 기록은 성지글이 되고,<br className="hidden sm:block" />
                                        맞춘 글에는 성지순례가 몰립니다.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                                    <button
                                        onClick={() => popularStocks.length > 0 && handleStockClick(popularStocks[0])}
                                        className="rounded-2xl bg-gradient-to-r from-neon-teal to-neon-pink px-5 py-4 text-sm font-extrabold text-white shadow-glowPink transition hover:scale-[1.01] active:scale-95"
                                    >
                                        목표가 기록하기
                                    </button>
                                    <button
                                        onClick={() => setView('sacred')}
                                        className="rounded-2xl border border-white/12 bg-white/5 px-5 py-4 text-sm font-bold text-white/85 transition hover:bg-white/10 active:scale-95"
                                    >
                                        오늘의 성지글 보기
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Search & Popular */}
                        <section className="space-y-6">
                            <div className="relative group">
                                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-neon-teal/30 to-neon-pink/30 opacity-20 blur transition duration-700 group-hover:opacity-90"></div>
                                <div className="relative crystal-glass flex items-center rounded-2xl border-white/15 px-5">
                                    <Search className="mr-3 text-white/35 w-5 h-5" />
                                    <input
                                        aria-label="종목 검색"
                                        className="w-full bg-transparent py-5 text-base font-semibold text-white placeholder:text-white/35 focus:outline-none"
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
                                        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">검색 결과</p>
                                        <div className="grid gap-2">
                                            {filteredStocks.length > 0 ? (
                                                filteredStocks.map((stock) => (
                                                    <button
                                                        key={stock.id}
                                                        onClick={() => handleStockClick(stock)}
                                                        type="button"
                                                        className="flex items-center justify-between w-full p-4 rounded-2xl border border-white/10 bg-white/5 transition hover:border-neon-teal/40 hover:bg-white/10 group animate-in slide-in-from-left-2 duration-300"
                                                    >
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{stock.symbol}</span>
                                                            <span className="text-lg font-black text-white group-hover:text-neon-teal transition-colors">{stock.name}</span>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-neon-teal transition-colors" />
                                                    </button>
                                                ))
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
                                            {popularStocks.slice(0, 10).map((stock) => (
                                                <button
                                                    key={stock.id}
                                                    onClick={() => handleStockClick(stock)}
                                                    type="button"
                                                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-neon-teal/40 hover:bg-white/10"
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
                        {!searchQuery && (
                            <section
                                className="crystal-glass relative overflow-hidden rounded-[2.25rem] p-7 md:p-8 cursor-pointer group"
                                onClick={() => popularStocks.length > 0 && handleStockClick(popularStocks[0])}
                            >
                                <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-neon-teal/10 blur-3xl"></div>
                                <div className="mb-8 flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-neon-teal/70">많이 적는 목표가</p>
                                        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-white uppercase leading-none">지금 뜨는 종목</h3>
                                    </div>
                                    <span className="text-sm font-bold text-neon-teal group-hover:translate-x-1 transition">더 보기 →</span>
                                </div>
                                <div className="rounded-[1.75rem] glass-soft p-5 border border-white/5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-sm font-bold text-white/40 mb-1">삼성전자</p>
                                            <p className="text-3xl font-black text-white">183,500 <span className="text-sm font-medium opacity-30">KRW</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-black text-neon-pink uppercase tracking-widest">기록 수</p>
                                            <p className="text-xl font-black text-white">2,431건</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold text-white/50">
                                            <span>최빈 목표가 82,000원</span>
                                            <span>86% 집중</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full w-[86%] bg-gradient-to-r from-neon-teal to-neon-pink"></div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Sacred Posts Section - Hide when searching */}
                        {!searchQuery && (
                            <section className="space-y-6">
                                <div className="flex items-end justify-between px-1">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">최근 성지글</p>
                                        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-white">최근 성지글</h3>
                                    </div>
                                    <button onClick={() => setView('sacred')} className="text-sm font-bold text-neon-pink hover:text-white transition">더 보기 →</button>
                                </div>

                            <div className="space-y-4">
                                {SACRED_POSTS.slice(0, 2).map((post) => (
                                    <article
                                        key={post.id}
                                        onClick={() => handleSacredSelect(post)}
                                        className={`group relative overflow-hidden rounded-[2rem] border ${post.color === 'neon-pink' ? 'border-neon-pink/25 shadow-glowPink' : 'border-neon-teal/25 shadow-glowTeal'} bg-white/5 p-6 crystal-glass hover:scale-[1.01] transition-all cursor-pointer`}
                                    >
                                        <div className="relative">
                                            <div className="mb-5 flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    {post.color === 'neon-teal' ? (
                                                        <BadgeCheck className="w-10 h-10 text-neon-teal" />
                                                    ) : (
                                                        <Award className="w-10 h-10 text-neon-pink" />
                                                    )}
                                                    <div>
                                                        <p className={`text-xs font-black tracking-[0.18em] uppercase ${post.color === 'neon-pink' ? 'text-neon-pink' : 'text-neon-teal'}`}>성지글</p>
                                                        <p className="text-[11px] font-bold text-white/35">성지순례 {post.members.toLocaleString()}명</p>
                                                    </div>
                                                </div>
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">적중 완료</span>
                                            </div>
                                            <h4 className={`text-2xl font-black tracking-tight text-white group-hover:${post.color === 'neon-pink' ? 'text-neon-pink' : 'text-neon-teal'} transition-colors`}>
                                                {post.title}
                                            </h4>
                                            <p className="mt-2 text-xs font-medium text-white/50">
                                                작성자 {post.author} • 기록일 {post.date} • 적중일 {post.hitDate}
                                            </p>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                        )}
                    </div>
                ) : view === 'detail' ? (
                    <StockDetail
                        stock={selectedStock}
                        onBack={() => setView('home')}
                        onRecord={(price) => handleRecordComplete(price)}
                    />
                ) : view === 'success' ? (
                    <RecordSuccess
                        stock={selectedStock}
                        targetPrice={lastTargetPrice}
                        onHome={() => setView('home')}
                    />
                ) : view === 'sacred' ? (
                    <SacredList
                        posts={SACRED_POSTS}
                        onSelect={(post) => handleSacredSelect(post)}
                    />
                ) : view === 'sacred-detail' ? (
                    <SacredDetail
                        post={selectedSacredPost}
                        onBack={() => setView('sacred')}
                    />
                ) : view === 'mypage' ? (
                    <MyPage 
                        onBack={() => setView('home')}
                        onStockClick={(stock) => handleStockClick(stock)}
                    />
                ) : null}
            </main>

            {/* Bottom Nav */}
            {view !== 'detail' && view !== 'success' && (
                <div className="fixed bottom-6 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2">
                    <nav className="crystal-glass rounded-[2rem] border-white/10 px-3 py-2.5 shadow-glass">
                        <ul className="grid grid-cols-5 items-end">
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('home')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'home' || view === 'detail' || view === 'success' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <Home className="w-6 h-6" />
                                    <span className="text-[10px] font-black tracking-[0.12em]">홈</span>
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 text-white/45 transition hover:text-white active:scale-95">
                                    <Compass className="w-6 h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">탐색</span>
                                </button>
                            </li>
                            <li className="relative flex justify-center">
                                <button
                                    onClick={() => changeView('home')}
                                    className="group relative -mt-8 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-neon-teal via-neon-pink to-purple-600 text-white shadow-lg transition active:scale-95"
                                >
                                    <div className="absolute -inset-2 rounded-full bg-neon-pink/20 opacity-60 blur-xl"></div>
                                    <Pencil className="w-8 h-8 relative" />
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('sacred')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'sacred' || view === 'sacred-detail' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <BookOpen className="w-6 h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">성지글</span>
                                </button>
                            </li>
                            <li className="flex justify-center">
                                <button
                                    onClick={() => changeView('mypage')}
                                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95 ${view === 'mypage' ? 'text-neon-teal' : 'text-white/45'}`}
                                >
                                    <Settings className="w-6 h-6" />
                                    <span className="text-[10px] font-bold tracking-[0.12em]">마이</span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}
        </div>
        </AuthProvider>
    );
}

export default App;
