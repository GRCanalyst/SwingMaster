"""
FastAPI app — REST + WebSocket endpoints for the SwingMaster frontend.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

import pytz
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from database import init_db, get_alerts, get_stats
from scheduler import start_scheduler, run_scan, run_single, get_recent_alerts
from tools.market_data import get_real_time_quote

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s — %(message)s")
log = logging.getLogger("main")
ET = pytz.timezone("America/New_York")


# ─── WebSocket manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()
scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    init_db()               # ← create DB tables on startup
    log.info("Database initialised.")
    scheduler = start_scheduler()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="SwingMaster API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST: health / market ────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now(ET).isoformat()}


@app.get("/market-status")
def market_status():
    now = datetime.now(ET)
    is_open = now.weekday() < 5 and 9 * 60 + 30 <= now.hour * 60 + now.minute <= 16 * 60
    return {"is_open": is_open, "time_et": now.strftime("%I:%M %p ET"), "day": now.strftime("%A")}


# ─── REST: watchlist ──────────────────────────────────────────────────────────

@app.get("/watchlist")
def get_watchlist():
    return {"watchlist": settings.watchlist}


class WatchlistUpdate(BaseModel):
    tickers: list[str]


@app.post("/watchlist")
def update_watchlist(body: WatchlistUpdate):
    settings.watchlist = [t.upper().strip() for t in body.tickers if t.strip()]
    return {"watchlist": settings.watchlist}


# ─── REST: live alerts (in-memory) ───────────────────────────────────────────

@app.get("/alerts")
def live_alerts():
    return {"alerts": get_recent_alerts()}


# ─── REST: DB history ────────────────────────────────────────────────────────

@app.get("/alerts/history")
def alert_history(
    limit: int = 50,
    ticker: str | None = None,
    signal_type: str | None = None,
    only_trades: bool = False,
):
    """Paginated history from SQLite — survives server restarts."""
    rows = get_alerts(limit=limit, ticker=ticker, signal_type=signal_type, only_trades=only_trades)
    return {"alerts": rows, "count": len(rows)}


@app.get("/alerts/stats")
def alert_stats():
    """Aggregate stats: counts, avg confidence, top ticker."""
    return get_stats()


# ─── REST: quotes ────────────────────────────────────────────────────────────

@app.get("/quote/{ticker}")
def quote(ticker: str):
    return get_real_time_quote(ticker.upper())


# ─── REST: scanning ──────────────────────────────────────────────────────────

@app.post("/scan")
async def manual_scan(background_tasks: BackgroundTasks):
    async def _run():
        new_alerts = await asyncio.to_thread(run_scan, "manual")
        for alert in new_alerts:
            await manager.broadcast({"type": "alert", "data": alert})
    background_tasks.add_task(_run)
    return {"message": "Scan started — results pushed via WebSocket."}


@app.post("/analyze/{ticker}")
async def analyze(ticker: str):
    """Analyze a single ticker on demand (also saves to DB)."""
    try:
        record = await asyncio.to_thread(run_single, ticker.upper(), "user")
        if record["is_alert"]:
            await manager.broadcast({"type": "alert", "data": record})
        return record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    log.info("WebSocket client connected.")
    try:
        await ws.send_json({"type": "history", "data": get_recent_alerts()})
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
        log.info("WebSocket client disconnected.")
