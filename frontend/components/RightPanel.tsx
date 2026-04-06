"use client";

import { useState } from "react";
import { BarChart2, Filter, DollarSign } from "lucide-react";
import MarketStatus from "./MarketStatus";
import PreFilterPanel from "./PreFilterPanel";
import PortfolioSizer from "./PortfolioSizer";

const TABS = [
  { id: "market",  label: "Market",  icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: "screen",  label: "Screener", icon: <Filter className="w-3.5 h-3.5" /> },
  { id: "sizer",   label: "Sizer",   icon: <DollarSign className="w-3.5 h-3.5" /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RightPanel() {
  const [tab, setTab] = useState<TabId>("market");

  return (
    <div className="h-full flex flex-col border-l border-bg-border bg-bg-base">
      {/* Tab bar */}
      <div className="flex border-b border-bg-border flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              tab === t.id
                ? "border-brand-green text-brand-green bg-brand-green/5"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — each scrolls independently */}
      <div className="flex-1 overflow-y-auto">
        {tab === "market"  && <div className="p-3 space-y-3"><MarketStatus /><div className="p-3 bg-bg-card border border-bg-border rounded-xl"><p className="text-xs text-text-muted font-mono uppercase tracking-widest mb-2">Quick Guide</p><ul className="space-y-1.5 text-xs text-text-secondary"><li className="flex gap-2"><span className="text-brand-green font-bold">BUY</span> Pullback in uptrend, RSI &lt; 45, MACD turning up</li><li className="flex gap-2"><span className="text-brand-red font-bold">SELL</span> Hit resistance, RSI &gt; 70, bearish crossover</li><li className="flex gap-2"><span className="text-brand-gold font-bold">HOLD</span> Between entry and TP1 — sit tight</li><li className="flex gap-2"><span className="text-text-muted font-bold">EXIT</span> Stop loss hit — exit immediately, no exceptions</li></ul></div></div>}
        {tab === "screen"  && <div className="p-3"><PreFilterPanel /></div>}
        {tab === "sizer"   && <div className="p-3"><PortfolioSizer /></div>}
      </div>
    </div>
  );
}
