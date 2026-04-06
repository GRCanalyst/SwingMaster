"""
PreFilter Master — pure Python implementation of the 5-rule swing trade screener.

Scans S&P 500 + S&P MidCap 400 (~900 stocks, approximating Russell 1000)
using yfinance batch download split into chunks for reliability.
Applies all 5 rules, scores survivors 0–10, returns top 10 candidates
for the main SwingMaster AI agent to deep-analyse.

No AI calls here — fast, free, deterministic.
"""

import logging
import time as _time
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import pandas_ta as ta
import yfinance as yf

from universe import get_universe

log = logging.getLogger("prefilter")

# ── Config ────────────────────────────────────────────────────────────────────
MIN_AVG_VOLUME    = 500_000   # Rule 1: 20-day avg volume
MIN_PRICE         = 5.0       # Rule 1: no penny stocks
MAX_PRICE         = 500.0     # Rule 1: raised ceiling for large caps
MIN_VOLUME_RATIO  = 1.20      # Rule 4: today's vol vs 20-day avg
MIN_SCORE         = 7.5       # Scoring threshold
TOP_N             = 5         # Max candidates returned to main agent
CHUNK_SIZE        = 100       # Download universe in chunks for reliability
CACHE_TTL_SECONDS = 600       # Re-use downloaded data for 10 min (larger universe)

# ── In-memory data cache ──────────────────────────────────────────────────────
_cache: dict = {"data": {}, "ts": 0.0}


def _download_chunk(tickers: list[str]) -> dict[str, pd.DataFrame]:
    """Download one chunk of tickers. Returns {ticker: DataFrame}."""
    if len(tickers) == 1:
        raw = yf.download(tickers[0], period="1y", interval="1d",
                          auto_adjust=True, progress=False)
        if not raw.empty:
            return {tickers[0]: raw}
        return {}

    raw = yf.download(
        tickers=tickers,
        period="1y",
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    result = {}
    for t in tickers:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                df = raw[t].dropna(how="all")
            else:
                df = raw.dropna(how="all")
            if len(df) >= 60:
                result[t] = df
        except (KeyError, TypeError):
            pass
    return result


def _download_universe() -> dict[str, pd.DataFrame]:
    """
    Download all universe tickers in CHUNK_SIZE batches.
    Returns a dict of {ticker: OHLCV DataFrame}.
    Results are cached for CACHE_TTL_SECONDS.
    """
    global _cache
    now = _time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL_SECONDS:
        log.info(f"Using cached data ({len(_cache['data'])} tickers).")
        return _cache["data"]

    universe = get_universe()
    chunks   = [universe[i:i + CHUNK_SIZE] for i in range(0, len(universe), CHUNK_SIZE)]
    log.info(f"Downloading {len(universe)} tickers in {len(chunks)} chunks of {CHUNK_SIZE}…")

    all_data: dict[str, pd.DataFrame] = {}
    for idx, chunk in enumerate(chunks, 1):
        log.info(f"  Chunk {idx}/{len(chunks)} ({len(chunk)} tickers)…")
        all_data.update(_download_chunk(chunk))

    _cache = {"data": all_data, "ts": now}
    log.info(f"Download complete — {len(all_data)} tickers with data.")
    return all_data


def _get_ticker_df(data: dict[str, pd.DataFrame], ticker: str) -> Optional[pd.DataFrame]:
    """Look up a single ticker's DataFrame from the pre-built dict."""
    df = data.get(ticker)
    if df is None or len(df) < 60:
        return None
    return df


def _score_ticker(ticker: str, df: pd.DataFrame) -> Optional[dict]:
    """
    Apply all 5 filter rules and return a scored candidate dict,
    or None if the ticker fails any hard-fail rule.
    """
    try:
        close  = df["Close"].squeeze()
        volume = df["Volume"].squeeze()
        high   = df["High"].squeeze()

        current_price  = float(close.iloc[-1])
        current_volume = float(volume.iloc[-1])
        avg_volume_20  = float(volume.tail(20).mean())

        # ── RULE 1: Liquidity & Tradability ───────────────────────────────────
        if avg_volume_20 < MIN_AVG_VOLUME:
            return None
        if not (MIN_PRICE <= current_price <= MAX_PRICE):
            return None

        # ── RULE 2: Trend (both must pass) ────────────────────────────────────
        ema50  = ta.ema(close, length=50)
        ema200 = ta.ema(close, length=200)
        if ema50 is None or ema200 is None:
            return None

        ema50_val  = float(ema50.iloc[-1])
        ema200_val = float(ema200.iloc[-1])

        if pd.isna(ema50_val) or pd.isna(ema200_val):
            return None
        if current_price <= ema200_val:   # hard fail — not in uptrend
            return None
        if current_price <= ema50_val:    # hard fail — intermediate trend broken
            return None

        # ── RULE 3: Pullback condition (at least one must pass) ───────────────
        rsi_series  = ta.rsi(close, length=14)
        macd_df     = ta.macd(close, fast=12, slow=26, signal=9)
        rsi_val     = float(rsi_series.iloc[-1]) if rsi_series is not None else 50.0

        # 3a. RSI in pullback zone
        rsi_ok = 35 <= rsi_val <= 55

        # 3b. 1–4% pullback from 20-day high with above-average volume
        recent_high = float(high.tail(20).max())
        pullback_pct = ((recent_high - current_price) / recent_high) * 100
        pullback_ok  = (1.0 <= pullback_pct <= 4.0) and (current_volume >= avg_volume_20 * 1.1)

        # 3c. MACD histogram turning positive or line crossing signal in last 3 days
        macd_ok = False
        if macd_df is not None and not macd_df.empty:
            hist_col = [c for c in macd_df.columns if "h" in c.lower()]
            macd_col = [c for c in macd_df.columns if "macd" in c.lower() and "s" not in c.lower() and "h" not in c.lower()]
            sig_col  = [c for c in macd_df.columns if "macds" in c.lower() or ("signal" in c.lower())]

            if hist_col:
                hist = macd_df[hist_col[0]].tail(3)
                macd_ok = bool((hist.iloc[-1] > 0) or (hist.diff().iloc[-1] > 0))

            if not macd_ok and macd_col and sig_col:
                mc = macd_df[macd_col[0]].tail(3)
                sc = macd_df[sig_col[0]].tail(3)
                # Crossover: MACD crossed above signal in last 3 days
                if len(mc) >= 2 and len(sc) >= 2:
                    macd_ok = bool((mc.iloc[-2] <= sc.iloc[-2]) and (mc.iloc[-1] > sc.iloc[-1]))

        if not any([rsi_ok, pullback_ok, macd_ok]):
            return None   # hard fail — no pullback condition met

        # ── RULE 4: Volume confirmation ───────────────────────────────────────
        volume_ratio = current_volume / avg_volume_20 if avg_volume_20 > 0 else 0.0

        # ── RULE 5: Risk-Reward potential ─────────────────────────────────────
        resistance = float(high.tail(20).max())
        support    = float(df["Low"].tail(20).min())
        risk       = current_price - support
        reward     = resistance - current_price
        rr_ratio   = (reward / risk) if risk > 0 else 0.0

        # ATR — reasonable volatility check (not so wild it's untradeable)
        atr_series = ta.atr(df["High"].squeeze(), df["Low"].squeeze(), close, length=14)
        atr_val    = float(atr_series.iloc[-1]) if atr_series is not None else 0.0
        atr_pct    = (atr_val / current_price) * 100 if current_price > 0 else 0.0
        atr_ok     = atr_pct <= 8.0   # reject if daily swing > 8% (too wild)

        # ── SCORING (1–10) ────────────────────────────────────────────────────
        score = 0.0

        # Liquidity (1.5 pts)
        if avg_volume_20 >= 2_000_000:   score += 1.5
        elif avg_volume_20 >= 1_000_000: score += 1.2
        elif avg_volume_20 >= 500_000:   score += 0.8

        # Trend strength (3.0 pts)
        trend_gap_200 = (current_price - ema200_val) / ema200_val * 100
        trend_gap_50  = (current_price - ema50_val)  / ema50_val  * 100
        # Prefer tight to EMA (pullback near EMA = better entry)
        score += 1.5 if trend_gap_200 <= 5 else (1.2 if trend_gap_200 <= 10 else 0.8)
        score += 1.5 if trend_gap_50  <= 3 else (1.0 if trend_gap_50  <= 7  else 0.5)

        # Pullback quality (2.5 pts)
        pullback_score = 0.0
        if rsi_ok:
            # RSI closer to 40 = sweeter spot
            pullback_score = max(pullback_score, 2.5 if 38 <= rsi_val <= 48 else 2.0)
        if pullback_ok:
            pullback_score = max(pullback_score, 2.0)
        if macd_ok:
            pullback_score = max(pullback_score, 1.8)
        score += pullback_score

        # Volume (1.5 pts)
        if volume_ratio >= 2.0:   score += 1.5
        elif volume_ratio >= 1.5: score += 1.2
        elif volume_ratio >= 1.2: score += 0.8
        # below 1.2 = 0 pts but not a hard fail

        # Risk-Reward (1.5 pts)
        if rr_ratio >= 3.0:   score += 1.5
        elif rr_ratio >= 2.0: score += 1.2
        elif rr_ratio >= 1.5: score += 0.7

        # ATR penalty
        if not atr_ok:
            score -= 1.0

        score = round(min(max(score, 0.0), 10.0), 2)

        if score < MIN_SCORE:
            return None

        # ── Build quick reason string ──────────────────────────────────────────
        reasons = []
        if current_price > ema200_val: reasons.append("above 200 EMA")
        if rsi_ok:       reasons.append(f"RSI {rsi_val:.0f} (pullback zone)")
        if pullback_ok:  reasons.append(f"{pullback_pct:.1f}% pullback from high")
        if macd_ok:      reasons.append("MACD turning bullish")
        if volume_ratio >= 1.2: reasons.append(f"volume {volume_ratio:.1f}x avg")

        stop_loss = round(support * 0.995, 2)   # just below 20-day low

        return {
            "ticker":               ticker,
            "score":                score,
            "quick_reason":         ", ".join(reasons),
            "current_price":        round(current_price, 2),
            "stop_loss_suggestion": stop_loss,
            "rsi":                  round(rsi_val, 1),
            "volume_ratio":         round(volume_ratio, 2),
            "rr_ratio":             round(rr_ratio, 2),
            "ema50":                round(ema50_val, 2),
            "ema200":               round(ema200_val, 2),
        }

    except Exception as e:
        log.debug(f"Error scoring {ticker}: {e}")
        return None


def run_prefilter(custom_universe: Optional[list[str]] = None) -> dict:
    """
    Run the full PreFilter Master scan over S&P 500 + S&P MidCap 400 (~900 stocks).

    Returns a dict matching the system prompt's JSON output format.
    """
    t_start = _time.time()

    # Use live universe (S&P 500 + MidCap 400) or custom override
    tickers = custom_universe or get_universe()
    log.info(f"PreFilter Master starting — {len(tickers)} tickers (S&P500 + MidCap400)")

    try:
        data = _download_universe()
    except Exception as e:
        log.error(f"Universe download failed: {e}")
        return {
            "candidates": [], "total_scanned": 0,
            "passed_filter": 0, "message": f"Data download error: {e}",
            "scan_duration_sec": 0,
        }

    candidates = []
    errors     = 0

    for ticker in tickers:
        df = _get_ticker_df(data, ticker)
        if df is None:
            errors += 1
            continue
        result = _score_ticker(ticker, df)
        if result:
            candidates.append(result)

    candidates.sort(key=lambda x: x["score"], reverse=True)
    top      = candidates[:TOP_N]
    duration = round(_time.time() - t_start, 1)
    passed   = len(candidates)

    msg = f"Top {len(top)} candidates ready for deep analysis" if top else \
          "No high-confidence swing setups found in current market"

    log.info(f"PreFilter done — scanned {len(tickers)}, passed {passed}, top {len(top)} | {duration}s")

    return {
        "candidates":        top,
        "total_scanned":     len(tickers),
        "passed_filter":     passed,
        "errors":            errors,
        "message":           msg,
        "scan_duration_sec": duration,
        "timestamp":         datetime.utcnow().isoformat(),
    }
