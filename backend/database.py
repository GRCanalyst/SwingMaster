"""
SQLite database — logs every alert sent with confidence scores and price levels.
Zero dependencies: uses Python's built-in sqlite3.
Database file: backend/swingmaster.db (auto-created on first run)
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "swingmaster.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # rows behave like dicts
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker           TEXT    NOT NULL,
                signal_type      TEXT,                        -- BUY | SELL | EXIT | NONE
                message          TEXT    NOT NULL,
                confidence_score REAL,                        -- 0–100
                confidence_label TEXT,                        -- High | Medium | Low
                confidence_breakdown TEXT,                    -- JSON {factor: score}
                current_price    REAL,
                entry_low        REAL,
                entry_high       REAL,
                stop_loss        REAL,
                take_profit_1    REAL,
                take_profit_2    REAL,
                rsi              REAL,
                trend            TEXT,
                triggered_by     TEXT    DEFAULT 'scheduler', -- scheduler | manual | user
                timestamp        TEXT    NOT NULL
            )
        """)
        # Performance tracking — updated later when trade closes
        conn.execute("""
            CREATE TABLE IF NOT EXISTS performance (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id    INTEGER REFERENCES alerts(id),
                result      TEXT,    -- TP1_HIT | TP2_HIT | STOPPED_OUT | OPEN | EXPIRED
                exit_price  REAL,
                pnl_pct     REAL,    -- actual % gain/loss
                closed_at   TEXT
            )
        """)
        conn.commit()


def save_alert(
    ticker: str,
    signal_type: str,
    message: str,
    confidence: dict,          # {score, label, breakdown}
    indicators: dict,          # raw indicator dict from tools
    prices: dict,              # {current_price, entry_low, entry_high, stop_loss, tp1, tp2}
    triggered_by: str = "scheduler",
) -> int:
    """Insert a new alert row. Returns the new row id."""
    with _conn() as conn:
        cur = conn.execute("""
            INSERT INTO alerts (
                ticker, signal_type, message,
                confidence_score, confidence_label, confidence_breakdown,
                current_price, entry_low, entry_high, stop_loss, take_profit_1, take_profit_2,
                rsi, trend, triggered_by, timestamp
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            ticker,
            signal_type,
            message,
            confidence.get("score"),
            confidence.get("label"),
            json.dumps(confidence.get("breakdown", {})),
            prices.get("current_price"),
            prices.get("entry_low"),
            prices.get("entry_high"),
            prices.get("stop_loss"),
            prices.get("take_profit_1"),
            prices.get("take_profit_2"),
            indicators.get("rsi"),
            indicators.get("trend"),
            triggered_by,
            datetime.utcnow().isoformat(),
        ))
        conn.commit()
        return cur.lastrowid


def get_alerts(
    limit: int = 50,
    ticker: str | None = None,
    signal_type: str | None = None,
    only_trades: bool = False,
) -> list[dict]:
    """Fetch recent alerts from DB, newest first."""
    sql = "SELECT * FROM alerts WHERE 1=1"
    params: list = []
    if ticker:
        sql += " AND ticker = ?"
        params.append(ticker.upper())
    if signal_type:
        sql += " AND signal_type = ?"
        params.append(signal_type.upper())
    if only_trades:
        sql += " AND signal_type IN ('BUY','SELL','EXIT')"
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with _conn() as conn:
        rows = conn.execute(sql, params).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        if d.get("confidence_breakdown"):
            try:
                d["confidence_breakdown"] = json.loads(d["confidence_breakdown"])
            except Exception:
                d["confidence_breakdown"] = {}
        result.append(d)
    return result


def get_stats() -> dict:
    """Aggregate stats for the dashboard."""
    with _conn() as conn:
        total      = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
        trades     = conn.execute("SELECT COUNT(*) FROM alerts WHERE signal_type IN ('BUY','SELL','EXIT')").fetchone()[0]
        buys       = conn.execute("SELECT COUNT(*) FROM alerts WHERE signal_type='BUY'").fetchone()[0]
        sells      = conn.execute("SELECT COUNT(*) FROM alerts WHERE signal_type IN ('SELL','EXIT')").fetchone()[0]
        avg_conf   = conn.execute("SELECT AVG(confidence_score) FROM alerts WHERE signal_type IN ('BUY','SELL','EXIT')").fetchone()[0]
        high_conf  = conn.execute("SELECT COUNT(*) FROM alerts WHERE confidence_label='High'").fetchone()[0]
        top_ticker = conn.execute(
            "SELECT ticker, COUNT(*) as c FROM alerts WHERE signal_type IN ('BUY','SELL','EXIT') GROUP BY ticker ORDER BY c DESC LIMIT 1"
        ).fetchone()

    return {
        "total_scans": total,
        "total_trades": trades,
        "buy_alerts": buys,
        "sell_alerts": sells,
        "avg_confidence": round(avg_conf, 1) if avg_conf else 0,
        "high_confidence_alerts": high_conf,
        "top_ticker": top_ticker["ticker"] if top_ticker else None,
    }
