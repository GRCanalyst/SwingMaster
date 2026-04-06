"use client";

import { useState, useEffect } from "react";
import { fetchWatchlist, updateWatchlist, fetchQuote, analyzeTicker } from "@/lib/api";
import { Quote } from "@/types";
import { Plus, X, TrendingUp, TrendingDown, Loader2, Zap, Search } from "lucide-react";

interface WatchlistPanelProps {
  onNewAlert?: () => void;
}

export default function WatchlistPanel({ onNewAlert }: WatchlistPanelProps) {
  const [tickers, setTickers]   = useState<string[]>([]);
  const [quotes, setQuotes]     = useState<Record<string, Quote>>({});
  const [newTicker, setNewTicker] = useState("");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);

  useEffect(() => {
    fetchWatchlist().then((d) => setTickers(d.watchlist));
  }, []);

  useEffect(() => {
    if (!tickers.length) return;
    const load = async () => {
      const results = await Promise.all(tickers.map(fetchQuote));
      const map: Record<string, Quote> = {};
      results.forEach((q) => { if (q.ticker) map[q.ticker] = q; });
      setQuotes(map);
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [tickers]);

  async function addTicker() {
    const ticker = newTicker.toUpperCase().trim();
    if (!ticker || tickers.includes(ticker)) { setNewTicker(""); return; }
    const updated = [...tickers, ticker];
    setTickers(updated);
    await updateWatchlist(updated);
    setNewTicker("");
  }

  async function removeTicker(ticker: string) {
    const updated = tickers.filter((t) => t !== ticker);
    setTickers(updated);
    await updateWatchlist(updated);
  }

  async function runAnalysis(ticker: string) {
    setAnalyzing(ticker);
    await analyzeTicker(ticker);
    setAnalyzing(null);
    onNewAlert?.();
  }

  return (
    <div className="h-full flex flex-col border-r border-bg-border bg-bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-bg-border flex-shrink-0 bg-bg-card">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Watchlist</span>
        </div>
        <span className="text-xs font-mono bg-bg-elevated text-text-muted px-1.5 py-0.5 rounded border border-bg-border">{tickers.length}</span>
      </div>

      {/* Add input */}
      <div className="px-2 py-2 border-b border-bg-border flex-shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="Add ticker…"
            maxLength={6}
            className="flex-1 bg-bg-elevated border border-bg-border rounded-md px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-green/50 transition-colors"
          />
          <button
            onClick={addTicker}
            className="w-7 h-7 rounded-md bg-brand-green/10 border border-brand-green/30 text-brand-green flex items-center justify-center hover:bg-brand-green/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ticker rows — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {tickers.map((ticker) => {
          const q    = quotes[ticker];
          const isUp = q ? q.change_pct >= 0 : null;

          return (
            <div
              key={ticker}
              className="flex items-center px-2 py-2 border-b border-bg-border/40 hover:bg-bg-elevated/50 transition-colors group"
            >
              {/* Ticker + change */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-text-primary">{ticker}</span>
                  {q && (
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      ${q.current_price.toFixed(2)}
                    </span>
                  )}
                </div>
                {q && (
                  <div className={`flex items-center gap-1 text-xs font-mono mt-0.5 ${isUp ? "text-brand-green" : "text-brand-red"}`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {q.change_pct > 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                  </div>
                )}
              </div>

              {/* Actions — show on hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  onClick={() => runAnalysis(ticker)}
                  disabled={!!analyzing}
                  title="Analyse now"
                  className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-brand-green hover:bg-brand-green/10 transition-all"
                >
                  {analyzing === ticker
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Zap className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => removeTicker(ticker)}
                  title="Remove"
                  className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-bg-border flex-shrink-0 bg-bg-card">
        <p className="text-xs text-text-muted">⚡ hover a ticker to analyse</p>
      </div>
    </div>
  );
}
