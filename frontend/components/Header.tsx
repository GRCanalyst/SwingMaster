"use client";

import { Wifi, WifiOff, RefreshCw, TrendingUp, Bell } from "lucide-react";
import { MarketStatus } from "@/types";
import { triggerScan } from "@/lib/api";
import { useState } from "react";

interface HeaderProps {
  marketStatus: MarketStatus | null;
  wsConnected: boolean;
  alertCount: number;
  buyCount: number;
  sellCount: number;
  onScanComplete?: () => void;
}

export default function Header({
  marketStatus, wsConnected, alertCount, buyCount, sellCount, onScanComplete,
}: HeaderProps) {
  const [scanning, setScanning] = useState(false);

  async function handleScan() {
    setScanning(true);
    await triggerScan();
    setTimeout(() => { setScanning(false); onScanComplete?.(); }, 3000);
  }

  return (
    <header className="h-14 flex-shrink-0 border-b border-bg-border bg-bg-card flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-brand-green" />
        </div>
        <span className="font-bold text-base tracking-tight text-text-primary">
          Swing<span className="text-brand-green">Master</span>
          <span className="ml-1.5 text-xs font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-bg-border">AI</span>
        </span>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-bg-border" />

      {/* Market status */}
      <div className="flex items-center gap-1.5 text-xs font-mono flex-shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${marketStatus?.is_open ? "bg-brand-green animate-pulse" : "bg-text-muted"}`} />
        <span className={marketStatus?.is_open ? "text-brand-green" : "text-text-muted"}>
          {marketStatus?.is_open ? "MARKET OPEN" : "MARKET CLOSED"}
        </span>
        {marketStatus?.time_et && (
          <span className="text-text-muted">· {marketStatus.time_et}</span>
        )}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-bg-border hidden md:block" />

      {/* Inline alert stats */}
      <div className="hidden md:flex items-center gap-3 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-muted">{alertCount} alerts</span>
        </div>
        <span className="text-brand-green font-semibold">{buyCount} BUY</span>
        <span className="text-brand-red font-semibold">{sellCount} SELL</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* WS status */}
      <div className="flex items-center gap-1.5 text-xs font-mono flex-shrink-0">
        {wsConnected
          ? <><Wifi className="w-3.5 h-3.5 text-brand-green" /><span className="text-brand-green hidden sm:inline">LIVE</span></>
          : <><WifiOff className="w-3.5 h-3.5 text-text-muted" /><span className="text-text-muted hidden sm:inline">OFF</span></>
        }
      </div>

      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs font-semibold hover:bg-brand-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
        {scanning ? "Scanning…" : "Scan Now"}
      </button>
    </header>
  );
}
