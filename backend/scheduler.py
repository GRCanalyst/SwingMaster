"""
APScheduler — two-stage scan pipeline during US market hours.

Stage 1 — PreFilter Master (Python, no AI):
    Scans ~250 stocks, applies 5 rule layers, returns top 5–10 candidates.

Stage 2 — SwingMaster AI (Gemini):
    Deep-analyses each candidate + user's personal watchlist.
    Sends structured alerts to frontend via WebSocket and email.
"""

import logging
from datetime import datetime, time
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from agent import scan_watchlist, analyze_ticker
from prefilter import run_prefilter
from notifier import send_alert
from config import settings

log = logging.getLogger("scheduler")
ET  = pytz.timezone("America/New_York")

_active_alerts:    list[dict] = []   # in-memory alert feed (WebSocket)
_last_prefilter:   dict       = {}   # last prefilter result (for UI display)


def _is_market_open() -> bool:
    now = datetime.now(ET)
    if now.weekday() >= 5:
        return False
    return time(9, 30) <= now.time() <= time(16, 0)


def _build_alert_record(result: dict) -> dict:
    return {
        "ticker":               result["ticker"],
        "message":              result["message"],
        "signal_type":          result.get("signal_type", "NONE"),
        "is_alert":             result["is_alert"],
        "confidence_score":     result.get("confidence", {}).get("score"),
        "confidence_label":     result.get("confidence", {}).get("label"),
        "confidence_breakdown": result.get("confidence", {}).get("breakdown", {}),
        "prices":               result.get("prices", {}),
        "db_id":                result.get("db_id"),
        "timestamp":            datetime.now(ET).isoformat(),
    }


def _push_record(record: dict) -> None:
    _active_alerts.insert(0, record)
    if len(_active_alerts) > 100:
        _active_alerts[:] = _active_alerts[:100]


# ── Stage 1: PreFilter ────────────────────────────────────────────────────────

def run_prefilter_stage() -> list[str]:
    """
    Run PreFilter Master over the full universe.
    Returns tickers that passed (will be deep-analysed by Stage 2).
    Caches result in _last_prefilter for the UI.
    """
    global _last_prefilter
    log.info("Stage 1 — PreFilter Master scanning universe…")
    result = run_prefilter()
    _last_prefilter = result

    candidates = [c["ticker"] for c in result.get("candidates", [])]
    log.info(
        f"PreFilter: scanned {result['total_scanned']}, "
        f"passed {result['passed_filter']}, "
        f"top candidates: {candidates}"
    )
    return candidates


def get_last_prefilter() -> dict:
    return _last_prefilter


# ── Stage 2: Deep Analysis ────────────────────────────────────────────────────

def run_scan(triggered_by: str = "scheduler") -> list[dict]:
    """
    Full two-stage scan:
      1. PreFilter → top N candidates from universe
      2. Merge with personal watchlist (deduplicated)
      3. SwingMaster AI deep-analyses merged list
      4. Alerts fired for high-confidence setups
    """
    if not _is_market_open():
        log.info("Market closed — skipping scan.")
        return []

    # Stage 1
    prefilter_tickers = run_prefilter_stage()

    # Merge with personal watchlist (watchlist always included)
    watchlist = settings.watchlist
    merged = list(dict.fromkeys(prefilter_tickers + watchlist))  # prefilter first, dedup
    log.info(f"Stage 2 — Analysing {len(merged)} tickers: {merged}")

    # Stage 2
    results  = scan_watchlist(merged, triggered_by=triggered_by)
    new_alerts = []

    for result in results:
        record = _build_alert_record(result)
        _push_record(record)
        if result["is_alert"]:
            send_alert(result["ticker"], result["message"])
            new_alerts.append(record)

    log.info(f"Scan complete — {len(new_alerts)} alerts fired.")
    return new_alerts


def run_single(ticker: str, triggered_by: str = "manual") -> dict:
    """Analyse a single ticker on demand (bypasses prefilter)."""
    result = analyze_ticker(ticker.upper(), triggered_by=triggered_by)
    record = _build_alert_record(result)
    _push_record(record)
    if result["is_alert"]:
        send_alert(ticker, result["message"])
    return record


def get_recent_alerts() -> list[dict]:
    return _active_alerts


# ── Scheduler ─────────────────────────────────────────────────────────────────

def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=ET)
    scheduler.add_job(
        run_scan,
        trigger="interval",
        minutes=settings.scan_interval_minutes,
        id="full_scan",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    log.info(f"Scheduler started — every {settings.scan_interval_minutes} min during market hours.")
    return scheduler
