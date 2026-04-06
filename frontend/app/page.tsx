"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Alert, MarketStatus } from "@/types";
import { fetchAlerts, fetchMarketStatus } from "@/lib/api";
import { connectWebSocket } from "@/lib/websocket";

import Header from "@/components/Header";
import AlertFeed from "@/components/AlertFeed";
import AlertHistory from "@/components/AlertHistory";
import WatchlistPanel from "@/components/WatchlistPanel";
import MarketStatusComp from "@/components/MarketStatus";
import PortfolioSizer from "@/components/PortfolioSizer";
import StatsBar from "@/components/StatsBar";
import PreFilterPanel from "@/components/PreFilterPanel";

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set());
  const [filterSignal, setFilterSignal] = useState<"ALL" | "BUY" | "SELL" | "EXIT">("ALL");
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load initial alerts + market status
  useEffect(() => {
    Promise.all([fetchAlerts(), fetchMarketStatus()])
      .then(([alertData, mStatus]) => {
        setAlerts(alertData.alerts || []);
        setMarketStatus(mStatus);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // WebSocket — live alerts
  useEffect(() => {
    connectWebSocket(
      (newAlert) => {
        setAlerts((prev) => [newAlert, ...prev].slice(0, 100));
        const id = `${newAlert.ticker}-${newAlert.timestamp}`;
        setNewAlertIds((prev) => new Set([...prev, id]));
        setTimeout(() => {
          setNewAlertIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 5000);
        // Flash title
        if (newAlert.is_alert !== false) {
          document.title = `🚨 Alert: ${newAlert.ticker} — SwingMaster AI`;
          setTimeout(() => { document.title = "SwingMaster AI"; }, 5000);
        }
      },
      (history) => {
        setAlerts(history.slice(0, 100));
        setLoading(false);
      },
      setWsConnected
    );
  }, []);

  const refreshAlerts = useCallback(async () => {
    const data = await fetchAlerts();
    setAlerts(data.alerts || []);
  }, []);

  const filteredAlerts = filterSignal === "ALL"
    ? alerts
    : alerts.filter((a) => new RegExp(filterSignal, "i").test(a.message));

  const filterButtons: Array<"ALL" | "BUY" | "SELL" | "EXIT"> = ["ALL", "BUY", "SELL", "EXIT"];
  const filterColors: Record<string, string> = {
    ALL: "border-text-muted text-text-muted hover:border-text-secondary hover:text-text-secondary",
    BUY: "border-brand-green/50 text-brand-green hover:bg-brand-green/10",
    SELL: "border-brand-red/50 text-brand-red hover:bg-brand-red/10",
    EXIT: "border-brand-red/50 text-brand-red hover:bg-brand-red/10",
  };
  const activeColors: Record<string, string> = {
    ALL: "bg-bg-elevated border-text-secondary text-text-primary",
    BUY: "bg-brand-green/15 border-brand-green text-brand-green",
    SELL: "bg-brand-red/15 border-brand-red text-brand-red",
    EXIT: "bg-brand-red/15 border-brand-red text-brand-red",
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Header
        marketStatus={marketStatus}
        wsConnected={wsConnected}
        onScanComplete={refreshAlerts}
      />

      <main className="max-w-screen-2xl mx-auto px-4 py-6 gap-6 flex flex-col">
        {/* Stats row */}
        <StatsBar alerts={alerts} />

        {/* ── Tab switcher ─────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-bg-border">
          {[
            { id: "live", label: "Live Alerts" },
            { id: "history", label: "Alert History & Confidence Log" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "live" | "history")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-brand-green text-brand-green"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "live" ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Left: Alert Feed ─────────────────────────────── */}
            <div className="flex-1 min-w-0">
              {/* Filter bar */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-mono text-text-muted uppercase tracking-widest mr-1">Filter:</span>
                {filterButtons.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterSignal(f)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${
                      filterSignal === f ? activeColors[f] : filterColors[f]
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <span className="ml-auto text-xs text-text-muted font-mono">
                  {filteredAlerts.filter(a => a.is_alert !== false).length} active alerts
                </span>
              </div>

              <AlertFeed alerts={filteredAlerts} loading={loading} newAlertIds={newAlertIds} />
            </div>

            {/* ── Right sidebar ────────────────────────────────── */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-4 flex-shrink-0">
              <MarketStatusComp />
              <PreFilterPanel />
              <WatchlistPanel onNewAlert={refreshAlerts} />
              <PortfolioSizer />
            </div>
          </div>
        ) : (
          <AlertHistory />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-bg-border mt-10 px-4 py-4 text-center text-xs text-text-muted font-mono">
        SwingMaster AI — powered by Gemini 1.5 Flash · Finnhub · yfinance
        <span className="mx-2">·</span>
        <span className="text-brand-red">NOT financial advice. Trade at your own risk.</span>
      </footer>
    </div>
  );
}
