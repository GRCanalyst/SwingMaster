"use client";

import { Activity, Wifi, WifiOff, RefreshCw, TrendingUp } from "lucide-react";
import { MarketStatus } from "@/types";
import { triggerScan } from "@/lib/api";
import { useState } from "react";

interface HeaderProps {
  marketStatus: MarketStatus | null;
  wsConnected: boolean;
  onScanComplete?: () => void;
}

export default function Header({ marketStatus, wsConnected, onScanComplete }: HeaderProps) {
  const [scanning, setScanning] = useState(false);

  async function handleScan() {
    setScanning(true);
    await triggerScan();
    setTimeout(() => {
      setScanning(false);
      onScanComplete?.();
    }, 3000);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-bg-border bg-bg-card/90 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-green/10 border border-brand-green/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-brand-green" />
          </div>
          <div>
            <span className="text-text-primary font-bold text-lg tracking-tight">
              Swing<span className="text-brand-green">Master</span>
            </span>
            <span className="ml-2 text-xs text-text-muted font-mono bg-bg-elevated px-2 py-0.5 rounded">
              AI
            </span>
          </div>
        </div>

        {/* Center — Market status ticker */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${marketStatus?.is_open ? "bg-brand-green animate-pulse" : "bg-text-muted"}`} />
          {marketStatus ? (
            <span className={`font-mono text-xs ${marketStatus.is_open ? "text-brand-green" : "text-text-muted"}`}>
              {marketStatus.is_open ? "MARKET OPEN" : "MARKET CLOSED"}
              {" — "}
              {marketStatus.time_et}
            </span>
          ) : (
            <span className="text-text-muted font-mono text-xs">Connecting...</span>
          )}
        </div>

        {/* Right — status + scan button */}
        <div className="flex items-center gap-3">
          {/* WebSocket status */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {wsConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-brand-green" />
                <span className="text-brand-green hidden sm:inline">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-text-muted hidden sm:inline">OFFLINE</span>
              </>
            )}
          </div>

          {/* Activity indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted font-mono">
            <Activity className="w-3.5 h-3.5" />
            <span>AUTO-SCAN ON</span>
          </div>

          {/* Manual scan button */}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-green/10 border border-brand-green/30 text-brand-green text-sm font-medium hover:bg-brand-green/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>
    </header>
  );
}
