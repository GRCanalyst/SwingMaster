"use client";

import { Alert } from "@/types";
import { TrendingUp, TrendingDown, Bell, BarChart2 } from "lucide-react";

interface StatsBarProps {
  alerts: Alert[];
}

export default function StatsBar({ alerts }: StatsBarProps) {
  const tradeAlerts = alerts.filter((a) => a.is_alert !== false);
  const buyAlerts = tradeAlerts.filter((a) => /BUY/i.test(a.message));
  const sellAlerts = tradeAlerts.filter((a) => /SELL|EXIT/i.test(a.message));

  const stats = [
    {
      label: "Total Alerts",
      value: tradeAlerts.length,
      icon: <Bell className="w-4 h-4" />,
      color: "text-brand-blue",
      bg: "bg-brand-blue/10 border-brand-blue/20",
    },
    {
      label: "Buy Signals",
      value: buyAlerts.length,
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-brand-green",
      bg: "bg-brand-green/10 border-brand-green/20",
    },
    {
      label: "Sell / Exit",
      value: sellAlerts.length,
      icon: <TrendingDown className="w-4 h-4" />,
      color: "text-brand-red",
      bg: "bg-brand-red/10 border-brand-red/20",
    },
    {
      label: "Tickers Scanned",
      value: new Set(alerts.map((a) => a.ticker)).size,
      icon: <BarChart2 className="w-4 h-4" />,
      color: "text-brand-gold",
      bg: "bg-brand-gold/10 border-brand-gold/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-xl border ${s.bg} bg-bg-card p-4 flex items-center gap-3`}
        >
          <div className={`${s.color} flex-shrink-0`}>{s.icon}</div>
          <div>
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
