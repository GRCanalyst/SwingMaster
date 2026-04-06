"use client";

import { useEffect, useState } from "react";
import { Filter, Zap, TrendingUp, BarChart2, Clock, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Candidate {
  ticker: string;
  score: number;
  quick_reason: string;
  current_price: number;
  stop_loss_suggestion: number;
  rsi: number;
  volume_ratio: number;
  rr_ratio: number;
  ema50: number;
  ema200: number;
}

interface PrefilterResult {
  candidates: Candidate[];
  total_scanned: number;
  passed_filter: number;
  message: string;
  scan_duration_sec: number;
  timestamp?: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 9 ? "text-brand-green border-brand-green/40 bg-brand-green/10" :
    score >= 8 ? "text-brand-gold border-brand-gold/40 bg-brand-gold/10" :
                 "text-brand-blue border-brand-blue/40 bg-brand-blue/10";
  return (
    <span className={`px-2 py-0.5 rounded border font-mono font-bold text-xs ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export default function PreFilterPanel() {
  const [result, setResult]   = useState<PrefilterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [universeTotal, setUniverseTotal] = useState<number | null>(null);

  async function loadLast() {
    try {
      const res = await fetch(`${API}/prefilter/last`);
      if (res.ok) {
        const data = await res.json();
        if (data.total_scanned) setResult(data);
      }
      const uRes = await fetch(`${API}/universe`);
      if (uRes.ok) {
        const u = await uRes.json();
        setUniverseTotal(u.total);
      }
    } catch {}
  }

  async function triggerScan() {
    setLoading(true);
    try {
      await fetch(`${API}/prefilter/run`, { method: "POST" });
      // Poll for result after 30s (batch download takes ~15-25s)
      setTimeout(async () => {
        await loadLast();
        setLoading(false);
      }, 35_000);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => { loadLast(); }, []);

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-purple" />
          <span className="text-sm font-semibold text-text-primary">PreFilter Master</span>
          {universeTotal && (
            <span className="text-xs font-mono bg-bg-elevated text-text-muted px-2 py-0.5 rounded border border-bg-border">
              {universeTotal} stocks
            </span>
          )}
        </div>
        <button
          onClick={triggerScan}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-medium hover:bg-brand-purple/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning…" : "Run Scan"}
        </button>
      </div>

      {/* Stats bar */}
      {result && (
        <div className="grid grid-cols-3 divide-x divide-bg-border border-b border-bg-border">
          {[
            { label: "Scanned",  value: result.total_scanned,              icon: <BarChart2 className="w-3.5 h-3.5" /> },
            { label: "Passed",   value: result.passed_filter,              icon: <Filter className="w-3.5 h-3.5" /> },
            { label: "Duration", value: `${result.scan_duration_sec}s`,    icon: <Clock className="w-3.5 h-3.5" /> },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 flex items-center gap-2">
              <span className="text-text-muted">{s.icon}</span>
              <div>
                <div className="text-sm font-bold font-mono text-text-primary">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Candidate list */}
      <div className="divide-y divide-bg-border/50 max-h-80 overflow-y-auto">
        {!result ? (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No scan run yet.</p>
            <p className="text-xs mt-1">Runs automatically before each main scan,<br/>or click <span className="text-brand-purple">Run Scan</span> above.</p>
          </div>
        ) : result.candidates.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            <p className="font-medium">No candidates found</p>
            <p className="text-xs mt-1">{result.message}</p>
          </div>
        ) : result.candidates.map((c) => (
          <div key={c.ticker} className="px-4 py-3 hover:bg-bg-elevated/40 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-text-primary">{c.ticker}</span>
                <ScoreBadge score={c.score} />
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-text-primary">${c.current_price.toFixed(2)}</span>
                <span className="text-brand-red">SL ${c.stop_loss_suggestion.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{c.quick_reason}</p>
            <div className="flex gap-3 mt-1.5 text-xs font-mono text-text-muted">
              <span>RSI <span className="text-brand-gold">{c.rsi}</span></span>
              <span>Vol <span className="text-brand-blue">{c.volume_ratio}x</span></span>
              <span>R/R <span className="text-brand-green">1:{c.rr_ratio.toFixed(1)}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-bg-border bg-bg-elevated/30">
        <p className="text-xs text-text-muted leading-relaxed">
          <span className="text-brand-purple font-medium">Stage 1 of 2.</span>{" "}
          Only stocks scoring ≥7.5/10 pass to SwingMaster AI for deep analysis.
          Watchlist stocks always pass through regardless.
        </p>
      </div>
    </div>
  );
}
