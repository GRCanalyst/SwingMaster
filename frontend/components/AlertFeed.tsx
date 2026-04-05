"use client";

import { Alert } from "@/types";
import AlertCard from "./AlertCard";
import { BellOff, Loader2 } from "lucide-react";

interface AlertFeedProps {
  alerts: Alert[];
  loading: boolean;
  newAlertIds: Set<string>;
}

export default function AlertFeed({ alerts, loading, newAlertIds }: AlertFeedProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-muted gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
        <span className="font-mono text-sm">Connecting to SwingMaster...</span>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-text-muted">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-bg-border flex items-center justify-center">
          <BellOff className="w-8 h-8 text-text-muted" />
        </div>
        <div className="text-center">
          <p className="text-text-secondary font-medium">No alerts yet</p>
          <p className="text-sm mt-1">
            SwingMaster scans every 10 minutes during market hours.
          </p>
          <p className="text-sm">Hit <span className="font-mono text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded">Scan Now</span> to trigger a manual scan.</p>
        </div>
      </div>
    );
  }

  const tradeAlerts = alerts.filter((a) => a.is_alert !== false);
  const infoAlerts = alerts.filter((a) => a.is_alert === false);

  return (
    <div className="space-y-4">
      {tradeAlerts.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
            Trade Alerts ({tradeAlerts.length})
          </div>
          {tradeAlerts.map((alert, i) => (
            <AlertCard
              key={`${alert.ticker}-${alert.timestamp}`}
              alert={alert}
              isNew={newAlertIds.has(`${alert.ticker}-${alert.timestamp}`)}
            />
          ))}
        </>
      )}

      {infoAlerts.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted uppercase tracking-widest mt-6">
            <span className="w-2 h-2 rounded-full bg-text-muted" />
            No Setup ({infoAlerts.length} scanned, no signal)
          </div>
          {infoAlerts.map((alert) => (
            <AlertCard
              key={`${alert.ticker}-${alert.timestamp}`}
              alert={alert}
              isNew={false}
            />
          ))}
        </>
      )}
    </div>
  );
}
