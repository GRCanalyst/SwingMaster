"use client";

import { ConfidenceBreakdown } from "@/types";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ConfidenceMeterProps {
  score?: number;
  label?: string;
  breakdown?: ConfidenceBreakdown;
  compact?: boolean;
}

function scoreColor(score: number) {
  if (score >= 70) return { bar: "bg-brand-green", text: "text-brand-green", bg: "bg-brand-green/10 border-brand-green/30" };
  if (score >= 50) return { bar: "bg-brand-gold",  text: "text-brand-gold",  bg: "bg-brand-gold/10 border-brand-gold/30"  };
  return            { bar: "bg-brand-red",   text: "text-brand-red",   bg: "bg-brand-red/10 border-brand-red/30"    };
}

export default function ConfidenceMeter({ score, label, breakdown, compact = false }: ConfidenceMeterProps) {
  const [expanded, setExpanded] = useState(false);

  if (score === undefined || score === null || label === "N/A") return null;

  const colors = scoreColor(score);
  const maxPossible = 100;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono font-semibold ${colors.bg} ${colors.text}`}>
        <div className="w-3 h-3 relative">
          <svg viewBox="0 0 12 12" className="w-3 h-3">
            <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
            <circle
              cx="6" cy="6" r="5"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeDasharray={`${(score / 100) * 31.4} 31.4`}
              strokeLinecap="round"
              transform="rotate(-90 6 6)"
            />
          </svg>
        </div>
        {score}% {label}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-bg-border bg-bg-elevated overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-card/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Confidence</span>
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${colors.bg} ${colors.text}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={`text-sm font-bold font-mono ${colors.text}`}>{score}%</span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          }
        </div>
      </button>

      {/* Breakdown */}
      {expanded && breakdown && Object.keys(breakdown).length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-bg-border pt-2">
          {Object.entries(breakdown).map(([factor, pts]) => {
            // Derive max for each factor from total breakdown
            const totalPts = Object.values(breakdown).reduce((a, b) => a + b, 0);
            const barWidth = score > 0 ? (pts / score) * Math.min(score, 100) : 0;
            return (
              <div key={factor} className="flex items-center gap-2 text-xs">
                <span className="w-36 text-text-muted truncate">{factor}</span>
                <div className="flex-1 h-1 bg-bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pts > 0 ? colors.bar : "bg-bg-border"}`}
                    style={{ width: pts > 0 ? `${(pts / 25) * 100}%` : "0%" }}
                  />
                </div>
                <span className={`w-8 text-right font-mono font-semibold ${pts > 0 ? colors.text : "text-text-muted"}`}>
                  {pts}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between text-xs pt-1 border-t border-bg-border mt-1">
            <span className="text-text-muted">Total score</span>
            <span className={`font-mono font-bold ${colors.text}`}>{score} / 100</span>
          </div>
        </div>
      )}
    </div>
  );
}
