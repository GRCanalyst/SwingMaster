"use client";

import { useEffect, useState } from "react";
import { fetchAlertHistory, fetchAlertStats } from "@/lib/api";
import { Alert, AlertStats } from "@/types";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Database, BarChart2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ConfidenceMeter from "./ConfidenceMeter";

function SignalBadge({ type }: { type?: string }) {
  const t = (type || "").toUpperCase();
  if (t === "BUY")  return <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-brand-green/15 text-brand-green border border-brand-green/30">BUY</span>;
  if (t === "SELL") return <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-brand-red/15 text-brand-red border border-brand-red/30">SELL</span>;
  if (t === "EXIT") return <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-brand-red/15 text-brand-red border border-brand-red/30">EXIT</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-mono bg-bg-elevated text-text-muted border border-bg-border">—</span>;
}

function ConfBar({ score, label }: { score?: number; label?: string }) {
  if (!score) return <span className="text-text-muted text-xs font-mono">—</span>;
  const color = score >= 70 ? "bg-brand-green" : score >= 50 ? "bg-brand-gold" : "bg-brand-red";
  const text  = score >= 70 ? "text-brand-green" : score >= 50 ? "text-brand-gold" : "text-brand-red";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${text}`}>{score}%</span>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className={`text-2xl font-bold font-mono ${color || "text-text-primary"}`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "EXIT">("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [histData, statsData] = await Promise.all([
      fetchAlertHistory({ limit: 100, only_trades: filter !== "ALL", signal_type: filter !== "ALL" ? filter : undefined }),
      fetchAlertStats(),
    ]);
    setAlerts(histData.alerts || []);
    setStats(statsData);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  const filterBtns: Array<"ALL" | "BUY" | "SELL" | "EXIT"> = ["ALL", "BUY", "SELL", "EXIT"];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Alerts Logged" value={stats.total_scans} color="text-brand-blue" />
          <StatCard label="Trade Signals" value={stats.total_trades} color="text-text-primary" />
          <StatCard label="Avg Confidence" value={`${stats.avg_confidence}%`} color={stats.avg_confidence >= 70 ? "text-brand-green" : stats.avg_confidence >= 50 ? "text-brand-gold" : "text-brand-red"} sub="of trade signals" />
          <StatCard label="High Confidence" value={stats.high_confidence_alerts} color="text-brand-green" sub="≥ 70% score" />
        </div>
      )}

      {/* Filter + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <Database className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className="text-xs font-mono text-text-muted uppercase tracking-widest mr-1">Filter:</span>
        {filterBtns.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${
              filter === f
                ? f === "BUY" ? "bg-brand-green/15 border-brand-green text-brand-green"
                  : f === "SELL" || f === "EXIT" ? "bg-brand-red/15 border-brand-red text-brand-red"
                  : "bg-bg-elevated border-text-secondary text-text-primary"
                : "border-bg-border text-text-muted hover:border-text-muted"
            }`}
          >
            {f}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <span className="text-xs text-text-muted font-mono">{alerts.length} records</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-bg-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-bg-elevated text-text-muted text-xs font-mono uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Signal</th>
                <th className="px-4 py-3 text-left">Confidence</th>
                <th className="px-4 py-3 text-right">Entry</th>
                <th className="px-4 py-3 text-right">Stop Loss</th>
                <th className="px-4 py-3 text-right">TP1</th>
                <th className="px-4 py-3 text-right">TP2</th>
                <th className="px-4 py-3 text-left">Triggered</th>
                <th className="px-4 py-3 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-text-muted">Loading history...</td></tr>
              ) : alerts.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-text-muted">No alerts logged yet. Run a scan to populate.</td></tr>
              ) : alerts.map((alert, i) => {
                const isExpanded = expanded === (alert.id ?? i);
                const breakdown = typeof alert.confidence_breakdown === "string"
                  ? JSON.parse(alert.confidence_breakdown)
                  : alert.confidence_breakdown;

                return (
                  <>
                    <tr
                      key={alert.id ?? i}
                      onClick={() => setExpanded(isExpanded ? null : (alert.id ?? i))}
                      className="border-b border-bg-border/50 hover:bg-bg-elevated/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-text-primary">{alert.ticker}</td>
                      <td className="px-4 py-3"><SignalBadge type={alert.signal_type} /></td>
                      <td className="px-4 py-3"><ConfBar score={alert.confidence_score} label={alert.confidence_label} /></td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary text-xs">
                        {alert.entry_low ? `$${Number(alert.entry_low).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-brand-red text-xs">
                        {alert.stop_loss ? `$${Number(alert.stop_loss).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-brand-green text-xs">
                        {alert.take_profit_1 ? `$${Number(alert.take_profit_1).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-brand-green text-xs">
                        {alert.take_profit_2 ? `$${Number(alert.take_profit_2).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">{alert.triggered_by || "scheduler"}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true }) : "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`exp-${alert.id ?? i}`} className="bg-bg-elevated/30">
                        <td colSpan={9} className="px-4 py-3">
                          <ConfidenceMeter
                            score={alert.confidence_score}
                            label={alert.confidence_label}
                            breakdown={breakdown}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
