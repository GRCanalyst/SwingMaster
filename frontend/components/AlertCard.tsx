"use client";

import { Alert, SignalType } from "@/types";
import { TrendingUp, TrendingDown, LogOut, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ConfidenceMeter from "./ConfidenceMeter";

interface AlertCardProps {
  alert: Alert;
  isNew?: boolean;
}

function detectSignal(message: string): SignalType {
  if (/BUY/i.test(message)) return "BUY";
  if (/SELL/i.test(message)) return "SELL";
  if (/EXIT/i.test(message)) return "EXIT";
  return "NONE";
}

function parseAlertSections(message: string) {
  const lines = message.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: { key: string; value: string }[] = [];
  let currentKey = "";
  let currentVal: string[] = [];

  for (const line of lines) {
    if (line.startsWith("**") && line.endsWith("**")) {
      if (currentKey) sections.push({ key: currentKey, value: currentVal.join("\n") });
      currentKey = line.replace(/\*\*/g, "");
      currentVal = [];
    } else if (currentKey) {
      currentVal.push(line);
    }
  }
  if (currentKey) sections.push({ key: currentKey, value: currentVal.join("\n") });
  return sections;
}

function renderMessage(message: string, signal: SignalType) {
  const lines = message.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    // Header line (🚨 SWING TRADE ALERT)
    if (trimmed.includes("SWING TRADE ALERT")) {
      return (
        <div key={i} className="text-base font-bold tracking-wide mb-1 flex items-center gap-2">
          <span>{trimmed}</span>
        </div>
      );
    }

    // Section headers **bold**
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      return (
        <div key={i} className="text-text-secondary text-xs font-semibold uppercase tracking-widest mt-3 mb-1">
          {trimmed.replace(/\*\*/g, "")}
        </div>
      );
    }

    // Bullet points with price data
    if (trimmed.startsWith("•")) {
      const content = trimmed.slice(1).trim();
      const isStopLoss = /stop loss/i.test(content);
      const isEntry = /entry/i.test(content);
      const isProfit = /profit|take/i.test(content);
      const isPrice = /\$[\d.]+/.test(content);

      return (
        <div key={i} className={`flex items-start gap-2 text-sm py-0.5 ${
          isStopLoss ? "text-brand-red" :
          isProfit ? "text-brand-green" :
          isEntry ? "text-brand-gold" :
          isPrice ? "text-text-primary" :
          "text-text-secondary"
        }`}>
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
          <span className="font-mono text-xs leading-relaxed">{content}</span>
        </div>
      );
    }

    // Risk-Reward line
    if (/risk.reward/i.test(trimmed)) {
      return (
        <div key={i} className="text-brand-blue text-xs font-mono font-semibold mt-1">
          {trimmed.replace(/\*\*/g, "")}
        </div>
      );
    }

    // Disclaimer
    if (/NOT financial advice/i.test(trimmed)) {
      return (
        <div key={i} className="flex items-start gap-1.5 mt-3 p-2 rounded bg-bg-elevated border border-bg-border text-text-muted text-xs">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-brand-gold" />
          <span>{trimmed}</span>
        </div>
      );
    }

    // Default line
    return (
      <div key={i} className="text-text-secondary text-sm">
        {trimmed.replace(/\*\*/g, "")}
      </div>
    );
  });
}

export default function AlertCard({ alert, isNew = false }: AlertCardProps) {
  const signal = detectSignal(alert.message);
  const isAlert = alert.is_alert ?? signal !== "NONE";

  const signalConfig = {
    BUY: {
      icon: <TrendingUp className="w-4 h-4" />,
      label: "BUY",
      border: "border-brand-green/40",
      glow: "glow-green",
      badge: "bg-brand-green/15 text-brand-green border border-brand-green/30",
      header: "from-brand-green/8 to-transparent",
    },
    SELL: {
      icon: <TrendingDown className="w-4 h-4" />,
      label: "SELL",
      border: "border-brand-red/40",
      glow: "glow-red",
      badge: "bg-brand-red/15 text-brand-red border border-brand-red/30",
      header: "from-brand-red/8 to-transparent",
    },
    EXIT: {
      icon: <LogOut className="w-4 h-4" />,
      label: "EXIT",
      border: "border-brand-red/40",
      glow: "glow-red",
      badge: "bg-brand-red/15 text-brand-red border border-brand-red/30",
      header: "from-brand-red/8 to-transparent",
    },
    NONE: {
      icon: null,
      label: "INFO",
      border: "border-bg-border",
      glow: "",
      badge: "bg-bg-elevated text-text-muted border border-bg-border",
      header: "from-bg-elevated/50 to-transparent",
    },
  };

  const cfg = signalConfig[signal];

  return (
    <div
      className={`
        rounded-xl border ${cfg.border} ${cfg.glow}
        bg-bg-card overflow-hidden
        ${isNew ? "animate-slide-in" : "animate-fade-in"}
        transition-all hover:border-opacity-70
      `}
    >
      {/* Card header strip */}
      <div className={`bg-gradient-to-r ${cfg.header} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {/* Ticker badge */}
          <div className="flex items-center gap-1.5 bg-bg-elevated border border-bg-border px-3 py-1 rounded-md">
            <span className="font-mono font-bold text-text-primary text-sm">{alert.ticker}</span>
          </div>

          {/* Signal badge */}
          {isAlert && (
            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${cfg.badge}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-text-muted text-xs font-mono">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        <div className="alert-message space-y-0.5">
          {renderMessage(alert.message, signal)}
        </div>

        {/* Confidence meter — only on real trade alerts */}
        {isAlert && alert.confidence_score !== undefined && (
          <ConfidenceMeter
            score={alert.confidence_score}
            label={alert.confidence_label}
            breakdown={alert.confidence_breakdown}
          />
        )}
      </div>
    </div>
  );
}
