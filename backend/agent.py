"""
SwingMaster AI agent — powered by Google Gemini 2.0 Flash (free tier).
Uses function calling to fetch market data and news, analyzes swing setups,
calculates confidence scores, and logs every alert to SQLite.
"""

import json
import logging
import os
import time

from google import genai
from google.genai.types import (
    GenerateContentConfig, Tool, FunctionDeclaration, Schema, Type, Part
)

from tools.market_data import get_real_time_quote, get_recent_news
from tools.indicators import calculate_indicators
from confidence import calculate_confidence, parse_alert_prices
from database import save_alert
from config import settings

_log = logging.getLogger("agent")

# Gemini free tier: 15 req/min, 1500 req/day
# Keep ≥5 s between calls to stay under the per-minute cap
_MIN_CALL_GAP = 2.5   # seconds (2.5 Flash-Lite: 30 RPM free tier)
_last_call_ts: float = 0.0

# When the daily quota is hit we stop all AI calls until the next calendar day
_daily_quota_exhausted: bool = False
_quota_exhausted_date: str = ""


class DailyQuotaExhausted(RuntimeError):
    """Raised when Gemini's daily free-tier quota is used up."""


def _is_daily_quota_error(err: str) -> bool:
    """Distinguish per-day exhaustion from per-minute throttling."""
    return (
        "PerDay" in err
        or "GenerateRequestsPerDayPerProject" in err
        or 'limit: 0' in err
    )


def _gemini_send(chat, message, max_retries: int = 3):
    """Send a message to Gemini with rate-limiting and 429 retry-backoff.

    - Per-minute throttle: retries up to max_retries times with exponential backoff.
    - Daily quota exhausted: raises DailyQuotaExhausted immediately (no retries).
    """
    global _last_call_ts, _daily_quota_exhausted, _quota_exhausted_date

    # Fast-fail if we already know today's quota is gone
    today = time.strftime("%Y-%m-%d")
    if _daily_quota_exhausted and _quota_exhausted_date == today:
        raise DailyQuotaExhausted("Gemini daily quota exhausted — resumes tomorrow.")

    for attempt in range(max_retries):
        gap = time.monotonic() - _last_call_ts
        if gap < _MIN_CALL_GAP:
            time.sleep(_MIN_CALL_GAP - gap)

        try:
            _last_call_ts = time.monotonic()
            return chat.send_message(message)
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                if _is_daily_quota_error(err):
                    _daily_quota_exhausted = True
                    _quota_exhausted_date = today
                    _log.error("Gemini daily quota exhausted — AI analysis paused until tomorrow.")
                    raise DailyQuotaExhausted("Gemini daily quota exhausted — resumes tomorrow.")
                # Per-minute throttle — back off and retry
                wait = _MIN_CALL_GAP * (2 ** attempt)   # 5s, 10s, 20s
                _log.warning(f"Gemini rate-limited — waiting {wait:.0f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Gemini still rate-limited after {max_retries} retries — skipping ticker.")

# ─── Load system prompt ───────────────────────────────────────────────────────
_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "system_prompt.txt")
with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read()

# ─── Gemini client ────────────────────────────────────────────────────────────
client = genai.Client(api_key=settings.gemini_api_key)

# ─── Tool declarations ────────────────────────────────────────────────────────
_TOOLS = Tool(function_declarations=[
    FunctionDeclaration(
        name="get_market_data",
        description=(
            "Get real-time price quote and full technical indicator suite for a US stock ticker. "
            "Returns current price, EMAs (20/50/200), RSI(14), MACD, support, resistance, volume, and trend direction."
        ),
        parameters=Schema(
            type=Type.OBJECT,
            properties={
                "ticker": Schema(type=Type.STRING, description="US stock ticker symbol, e.g. AAPL, NVDA, SPY")
            },
            required=["ticker"],
        ),
    ),
    FunctionDeclaration(
        name="get_news",
        description=(
            "Fetch company news headlines from the last 48 hours for a ticker. "
            "Use this to check for earnings, FDA decisions, lawsuits, or major announcements "
            "that could invalidate or support a technical setup."
        ),
        parameters=Schema(
            type=Type.OBJECT,
            properties={
                "ticker": Schema(type=Type.STRING, description="US stock ticker symbol")
            },
            required=["ticker"],
        ),
    ),
])

_CONFIG = GenerateContentConfig(
    system_instruction=SYSTEM_PROMPT,
    tools=[_TOOLS],
    temperature=0.2,
)


def analyze_ticker(ticker: str, triggered_by: str = "scheduler") -> dict:
    """
    Run SwingMaster AI on a single ticker.

    Returns a dict:
      {
        "ticker": str,
        "is_alert": bool,
        "message": str,
        "signal_type": str,
        "confidence": {score, label, breakdown},
        "indicators": dict,
        "prices": dict,
        "db_id": int | None,
      }
    """
    captured_indicators: dict = {}

    def _execute_tool(name: str, args: dict) -> str:
        if name == "get_market_data":
            t = args["ticker"]
            quote = get_real_time_quote(t)
            indicators = calculate_indicators(t)
            combined = {**quote, **indicators}
            captured_indicators.update(combined)   # ← capture for confidence scoring
            return json.dumps(combined, default=str)
        if name == "get_news":
            news = get_recent_news(args["ticker"])
            return json.dumps(news, default=str)
        return json.dumps({"error": f"Unknown tool: {name}"})

    # ── Gemini agentic loop ───────────────────────────────────────────────────
    chat = client.chats.create(model="gemini-2.5-flash-lite", config=_CONFIG)
    response = _gemini_send(chat, f"Analyze {ticker} for a swing trade setup right now.")

    for _ in range(5):
        parts = response.candidates[0].content.parts
        fn_calls = [p for p in parts if p.function_call and p.function_call.name]
        if not fn_calls:
            break
        fn_responses = [
            Part.from_function_response(
                name=p.function_call.name,
                response={"result": _execute_tool(p.function_call.name, dict(p.function_call.args))},
            )
            for p in fn_calls
        ]
        response = _gemini_send(chat, fn_responses)

    message = response.text.strip() if response.text else ""

    # ── Determine signal type ─────────────────────────────────────────────────
    is_alert = "SWING TRADE ALERT" in message
    if "BUY" in message and is_alert:
        signal_type = "BUY"
    elif ("SELL" in message or "EXIT" in message) and is_alert:
        signal_type = "SELL" if "SELL" in message else "EXIT"
    else:
        signal_type = "NONE"

    # ── Confidence score ──────────────────────────────────────────────────────
    confidence = calculate_confidence(captured_indicators, signal_type)

    # ── Parse price levels from alert text ────────────────────────────────────
    prices = parse_alert_prices(message) if is_alert else {}

    # ── Save to database ──────────────────────────────────────────────────────
    db_id = None
    try:
        db_id = save_alert(
            ticker=ticker,
            signal_type=signal_type,
            message=message,
            confidence=confidence,
            indicators=captured_indicators,
            prices=prices,
            triggered_by=triggered_by,
        )
    except Exception as e:
        _log.error(f"DB save failed for {ticker}: {e}")

    return {
        "ticker": ticker,
        "is_alert": is_alert,
        "message": message,
        "signal_type": signal_type,
        "confidence": confidence,
        "indicators": captured_indicators,
        "prices": prices,
        "db_id": db_id,
    }


def scan_watchlist(tickers: list[str], triggered_by: str = "scheduler") -> list[dict]:
    """Scan a list of tickers. Stops early if daily quota is exhausted."""
    results = []
    for ticker in tickers:
        try:
            result = analyze_ticker(ticker, triggered_by=triggered_by)
            results.append(result)
        except DailyQuotaExhausted as e:
            _log.warning(f"Daily quota hit at {ticker} — stopping scan early.")
            results.append(_quota_skip(ticker, str(e)))
            break   # no point trying remaining tickers
        except Exception as e:
            results.append(_quota_skip(ticker, f"Error: {e}"))
    return results


def _quota_skip(ticker: str, reason: str) -> dict:
    return {
        "ticker": ticker,
        "is_alert": False,
        "message": reason,
        "signal_type": "NONE",
        "confidence": {"score": 0, "label": "N/A", "breakdown": {}},
        "indicators": {},
        "prices": {},
        "db_id": None,
    }
