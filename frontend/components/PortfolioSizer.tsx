"use client";

import { useState } from "react";
import { DollarSign, Info } from "lucide-react";

export default function PortfolioSizer() {
  const [portfolio, setPortfolio] = useState<string>("10000");
  const [riskPct, setRiskPct] = useState<string>("1");
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");

  const portfolioNum = parseFloat(portfolio) || 0;
  const riskPctNum = parseFloat(riskPct) || 1;
  const entryNum = parseFloat(entryPrice) || 0;
  const stopNum = parseFloat(stopLoss) || 0;

  const riskAmount = portfolioNum * (riskPctNum / 100);
  const riskPerShare = entryNum > 0 && stopNum > 0 ? Math.abs(entryNum - stopNum) : 0;
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const positionSize = shares * entryNum;

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-bg-border flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Position Sizer</span>
        <div className="ml-auto" title="Calculates how many shares to buy based on your risk tolerance">
          <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {[
          { label: "Portfolio Size ($)", value: portfolio, setter: setPortfolio, placeholder: "10000" },
          { label: "Risk Per Trade (%)", value: riskPct, setter: setRiskPct, placeholder: "1" },
          { label: "Entry Price ($)", value: entryPrice, setter: setEntryPrice, placeholder: "0.00" },
          { label: "Stop Loss ($)", value: stopLoss, setter: setStopLoss, placeholder: "0.00" },
        ].map((field) => (
          <div key={field.label}>
            <label className="block text-xs text-text-muted mb-1">{field.label}</label>
            <input
              type="number"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              placeholder={field.placeholder}
              className="w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-green/40 transition-colors"
            />
          </div>
        ))}

        {/* Results */}
        <div className="mt-4 space-y-2 pt-3 border-t border-bg-border">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Max Risk Amount</span>
            <span className="font-mono text-brand-red">${riskAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Shares to Buy</span>
            <span className="font-mono text-brand-gold font-bold text-sm">{shares > 0 ? shares : "—"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Position Size</span>
            <span className="font-mono text-brand-green">{positionSize > 0 ? `$${positionSize.toFixed(2)}` : "—"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">% of Portfolio</span>
            <span className="font-mono text-text-secondary">
              {portfolioNum > 0 && positionSize > 0 ? `${((positionSize / portfolioNum) * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-2 leading-relaxed">
          This tool uses the 1–2% risk rule: never risk more than 1–2% of your total portfolio on a single trade.
        </p>
      </div>
    </div>
  );
}
