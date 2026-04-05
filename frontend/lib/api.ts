const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchAlerts() {
  const res = await fetch(`${API}/alerts`);
  return res.json();
}

export async function fetchAlertHistory(params?: {
  limit?: number;
  ticker?: string;
  signal_type?: string;
  only_trades?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.limit)       query.set("limit",       String(params.limit));
  if (params?.ticker)      query.set("ticker",      params.ticker);
  if (params?.signal_type) query.set("signal_type", params.signal_type);
  if (params?.only_trades) query.set("only_trades", "true");
  const res = await fetch(`${API}/alerts/history?${query}`);
  return res.json();
}

export async function fetchAlertStats() {
  const res = await fetch(`${API}/alerts/stats`);
  return res.json();
}

export async function fetchWatchlist(): Promise<{ watchlist: string[] }> {
  const res = await fetch(`${API}/watchlist`);
  return res.json();
}

export async function updateWatchlist(tickers: string[]) {
  const res = await fetch(`${API}/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  return res.json();
}

export async function fetchMarketStatus() {
  const res = await fetch(`${API}/market-status`);
  return res.json();
}

export async function fetchQuote(ticker: string) {
  const res = await fetch(`${API}/quote/${ticker}`);
  return res.json();
}

export async function triggerScan() {
  const res = await fetch(`${API}/scan`, { method: "POST" });
  return res.json();
}

export async function analyzeTicker(ticker: string) {
  const res = await fetch(`${API}/analyze/${ticker}`, { method: "POST" });
  return res.json();
}
