import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // All bg/text colors point at CSS variables — flip automatically
        // with prefers-color-scheme without any JS or extra class needed.
        bg: {
          base:     "var(--bg-base)",
          card:     "var(--bg-card)",
          elevated: "var(--bg-elevated)",
          border:   "var(--bg-border)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },
        // Brand accent colors stay fixed in both modes
        brand: {
          green:      "#10b981",
          "green-dim": "#064e3b",
          red:        "#ef4444",
          "red-dim":  "#7f1d1d",
          gold:       "#f59e0b",
          blue:       "#3b82f6",
          purple:     "#8b5cf6",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-green": "pulseGreen 2s ease-in-out infinite",
        "slide-in":    "slideIn 0.4s ease-out",
        "fade-in":     "fadeIn 0.3s ease-out",
        ticker:        "ticker 30s linear infinite",
      },
      keyframes: {
        pulseGreen: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(16, 185, 129, 0.15)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(-12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        ticker: {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(-100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
