"use client";

import { useState, useEffect } from "react";
import { fetchWatchlist, updateWatchlist, fetchQuote, analyzeTicker } from "@/lib/api";
import { Quote } from "@/types";
import { Plus, X, Search, TrendingUp, TrendingDown, Loader2, Zap } from "lucide-react";

interface WatchlistPanelProps {
  onNewAlert?: () => void;
}

export default function WatchlistPanel({ onNewAlert }: WatchlistPanelProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [newTicker, setNewTicker] = useState("");
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist().then((d) => setTickers(d.watchlist));
  }, []);

  useEffect(() => {
    if (tickers.length === 0) return;
    const loadQuotes = async () => {
      const results = await Promise.all(tickers.map((t) => fetchQuote(t)));
      const map: Record<string, Quote> = {};
      results.forEach((q) => { if (q.ticker) map[q.ticker] = q; });
      setQuotes(map);
    };
    loadQuotes();
    const interval = setInterval(loadQuotes, 30_000); // refresh every 30s
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
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">Watchlist</span>
          <span className="text-xs font-mono bg-bg-elevated text-text-muted px-2 py-0.5 rounded">
            {tickers.length}
          </span>
        </div>
      </div>

      {/* Add ticker */}
      <div className="px-3 py-3 border-b border-bg-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="Add ticker (e.g. NVDA)"
            maxLength={6}
            className="flex-1 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-green/40 transition-colors"
          />
          <button
            onClick={addTicker}
            className="w-9 h-9 rounded-lg bg-brand-green/10 border border-brand-green/30 text-brand-green flex items-center justify-center hover:bg-brand-green/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ticker list */}
      <div className="overflow-y-auto max-h-[420px]">
        {tickers.map((ticker) => {
          const q = quotes[ticker];
          const isUp = q ? q.change_pct >= 0 : null;
          const isAnalyzing = analyzing === ticker;

          return (
            <div
              key={ticker}
              className="flex items-center justify-between px-4 py-3 border-b border-bg-border/50 hover:bg-bg-elevated/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-text-primary">
                    {ticker.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-mono font-semibold text-text-primary">{ticker}</div>
                  {q && (
                    <div className={`text-xs font-mono flex items-center gap-1 ${isUp ? "text-brand-green" : "text-brand-red"}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {q.change_pct > 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {q && (
                  <span className="font-mono text-sm font-medium text-text-primary">
                    ${q.current_price.toFixed(2)}
                  </span>
                )}

                {/* Quick analyze button */}
                <button
                  onClick={() => runAnalysis(ticker)}
                  disabled={!!analyzing}
                  title="Analyze this ticker"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-brand-green hover:bg-brand-green/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Remove button */}
                <button
                  onClick={() => removeTicker(ticker)}
                  title="Remove from watchlist"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
