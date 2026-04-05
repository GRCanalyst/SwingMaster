"""
Confidence scoring engine — estimates the probability of a swing trade being profitable.

Scoring is purely based on objective technical factors (0–100 scale):

  Factor                  Max pts   Logic
  ──────────────────────────────────────────────────────────────
  Trend alignment           25      Price above 200 EMA = uptrend confirmed
  EMA stack                 15      Price > EMA20 > EMA50 (full bull alignment)
  RSI position              20      BUY: RSI<30 ideal | SELL: RSI>70 ideal
  MACD signal               15      Crossover direction + histogram momentum
  Volume confirmation       15      Above-average volume = conviction
  Support/resistance prox.  10      Tight to key level = better risk/reward
  ──────────────────────────────────────────────────────────────
  Total                    100

Label thresholds:
  High   ≥ 70   — strong setup, all or most factors aligned
  Medium  50–69  — decent setup, some factors mixed
  Low    < 50   — weak/marginal setup
"""

import re


def _safe(val, default=0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _score_buy(ind: dict) -> dict:
    close        = _safe(ind.get("close"))
    ema20        = _safe(ind.get("ema20"))
    ema50        = _safe(ind.get("ema50"))
    rsi          = _safe(ind.get("rsi"), 50)
    macd         = _safe(ind.get("macd"))
    macd_signal  = _safe(ind.get("macd_signal"))
    macd_hist    = _safe(ind.get("macd_hist"))
    volume_ratio = _safe(ind.get("volume_ratio"), 1.0)
    support      = _safe(ind.get("support"))
    trend        = ind.get("trend", "")

    pts = {}

    # 1. Trend alignment (25 pts)
    pts["Trend alignment"] = 25 if trend == "UPTREND" else 0

    # 2. EMA stack (15 pts)
    ema_pts = 0
    if close and ema20 and close > ema20:
        ema_pts += 8
    if ema20 and ema50 and ema20 > ema50:
        ema_pts += 7
    pts["EMA stack"] = min(ema_pts, 15)

    # 3. RSI — for BUY, oversold bounce gives most confidence
    if rsi <= 30:
        rsi_pts = 20
    elif rsi <= 40:
        rsi_pts = 15
    elif rsi <= 50:
        rsi_pts = 8
    elif rsi <= 60:
        rsi_pts = 3
    else:
        rsi_pts = 0
    pts["RSI position"] = rsi_pts

    # 4. MACD (15 pts)
    macd_pts = 0
    if macd > macd_signal:
        macd_pts += 8
    if macd_hist > 0:
        macd_pts += 7
    pts["MACD signal"] = min(macd_pts, 15)

    # 5. Volume confirmation (15 pts)
    if volume_ratio >= 2.0:
        vol_pts = 15
    elif volume_ratio >= 1.5:
        vol_pts = 10
    elif volume_ratio >= 1.0:
        vol_pts = 5
    else:
        vol_pts = 0
    pts["Volume"] = vol_pts

    # 6. Support proximity (10 pts)
    if close and support and close > 0:
        dist_pct = abs(close - support) / close * 100
        if dist_pct <= 1:
            sup_pts = 10
        elif dist_pct <= 3:
            sup_pts = 7
        elif dist_pct <= 5:
            sup_pts = 3
        else:
            sup_pts = 0
    else:
        sup_pts = 0
    pts["Support proximity"] = sup_pts

    return pts


def _score_sell(ind: dict) -> dict:
    close        = _safe(ind.get("close"))
    ema20        = _safe(ind.get("ema20"))
    ema50        = _safe(ind.get("ema50"))
    rsi          = _safe(ind.get("rsi"), 50)
    macd         = _safe(ind.get("macd"))
    macd_signal  = _safe(ind.get("macd_signal"))
    macd_hist    = _safe(ind.get("macd_hist"))
    volume_ratio = _safe(ind.get("volume_ratio"), 1.0)
    resistance   = _safe(ind.get("resistance"))
    trend        = ind.get("trend", "")

    pts = {}

    # 1. Trend alignment (25 pts) — SELL is stronger in downtrend
    pts["Trend alignment"] = 25 if trend == "DOWNTREND" else 10

    # 2. EMA stack (15 pts) — bearish: price < EMA20 < EMA50
    ema_pts = 0
    if close and ema20 and close < ema20:
        ema_pts += 8
    if ema20 and ema50 and ema20 < ema50:
        ema_pts += 7
    pts["EMA stack"] = min(ema_pts, 15)

    # 3. RSI — for SELL, overbought gives most confidence
    if rsi >= 75:
        rsi_pts = 20
    elif rsi >= 70:
        rsi_pts = 15
    elif rsi >= 60:
        rsi_pts = 8
    elif rsi >= 50:
        rsi_pts = 3
    else:
        rsi_pts = 0
    pts["RSI position"] = rsi_pts

    # 4. MACD (15 pts) — bearish crossover
    macd_pts = 0
    if macd < macd_signal:
        macd_pts += 8
    if macd_hist < 0:
        macd_pts += 7
    pts["MACD signal"] = min(macd_pts, 15)

    # 5. Volume (15 pts)
    if volume_ratio >= 2.0:
        vol_pts = 15
    elif volume_ratio >= 1.5:
        vol_pts = 10
    elif volume_ratio >= 1.0:
        vol_pts = 5
    else:
        vol_pts = 0
    pts["Volume"] = vol_pts

    # 6. Resistance proximity (10 pts)
    if close and resistance and close > 0:
        dist_pct = abs(close - resistance) / close * 100
        if dist_pct <= 1:
            res_pts = 10
        elif dist_pct <= 3:
            res_pts = 7
        elif dist_pct <= 5:
            res_pts = 3
        else:
            res_pts = 0
    else:
        res_pts = 0
    pts["Resistance proximity"] = res_pts

    return pts


def calculate_confidence(indicators: dict, signal_type: str) -> dict:
    """
    Returns a confidence dict:
      {
        "score": 72,
        "label": "High",
        "breakdown": {"Trend alignment": 25, "RSI position": 15, ...}
      }
    """
    sig = (signal_type or "").upper()

    if sig == "BUY":
        breakdown = _score_buy(indicators)
    elif sig in ("SELL", "EXIT"):
        breakdown = _score_sell(indicators)
    else:
        # No signal — return neutral
        return {"score": 0, "label": "N/A", "breakdown": {}}

    score = min(sum(breakdown.values()), 100)
    label = "High" if score >= 70 else "Medium" if score >= 50 else "Low"

    return {"score": score, "label": label, "breakdown": breakdown}


def parse_alert_prices(message: str) -> dict:
    """Extract structured price levels from the Claude alert text using regex."""
    prices: dict = {}

    m = re.search(r"Current price:\s*\$([0-9,]+\.?\d*)", message)
    if m:
        prices["current_price"] = float(m.group(1).replace(",", ""))

    m = re.search(r"Recommended Entry:\s*\$([0-9,]+\.?\d*)\s*[–\-]+\s*\$([0-9,]+\.?\d*)", message)
    if m:
        prices["entry_low"]  = float(m.group(1).replace(",", ""))
        prices["entry_high"] = float(m.group(2).replace(",", ""))

    m = re.search(r"Stop Loss:\s*\$([0-9,]+\.?\d*)", message)
    if m:
        prices["stop_loss"] = float(m.group(1).replace(",", ""))

    m = re.search(r"Take.Profit 1:\s*\$([0-9,]+\.?\d*)", message)
    if m:
        prices["take_profit_1"] = float(m.group(1).replace(",", ""))

    m = re.search(r"Take.Profit 2:\s*\$([0-9,]+\.?\d*)", message)
    if m:
        prices["take_profit_2"] = float(m.group(1).replace(",", ""))

    return prices
