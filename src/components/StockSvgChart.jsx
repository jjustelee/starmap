import React from 'react';

const StockSvgChart = ({ chartDims, svgData, SAFE_MARGIN = 60, BASE_PRICE }) => {
    if (!chartDims || !chartDims.width || !chartDims.height || !svgData) {
        return null;
    }

    return (
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="pinkGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(244,37,140,0.8)" />
                    <stop offset="100%" stopColor="rgba(244,37,140,0)" />
                </radialGradient>
                <radialGradient id="tealGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.8)" />
                    <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </radialGradient>
                <filter id="blurFilter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" />
                </filter>
            </defs>
            {svgData.pathD && (
                <>
                    {/* 과거 실선 (가느다란 골드선) */}
                    <path
                        d={svgData.pathD}
                        fill="none"
                        stroke="rgba(212, 175, 55, 0.4)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* 현재가 마커 (미니 골드 서클) */}
                    <g>
                        {/* Outer glow */}
                        <circle
                            cx={svgData.finalX}
                            cy={svgData.finalY}
                            r="8"
                            fill="#D4AF37"
                            style={{
                                filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.4))'
                            }}
                            opacity="0.4"
                        >
                            <animate
                                attributeName="opacity"
                                values="0.15;0.8;0.15"
                                dur="2.5s"
                                repeatCount="indefinite"
                                calcMode="spline"
                                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                            />
                        </circle>

                        {/* 기준선(Base Price Line) */}
                        <line
                            x1={svgData.finalX}
                            y1={svgData.finalY}
                            x2={chartDims.width}
                            y2={svgData.finalY}
                            stroke="rgba(255, 255, 255, 0.25)"
                            strokeWidth="0.5"
                            strokeDasharray="6,4"
                        />

                        {/* 현재가 라벨 (골드 동심원 위) */}
                        <foreignObject
                            x={svgData.finalX - 120}
                            y={svgData.finalY - 55}
                            width="240"
                            height="45"
                            className="pointer-events-none"
                        >
                            <div className="flex h-full items-center justify-center">
                                <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-main-point opacity-80"></div>
                                    <span className="text-white/50 text-[10px] font-black font-brandKo tracking-tighter">
                                        냉혹한 현 지점 <span className="font-brandEn text-white/90 ml-1 text-[13px]">{BASE_PRICE.toLocaleString()}</span>
                                    </span>
                                </div>
                            </div>
                        </foreignObject>

                        {/* Core Dot (작은 원) */}
                        <circle
                            cx={svgData.finalX}
                            cy={svgData.finalY}
                            r="3.5"
                            fill="#FFD700"
                            stroke="#FFFFFF"
                            strokeWidth="1"
                        />
                    </g>
                </>
            )}

            {/* [백엔드] 미래 예측 분포: renderedBars는 유저 예측 데이터 기반 밀집도 히스토그램 */}
            <g>
                {svgData.renderedBars && svgData.renderedBars.map(bar => (
                    <rect
                        key={bar.id}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={bar.fill}
                        opacity={bar.opacity}
                        rx="3"
                    />
                ))}
            </g>
        </svg>
    );
};

export default StockSvgChart;
