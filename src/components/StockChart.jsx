import { createChart, ColorType } from 'lightweight-charts';
import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ── Inline SVG: Star Crosshair Icon ── */
const StarCrosshair = ({ size = 44, color = '#22d3ee', glow = false, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ filter: `drop-shadow(0 0 ${glow ? '14px' : '6px'} ${color}88)`, ...style }}
    >
        <circle cx="50" cy="50" r="35" stroke={color} strokeWidth="5" fill="none" />
        <line x1="50" y1="5" x2="50" y2="15" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="85" x2="50" y2="95" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <line x1="5" y1="50" x2="15" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <line x1="85" y1="50" x2="95" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <path d="M50 25L57.5 41H75L61 51.5L66 68L50 58L34 68L39 51.5L25 41H42.5L50 25Z" fill={color} />
    </svg>
);

/* ── CSS Keyframes (injected once) ── */
const STYLE_ID = '__crosshair-altar-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes sacred-ripple {
            0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0.9; }
            100% { transform: translate(-50%,-50%) scale(2.5);  opacity: 0; }
        }
        @keyframes sacred-pulse {
            0%, 100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
            50%      { transform: translate(-50%,-50%) scale(1.12); opacity: 0.85; }
        }
        @keyframes sacred-stamp {
            0%   { transform: translate(-50%,-50%) scale(1.8); opacity: 0.6; }
            60%  { transform: translate(-50%,-50%) scale(0.9); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
        }
        .sacred-pin-icon {
            animation: sacred-stamp 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards,
                       sacred-pulse 2.5s ease-in-out 0.4s infinite;
        }
        .sacred-ripple-ring {
            animation: sacred-ripple 1s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}

export const StockChart = ({ data }) => {
    const chartContainerRef = useRef();
    const chartInstanceRef = useRef(null);
    const seriesInstanceRef = useRef(null);

    /* ── Smooth cursor refs (DOM-direct, no re-render) ── */
    const overlayRef = useRef(null);
    const crossVRef = useRef(null);   // vertical line
    const crossHRef = useRef(null);   // horizontal line
    const starRef = useRef(null);     // star icon wrapper
    const labelRef = useRef(null);    // floating label
    const guideRef = useRef(null);    // initial guide
    const priceTextRef = useRef(null);
    const rafId = useRef(null);
    const lastMouse = useRef({ x: 0, y: 0 });
    const smoothPos = useRef({ x: 0, y: 0 });
    const isHovering = useRef(false);

    // Pin state (needs re-render for DOM insertion)
    const [pinned, setPinned] = useState(null); // { x, y, price }
    const [rippleKey, setRippleKey] = useState(0);

    /* ── Chart Setup ── */
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            crosshair: {
                mode: 0,
                vertLine: { visible: false },
                horzLine: { visible: false },
            },
            timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            handleScroll: false,
            handleScale: false,
        });

        chartInstanceRef.current = chart;

        const series = chart.addAreaSeries({
            lineColor: '#22d3ee',
            topColor: 'rgba(34, 211, 238, 0.3)',
            bottomColor: 'rgba(34, 211, 238, 0.0)',
            lineWidth: 2,
        });

        seriesInstanceRef.current = series;
        series.setData(data);
        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartInstanceRef.current = null;
            seriesInstanceRef.current = null;
        };
    }, [data]);

    /* ── 60fps Smooth Animation Loop ── */
    useEffect(() => {
        const LERP = 0.25; // smoothing factor (0 = no move, 1 = instant snap)

        const tick = () => {
            const sp = smoothPos.current;
            const tm = lastMouse.current;

            sp.x += (tm.x - sp.x) * LERP;
            sp.y += (tm.y - sp.y) * LERP;

            const x = sp.x;
            const y = sp.y;

            if (isHovering.current) {
                // Move crosshair lines
                if (crossVRef.current) crossVRef.current.style.left = `${x}px`;
                if (crossHRef.current) crossHRef.current.style.top = `${y}px`;

                // Move star icon
                if (starRef.current) {
                    starRef.current.style.left = `${x}px`;
                    starRef.current.style.top = `${y}px`;
                }

                // Move label (offset to upper-right)
                if (labelRef.current) {
                    labelRef.current.style.left = `${x + 24}px`;
                    labelRef.current.style.top = `${y - 80}px`;
                }

                // Update price text from series
                const series = seriesInstanceRef.current;
                if (series && priceTextRef.current) {
                    try {
                        const price = series.coordinateToPrice(y);
                        if (price !== null && !isNaN(price)) {
                            priceTextRef.current.textContent = Math.round(price / 100) * 100 + '';
                            // Store latest price for click handler
                            lastMouse.current.price = Math.round(price / 100) * 100;
                        }
                    } catch (_) { }
                }
            }

            rafId.current = requestAnimationFrame(tick);
        };

        rafId.current = requestAnimationFrame(tick);
        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, []);

    /* ── Mouse Handlers (lightweight: only update refs, no setState) ── */
    const onMouseMove = useCallback((e) => {
        const el = overlayRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        lastMouse.current.x = e.clientX - rect.left;
        lastMouse.current.y = e.clientY - rect.top;

        if (!isHovering.current) {
            isHovering.current = true;
            // Show elements
            [crossVRef, crossHRef, starRef, labelRef].forEach(r => {
                if (r.current) r.current.style.opacity = '1';
            });
            if (guideRef.current) guideRef.current.style.opacity = '0';
        }
    }, []);

    const onMouseLeave = useCallback(() => {
        isHovering.current = false;
        [crossVRef, crossHRef, starRef, labelRef].forEach(r => {
            if (r.current) r.current.style.opacity = '0';
        });
        if (guideRef.current && !pinned) guideRef.current.style.opacity = '1';
    }, [pinned]);

    const onClick = useCallback(() => {
        const price = lastMouse.current.price;
        if (price) {
            setPinned({
                x: smoothPos.current.x,
                y: smoothPos.current.y,
                price,
            });
            setRippleKey(k => k + 1); // force fresh ripple animation
        }
    }, []);

    const PINK = '#f4258c';
    const TEAL = '#22d3ee';

    return (
        <div style={{ position: 'relative' }}>
            {/* Chart canvas */}
            <div ref={chartContainerRef} className="w-full" style={{ borderRadius: '1rem', overflow: 'hidden' }} />

            {/* Overlay */}
            <div
                ref={overlayRef}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
                style={{
                    position: 'absolute', inset: 0,
                    cursor: 'none', zIndex: 10,
                    borderRadius: '1rem',
                }}
            >
                {/* ── Crosshair Lines (hidden by default, shown via ref) ── */}
                <div ref={crossVRef} style={{
                    position: 'absolute', top: 0, bottom: 0, width: 1,
                    background: 'linear-gradient(to bottom, transparent, #22d3ee, transparent)',
                    pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
                }} />
                <div ref={crossHRef} style={{
                    position: 'absolute', left: 0, right: 0, height: 1,
                    background: 'linear-gradient(to right, transparent, #f4258c, transparent)',
                    pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
                }} />

                {/* ── Star Cursor (smooth-tracked via ref) ── */}
                <div ref={starRef} style={{
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none', zIndex: 20,
                    opacity: 0, transition: 'opacity 0.15s',
                }}>
                    <StarCrosshair size={20} color="#22d3ee" />
                </div>

                {/* ── Floating Label (smooth-tracked via ref) ── */}
                <div ref={labelRef} style={{
                    position: 'absolute',
                    pointerEvents: 'none', zIndex: 20, minWidth: 110,
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, padding: '8px 12px',
                    opacity: 0, transition: 'opacity 0.15s',
                }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#22d3ee', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Target Point</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span ref={priceTextRef} style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>—</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>원</span>
                    </div>
                </div>

                {/* ── Pinned Sacred Pin with PINK + Pulse + Ripple ── */}
                {pinned && (
                    <div key={`pin-${rippleKey}`} style={{
                        position: 'absolute',
                        left: pinned.x, top: pinned.y,
                        pointerEvents: 'none', zIndex: 25,
                    }}>
                        {/* Ripple rings (one-shot) */}
                        <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: 30, height: 30,
                            border: `2px solid ${PINK}`,
                            borderRadius: '50%',
                        }} className="sacred-ripple-ring" />
                        <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: 30, height: 30,
                            border: `1.5px solid ${PINK}`,
                            borderRadius: '50%',
                            animationDelay: '0.2s',
                        }} className="sacred-ripple-ring" />

                        {/* Star icon with stamp + pulse animation */}
                        <div className="sacred-pin-icon" style={{
                            position: 'absolute', left: 0, top: 0,
                        }}>
                            <StarCrosshair size={26} color={PINK} glow />
                        </div>

                        {/* Pinned price badge */}
                        <div className="sacred-pin-icon" style={{
                            position: 'absolute',
                            left: 0, top: 18,
                            transform: 'translate(-50%, 0)',
                            background: 'rgba(244, 37, 140, 0.12)',
                            border: `1px solid rgba(244, 37, 140, 0.3)`,
                            borderRadius: 8, padding: '2px 8px',
                            whiteSpace: 'nowrap',
                        }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color: PINK }}>{pinned.price.toLocaleString()}원</span>
                        </div>
                    </div>
                )}

                {/* ── Initial Guide ── */}
                <div ref={guideRef} style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                    transition: 'opacity 0.3s',
                }}>
                    <div style={{ opacity: 0.15, marginBottom: 12 }}>
                        <StarCrosshair size={28} color="#22d3ee" />
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        좌표를 조준하여 콕콕하세요
                    </p>
                </div>
            </div>
        </div>
    );
};
