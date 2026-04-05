export interface ConfidenceBreakdown {
  [factor: string]: number;
}

export interface AlertPrices {
  current_price?: number;
  entry_low?: number;
  entry_high?: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number;
}

export interface Alert {
  id?: number;
  ticker: string;
  message: string;
  timestamp: string;
  is_alert?: boolean;
  signal_type?: string;                      // BUY | SELL | EXIT | NONE
  confidence_score?: number;                 // 0–100
  confidence_label?: string;                 // High | Medium | Low
  confidence_breakdown?: ConfidenceBreakdown;
  prices?: AlertPrices;
  db_id?: number;
  triggered_by?: string;
  // Flat DB history fields (returned directly from SQLite rows)
  entry_low?: number;
  entry_high?: number;
  stop_loss?: number;
  take_profit_1?: number;
  take_profit_2?: number;
  current_price?: number;
  rsi?: number;
  trend?: string;
}

export interface AlertStats {
  total_scans: number;
  total_trades: number;
  buy_alerts: number;
  sell_alerts: number;
  avg_confidence: number;
  high_confidence_alerts: number;
  top_ticker: string | null;
}

export interface Quote {
  ticker: string;
  current_price: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  change_pct: number;
  error?: string;
}

export interface MarketStatus {
  is_open: boolean;
  time_et: string;
  day: string;
}

export type SignalType = "BUY" | "SELL" | "EXIT" | "NONE";
