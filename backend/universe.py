"""
Dynamic stock universe — S&P 500 + S&P MidCap 400 (~900 stocks).

Together these two indices approximate the Russell 1000 (top 1,000 US stocks
by market cap) and cover large + mid-cap stocks where the best swing setups form.

Data is fetched from Wikipedia once per day and cached in memory.
If the fetch fails for any reason, a hardcoded fallback of ~250 liquid stocks
keeps the app running without interruption.
"""

import logging
from datetime import datetime, timedelta

import pandas as pd

log = logging.getLogger("universe")

CACHE_HOURS = 24   # re-fetch daily

_cache: dict = {"tickers": [], "fetched_at": None, "sp500_count": 0, "sp400_count": 0}


# ── Fetchers ──────────────────────────────────────────────────────────────────

def _clean(tickers: list[str]) -> list[str]:
    """Normalise ticker symbols for yfinance (BRK.B → BRK-B)."""
    return [str(t).replace(".", "-").strip().upper() for t in tickers if t and str(t).strip()]


def _fetch_sp500() -> list[str]:
    try:
        df = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")[0]
        tickers = _clean(df["Symbol"].dropna().tolist())
        log.info(f"S&P 500 fetched: {len(tickers)} tickers")
        return tickers
    except Exception as e:
        log.warning(f"S&P 500 fetch failed: {e}")
        return []


def _fetch_sp400() -> list[str]:
    try:
        df = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_400_companies")[0]
        # Column name varies — try common names
        col = next((c for c in df.columns if "ticker" in c.lower() or "symbol" in c.lower()), df.columns[0])
        tickers = _clean(df[col].dropna().tolist())
        log.info(f"S&P MidCap 400 fetched: {len(tickers)} tickers")
        return tickers
    except Exception as e:
        log.warning(f"S&P MidCap 400 fetch failed: {e}")
        return []


# ── Public API ────────────────────────────────────────────────────────────────

def refresh_universe(force: bool = False) -> list[str]:
    """
    Fetch fresh S&P 500 + S&P 400 data from Wikipedia.
    Returns the combined deduplicated list and updates the cache.
    Falls back to FALLBACK_UNIVERSE if both fetches fail.
    """
    global _cache

    now = datetime.now()
    if not force and _cache["fetched_at"] and (now - _cache["fetched_at"]) < timedelta(hours=CACHE_HOURS):
        return _cache["tickers"]

    log.info("Refreshing universe from Wikipedia (S&P 500 + S&P MidCap 400)…")
    sp500 = _fetch_sp500()
    sp400 = _fetch_sp400()

    combined = list(dict.fromkeys(sp500 + sp400))   # deduplicate, S&P 500 first

    if len(combined) < 200:
        log.warning(f"Only {len(combined)} tickers fetched — using fallback universe")
        combined = FALLBACK_UNIVERSE
        sp500_count = len([t for t in combined if t in set(FALLBACK_SP500)])
        sp400_count = len(combined) - sp500_count
    else:
        sp500_count = len(sp500)
        sp400_count = len(sp400)

    _cache = {
        "tickers":     combined,
        "fetched_at":  now,
        "sp500_count": sp500_count,
        "sp400_count": sp400_count,
    }
    log.info(f"Universe ready: {len(combined)} stocks (S&P500={sp500_count}, MidCap400={sp400_count})")
    return combined


def get_universe() -> list[str]:
    """Return cached universe, refreshing if stale or empty."""
    if not _cache["tickers"]:
        return refresh_universe()
    return refresh_universe()   # refresh handles TTL check internally


def get_universe_meta() -> dict:
    """Return metadata about the current universe for the API."""
    tickers = get_universe()
    return {
        "total":        len(tickers),
        "sp500_count":  _cache.get("sp500_count", 0),
        "sp400_count":  _cache.get("sp400_count", 0),
        "fetched_at":   _cache["fetched_at"].isoformat() if _cache.get("fetched_at") else None,
        "source":       "S&P 500 + S&P MidCap 400 (Wikipedia)",
        "note":         "Combined ≈ Russell 1000 large+mid cap coverage",
    }


# ── Fallback hardcoded universe (~250 stocks) ─────────────────────────────────
# Used when Wikipedia is unreachable. Covers the most liquid US stocks.

FALLBACK_SP500 = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","AVGO","JPM",
    "LLY","V","UNH","XOM","MA","JNJ","PG","HD","COST","MRK","ABBV","CVX",
    "CRM","BAC","NFLX","AMD","KO","PEP","TMO","CSCO","ACN","WMT","MCD","ABT",
    "CAT","ADBE","GE","TXN","DHR","LIN","VZ","PM","NEE","CMCSA","INTU","RTX",
    "IBM","QCOM","LOW","UPS","AMGN","HON","GS","MS","BLK","SPGI","BKNG",
    "DE","SBUX","C","AXP","NOW","ISRG","ELV","MDT","SYK","PLD","ADI","GILD",
    "MMC","VRTX","TJX","REGN","BSX","CB","PGR","SO","DUK","AON","ZTS","ETN",
    "SHW","PANW","MO","CI","ICE","USB","KLAC","AMAT","LRCX","MCHP","ON",
]

FALLBACK_MIDCAP = [
    "COIN","PLTR","MSTR","DKNG","HOOD","SOFI","AFRM","RIVN","LCID","RBLX",
    "SNAP","PINS","LYFT","GRAB","SE","MELI","BILL","UPST","OPEN","COUR",
    "ENPH","FSLR","SEDG","RUN","NOVA","BE","PLUG","BLNK",
    "SMCI","NVAX","MRNA","BNTX","CRSP","BEAM","EDIT","NTLA",
    "XPO","CHRW","EXPD","JBHT","SAIA","ODFL","WERN",
    "MGM","WYNN","LVS","PENN","DKNG","CZR","BYD",
    "Z","OPEN","RDFN","COMP","HXL","CW","KTOS","RKLB",
]

FALLBACK_ETFS = [
    "SPY","QQQ","IWM","DIA","XLK","XLF","XLE","XLV","XLI","XLY",
    "XLP","XLU","XLB","XLRE","GLD","SLV","USO","TLT","HYG",
]

FALLBACK_UNIVERSE: list[str] = list(dict.fromkeys(
    FALLBACK_SP500 + FALLBACK_MIDCAP + FALLBACK_ETFS
))

# Legacy aliases kept for any existing imports
UNIVERSE   = FALLBACK_UNIVERSE
SECTOR_MAP = {
    "S&P 500 (fallback)":    FALLBACK_SP500,
    "Mid-Cap (fallback)":    FALLBACK_MIDCAP,
    "ETFs":                  FALLBACK_ETFS,
}
