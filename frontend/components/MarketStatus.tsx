"use client";

import { useEffect, useState } from "react";
import { fetchMarketStatus } from "@/lib/api";
import { MarketStatus as IMarketStatus } from "@/types";
import { Clock, BarChart2 } from "lucide-react";

export default function MarketStatus() {
  const [status, setStatus] = useState<IMarketStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await fetchMarketStatus();
        setStatus(s);
      } catch {}
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const sessions = [
    { label: "Pre-Market", time: "4:00 AM – 9:30 AM ET", active: false },
    { label: "Regular Hours", time: "9:30 AM – 4:00 PM ET", active: status?.is_open ?? false },
    { label: "After-Hours", time: "4:00 PM – 8:00 PM ET", active: false },
  ];

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-bg-border flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Market Hours</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Current time */}
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <Clock className="w-3.5 h-3.5" />
          <span>{status?.time_et ?? "Loading..."}</span>
          {status?.day && <span className="text-text-muted">· {status.day}</span>}
        </div>

        {/* Status indicator */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          status?.is_open
            ? "bg-brand-green/8 border-brand-green/25"
            : "bg-bg-elevated border-bg-border"
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            status?.is_open ? "bg-brand-green animate-pulse" : "bg-text-muted"
          }`} />
          <span className={`text-sm font-semibold ${
            status?.is_open ? "text-brand-green" : "text-text-muted"
          }`}>
            {status?.is_open ? "Market Open" : "Market Closed"}
          </span>
        </div>

        {/* Sessions */}
        <div className="space-y-1.5">
          {sessions.map((s) => (
            <div key={s.label} className={`flex justify-between items-center text-xs py-1.5 px-2 rounded ${
              s.active ? "bg-brand-green/5 text-brand-green" : "text-text-muted"
            }`}>
              <span className={`font-medium ${s.active ? "" : ""}`}>{s.label}</span>
              <span className="font-mono">{s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
