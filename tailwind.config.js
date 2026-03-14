/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "void-black": "#000000",
                "neon-teal": "#22d3ee",
                "neon-pink": "#f4258c",
                "soft-white": "#e2e8f0",
                "premium-rose": "#f43f5e",
                "premium-gold": "#fbbf24",
                "history-low": "#0ea5e9",
                "history-high": "#fbbf24",
                "pred-min": "#94a3b8",
                "pred-max": "#fda4af",
            },
            fontFamily: {
                display: ["Outfit", "sans-serif"],
                brandKo: ["Pretendard", "sans-serif"],
                brandEn: ["Plus Jakarta Sans", "sans-serif"],
            },
            boxShadow: {
                glowTeal: "0 0 20px rgba(34, 211, 238, 0.12)",
                glowPink: "0 0 20px rgba(244, 37, 140, 0.12)",
                glass: "0 20px 60px rgba(0,0,0,0.45)",
            },
        },
    },
    plugins: [],
}
