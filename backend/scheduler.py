"""
APScheduler — scans watchlist every N minutes during US market hours.
Market hours: 9:30 AM – 4:00 PM ET, Monday–Friday.
"""

import logging
from datetime import datetime, time
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from agent import scan_watchlist
from notifier import send_alert
from config import settings

log = logging.getLogger("scheduler")
ET = pytz.timezone("America/New_York")

_active_alerts: list[dict] = []   # In-memory store for WebSocket push


def _is_market_open() -> bool:
    now_et = datetime.now(ET)
    if now_et.weekday() >= 5:
        return False
    return time(9, 30) <= now_et.time() <= time(16, 0)


def _build_alert_record(result: dict) -> dict:
    """Convert agent result into the standard alert record pushed to frontend."""
    return {
        "ticker": result["ticker"],
        "message": result["message"],
        "signal_type": result.get("signal_type", "NONE"),
        "is_alert": result["is_alert"],
        "confidence_score": result.get("confidence", {}).get("score"),
        "confidence_label": result.get("confidence", {}).get("label"),
        "confidence_breakdown": result.get("confidence", {}).get("breakdown", {}),
        "prices": result.get("prices", {}),
        "db_id": result.get("db_id"),
        "timestamp": datetime.now(ET).isoformat(),
    }


def run_scan(triggered_by: str = "scheduler") -> list[dict]:
    """Run a full watchlist scan. Returns list of alert records (trade signals only)."""
    if not _is_market_open():
        log.info("Market is closed. Skipping scan.")
        return []

    log.info(f"Scanning {len(settings.watchlist)} tickers: {settings.watchlist}")
    results = scan_watchlist(settings.watchlist, triggered_by=triggered_by)
    new_alerts = []

    for result in results:
        record = _build_alert_record(result)
        _active_alerts.insert(0, record)
        if result["is_alert"]:
            send_alert(result["ticker"], result["message"])
            new_alerts.append(record)

    # Keep last 100 in memory
    if len(_active_alerts) > 100:
        _active_alerts[:] = _active_alerts[:100]

    return new_alerts


def run_single(ticker: str, triggered_by: str = "manual") -> dict:
    """Analyze a single ticker on demand."""
    from agent import analyze_ticker
    result = analyze_ticker(ticker, triggered_by=triggered_by)
    record = _build_alert_record(result)
    _active_alerts.insert(0, record)
    if len(_active_alerts) > 100:
        _active_alerts[:] = _active_alerts[:100]
    if result["is_alert"]:
        send_alert(ticker, result["message"])
    return record


def get_recent_alerts() -> list[dict]:
    return _active_alerts


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=ET)
    scheduler.add_job(
        run_scan,
        trigger="interval",
        minutes=settings.scan_interval_minutes,
        id="watchlist_scan",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    log.info(f"Scheduler started — every {settings.scan_interval_minutes} min during market hours.")
    return scheduler
