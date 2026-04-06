"use client";

import { useEffect, useState, useCallback } from "react";
import { Alert, MarketStatus } from "@/types";
import { fetchAlerts, fetchMarketStatus } from "@/lib/api";
import { connectWebSocket } from "@/lib/websocket";

import Header       from "@/components/Header";
import AlertFeed    from "@/components/AlertFeed";
import AlertHistory from "@/components/AlertHistory";
import WatchlistPanel from "@/components/WatchlistPanel";
import RightPanel   from "@/components/RightPanel";

type Tab = "live" | "history";
type SignalFilter = "ALL" | "BUY" | "SELL" | "EXIT";

export default function Dashboard() {
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const [tab, setTab]                 = useState<Tab>("live");
  const [filter, setFilter]           = useState<SignalFilter>("ALL");

  // Load initial data
  useEffect(() => {
    Promise.all([fetchAlerts(), fetchMarketStatus()])
      .then(([a, m]) => { setAlerts(a.alerts || []); setMarketStatus(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // WebSocket
  useEffect(() => {
    connectWebSocket(
      (newAlert) => {
        setAlerts((prev) => [newAlert, ...prev].slice(0, 100));
        const id = `${newAlert.ticker}-${newAlert.timestamp}`;
        setNewAlertIds((prev) => new Set([...prev, id]));
        setTimeout(() => setNewAlertIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 5000);
        if (newAlert.is_alert !== false) {
          document.title = `🚨 ${newAlert.ticker} Alert — SwingMaster`;
          setTimeout(() => { document.title = "SwingMaster AI"; }, 6000);
        }
      },
      (history) => { setAlerts(history.slice(0, 100)); setLoading(false); },
      setWsConnected,
    );
  }, []);

  const refreshAlerts = useCallback(async () => {
    const data = await fetchAlerts();
    setAlerts(data.alerts || []);
  }, []);

  // Derived stats for header
  const tradeAlerts = alerts.filter((a) => a.is_alert !== false);
  const buyCount    = tradeAlerts.filter((a) => /BUY/i.test(a.message)).length;
  const sellCount   = tradeAlerts.filter((a) => /SELL|EXIT/i.test(a.message)).length;

  // Filtered feed
  const filtered = filter === "ALL"
    ? alerts
    : alerts.filter((a) => new RegExp(filter, "i").test(a.message));

  const filterCfg: Record<SignalFilter, string> = {
    ALL:  "border-bg-border text-text-secondary",
    BUY:  "border-bg-border text-text-secondary",
    SELL: "border-bg-border text-text-secondary",
    EXIT: "border-bg-border text-text-secondary",
  };
  const filterActive: Record<SignalFilter, string> = {
    ALL:  "border-text-muted  text-text-primary  bg-bg-elevated",
    BUY:  "border-brand-green text-brand-green  bg-brand-green/10",
    SELL: "border-brand-red   text-brand-red    bg-brand-red/10",
    EXIT: "border-brand-red   text-brand-red    bg-brand-red/10",
  };

  return (
    /* Full-viewport layout — no outer scroll */
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">

      {/* ── Fixed header ─────────────────────────────────────────── */}
      <Header
        marketStatus={marketStatus}
        wsConnected={wsConnected}
        alertCount={tradeAlerts.length}
        buyCount={buyCount}
        sellCount={sellCount}
        onScanComplete={refreshAlerts}
      />

      {/* ── 3-column body — fills remaining height ────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Watchlist (fixed width, own scroll) */}
        <div className="w-48 xl:w-56 flex-shrink-0 overflow-hidden">
          <WatchlistPanel onNewAlert={refreshAlerts} />
        </div>

        {/* CENTER — Alert feed / History (fills space, own scroll) */}
        <div className="flex-1 flex flex-col overflow-hidden border-x border-bg-border">

          {/* Tab + filter bar */}
          <div className="flex items-center gap-0 border-b border-bg-border bg-bg-card flex-shrink-0 px-3">
            {/* Main tabs */}
            {(["live", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all capitalize ${
                  tab === t
                    ? "border-brand-green text-brand-green"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                {t === "live" ? "Live Alerts" : "History"}
              </button>
            ))}

            {/* Signal filters — only on live tab */}
            {tab === "live" && (
              <>
                <div className="h-4 w-px bg-bg-border mx-3" />
                <div className="flex items-center gap-1.5">
                  {(["ALL", "BUY", "SELL", "EXIT"] as SignalFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md border text-xs font-mono font-medium transition-all ${
                        filter === f ? filterActive[f] : filterCfg[f] + " hover:border-text-muted"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-text-muted font-mono pr-1">
                  {filtered.filter((a) => a.is_alert !== false).length} signals
                </span>
              </>
            )}
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {tab === "live" ? (
              <div className="p-3 space-y-3 max-w-3xl mx-auto">
                <AlertFeed alerts={filtered} loading={loading} newAlertIds={newAlertIds} />
              </div>
            ) : (
              <div className="p-3">
                <AlertHistory />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Tabbed tools panel (fixed width, own scroll) */}
        <div className="w-72 xl:w-80 flex-shrink-0 overflow-hidden">
          <RightPanel />
        </div>
      </div>

      {/* ── Footer strip ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-bg-border bg-bg-card px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-text-muted font-mono">
          SwingMaster AI · Gemini 2.5 Flash-Lite · Finnhub · yfinance
        </span>
        <span className="text-xs text-brand-red font-mono">
          NOT financial advice — trade at your own risk
        </span>
      </div>
    </div>
  );
}
