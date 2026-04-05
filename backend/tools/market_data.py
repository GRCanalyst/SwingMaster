"""
Market data tools: Finnhub (real-time quotes + news) + yfinance (historical OHLCV).
"""

import finnhub
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import settings

_client: Optional[finnhub.Client] = None


def _get_client() -> finnhub.Client:
    global _client
    if _client is None:
        _client = finnhub.Client(api_key=settings.finnhub_api_key)
    return _client


def get_real_time_quote(ticker: str) -> dict:
    """Fetch live price from Finnhub."""
    try:
        q = _get_client().quote(ticker)
        prev_close = q.get("pc", 0)
        current = q.get("c", 0)
        change_pct = ((current - prev_close) / prev_close * 100) if prev_close else 0
        return {
            "ticker": ticker,
            "current_price": round(current, 2),
            "open": round(q.get("o", 0), 2),
            "high": round(q.get("h", 0), 2),
            "low": round(q.get("l", 0), 2),
            "prev_close": round(prev_close, 2),
            "change_pct": round(change_pct, 2),
        }
    except Exception as e:
        return {"ticker": ticker, "error": str(e)}


def get_ohlcv_data(ticker: str, days: int = 90) -> pd.DataFrame:
    """Fetch daily OHLCV candles from yfinance (free, ~15 min delay — fine for swing trading)."""
    try:
        end = datetime.now()
        start = end - timedelta(days=days)
        df = yf.download(ticker, start=start.strftime("%Y-%m-%d"),
                         end=end.strftime("%Y-%m-%d"), interval="1d",
                         progress=False, auto_adjust=True)
        if df.empty:
            return pd.DataFrame()
        # Flatten multi-level columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df
    except Exception:
        return pd.DataFrame()


def get_recent_news(ticker: str, days: int = 2) -> list:
    """Fetch company news from Finnhub for the last N days."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        news = _get_client().company_news(ticker, _from=from_date, to=today)
        return [
            {
                "headline": n.get("headline", ""),
                "summary": n.get("summary", "")[:200],
                "source": n.get("source", ""),
                "datetime": datetime.fromtimestamp(n.get("datetime", 0)).strftime("%Y-%m-%d %H:%M") if n.get("datetime") else "",
            }
            for n in (news or [])[:8]
        ]
    except Exception:
        return []
