"""
SwingMaster AI agent — powered by Google Gemini 2.0 Flash (free tier).
Uses function calling to fetch market data and news, analyzes swing setups,
calculates confidence scores, and logs every alert to SQLite.
"""

import json
import os
from google import genai
from google.genai.types import (
    GenerateContentConfig, Tool, FunctionDeclaration, Schema, Type, Part
)

from tools.market_data import get_real_time_quote, get_recent_news
from tools.indicators import calculate_indicators
from confidence import calculate_confidence, parse_alert_prices
from database import save_alert
from config import settings

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
    chat = client.chats.create(model="gemini-2.0-flash", config=_CONFIG)
    response = chat.send_message(f"Analyze {ticker} for a swing trade setup right now.")

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
        response = chat.send_message(fn_responses)

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
        import logging
        logging.getLogger("agent").error(f"DB save failed for {ticker}: {e}")

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
    """Scan a list of tickers and return all results."""
    results = []
    for ticker in tickers:
        try:
            result = analyze_ticker(ticker, triggered_by=triggered_by)
            results.append(result)
        except Exception as e:
            results.append({
                "ticker": ticker,
                "is_alert": False,
                "message": f"Error analyzing {ticker}: {e}",
                "signal_type": "NONE",
                "confidence": {"score": 0, "label": "N/A", "breakdown": {}},
                "indicators": {},
                "prices": {},
                "db_id": None,
            })
    return results
