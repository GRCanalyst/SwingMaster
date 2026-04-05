"""
Technical indicators: EMA 20/50/200, RSI(14), MACD, support/resistance.
Uses pandas_ta for clean, reliable calculations.
"""

import pandas as pd
import pandas_ta as ta
from tools.market_data import get_ohlcv_data


def calculate_indicators(ticker: str) -> dict:
    """
    Returns a dict of technical indicators for the latest trading day.
    Falls back gracefully if data is unavailable.
    """
    df = get_ohlcv_data(ticker, days=250)  # 250 days needed for reliable EMA200
    if df.empty or len(df) < 30:
        return {"error": f"Not enough data for {ticker}"}

    close = df["Close"].squeeze()
    high = df["High"].squeeze()
    low = df["Low"].squeeze()
    volume = df["Volume"].squeeze()

    # EMAs
    df["EMA20"] = ta.ema(close, length=20)
    df["EMA50"] = ta.ema(close, length=50)
    df["EMA200"] = ta.ema(close, length=200)

    # RSI
    df["RSI"] = ta.rsi(close, length=14)

    # MACD
    macd_df = ta.macd(close, fast=12, slow=26, signal=9)
    if macd_df is not None and not macd_df.empty:
        df["MACD"] = macd_df.iloc[:, 0]
        df["MACD_Signal"] = macd_df.iloc[:, 2]
        df["MACD_Hist"] = macd_df.iloc[:, 1]

    # Support & Resistance (20-day swing lows/highs)
    recent = df.tail(20)
    support = float(recent["Low"].min())
    resistance = float(recent["High"].max())

    # Average volume (20 day)
    avg_volume = float(volume.tail(20).mean())

    latest = df.iloc[-1]

    def safe(val):
        try:
            v = float(val)
            return round(v, 4) if abs(v) < 1 else round(v, 2)
        except Exception:
            return None

    trend = "UPTREND" if safe(latest.get("EMA200")) and safe(latest["Close"]) and float(latest["Close"]) > float(latest.get("EMA200", 0)) else "DOWNTREND"

    return {
        "close": safe(latest["Close"]),
        "ema20": safe(latest.get("EMA20")),
        "ema50": safe(latest.get("EMA50")),
        "ema200": safe(latest.get("EMA200")),
        "rsi": safe(latest.get("RSI")),
        "macd": safe(latest.get("MACD")),
        "macd_signal": safe(latest.get("MACD_Signal")),
        "macd_hist": safe(latest.get("MACD_Hist")),
        "support": round(support, 2),
        "resistance": round(resistance, 2),
        "volume": int(latest["Volume"]),
        "avg_volume_20d": int(avg_volume),
        "trend": trend,
        "volume_ratio": round(int(latest["Volume"]) / avg_volume, 2) if avg_volume > 0 else None,
    }
