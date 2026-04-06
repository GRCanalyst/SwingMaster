"""
Stock universe for PreFilter Master — ~250 liquid US stocks across all major sectors.
All stocks here meet baseline criteria: large/mid cap, high liquidity, price $5–$300.

Organised by sector so you can easily add/remove whole groups.
The prefilter then narrows this down to the top 5–10 setups each scan.
"""

TECH = [
    "AAPL", "MSFT", "NVDA", "AMD", "INTC", "QCOM", "AVGO", "MU", "AMAT", "LRCX",
    "KLAC", "TXN", "ADI", "MCHP", "SWKS", "ON", "MPWR", "ENPH", "FSLR",
    "GOOGL", "META", "AMZN", "NFLX", "SNAP", "PINS", "RBLX", "UBER", "LYFT",
    "CRM", "NOW", "SNOW", "DDOG", "ZS", "CRWD", "PANW", "FTNT", "NET",
    "ORCL", "IBM", "HPQ", "DELL", "ANET", "CSCO", "JNPR",
    "PYPL", "SQ", "AFRM", "SOFI", "HOOD",
    "TSLA", "RIVN", "LCID",
]

FINANCE = [
    "JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", "SCHW", "AXP",
    "V", "MA", "COF", "DFS", "SYF", "ALLY",
    "USB", "PNC", "TFC", "MTB", "FITB", "KEY", "RF",
    "MET", "PRU", "AFL", "AIG", "HIG", "CB", "TRV",
    "ICE", "CME", "CBOE", "NDAQ",
]

HEALTHCARE = [
    "JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "BMY", "AMGN", "GILD", "BIIB",
    "REGN", "VRTX", "MRNA", "BNTX",
    "ABT", "MDT", "SYK", "BSX", "EW", "ISRG", "ZBH", "BAX",
    "CVS", "CI", "HUM", "MOH", "CNC",
    "TMO", "DHR", "A", "IQV", "IQVIA",
]

ENERGY = [
    "XOM", "CVX", "COP", "EOG", "PXD", "DVN", "MPC", "PSX", "VLO",
    "OXY", "HES", "HAL", "SLB", "BKR", "NOV",
    "LNG", "KMI", "WMB", "ET", "TRGP",
]

CONSUMER = [
    "WMT", "COST", "TGT", "HD", "LOW", "AMZN",
    "MCD", "SBUX", "CMG", "YUM", "DRI", "QSR",
    "NKE", "PVH", "RL", "TPR", "CPRI",
    "BKNG", "EXPE", "ABNB", "MAR", "HLT", "H", "MGM", "WYNN", "LVS",
    "DIS", "PARA", "WBD", "CMCSA", "NFLX",
    "PG", "KO", "PEP", "MDLZ", "GIS", "K", "CPB", "MKC",
    "PM", "MO", "BTI",
]

INDUSTRIALS = [
    "BA", "LMT", "RTX", "NOC", "GD", "HII", "TDG",
    "GE", "HON", "MMM", "EMR", "ETN", "ROK", "PH", "ITW", "AME",
    "CAT", "DE", "PCAR", "CMI",
    "UPS", "FDX", "XPO", "CHRW", "EXPD",
    "LIN", "APD", "ECL", "PPG", "SHW",
]

REAL_ESTATE_UTILITIES = [
    "AMT", "PLD", "EQIX", "SPG", "O", "VICI", "WELL",
    "NEE", "DUK", "SO", "D", "AEP", "EXC", "PCG",
]

POPULAR_SWING = [
    "COIN", "MSTR", "PLTR", "SOFI", "HOOD", "SMCI",
    "MELI", "SE", "GRAB", "DKNG", "PENN",
    "ARKK", "ARKG",
]

ETFS = [
    "SPY", "QQQ", "IWM", "DIA",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE",
    "GLD", "SLV", "USO",
    "TLT", "HYG", "LQD",
]

# ── Full universe ──────────────────────────────────────────────────────────────
UNIVERSE: list[str] = list(dict.fromkeys(
    TECH + FINANCE + HEALTHCARE + ENERGY + CONSUMER +
    INDUSTRIALS + REAL_ESTATE_UTILITIES + POPULAR_SWING + ETFS
))

SECTOR_MAP: dict[str, list[str]] = {
    "Technology":    TECH,
    "Finance":       FINANCE,
    "Healthcare":    HEALTHCARE,
    "Energy":        ENERGY,
    "Consumer":      CONSUMER,
    "Industrials":   INDUSTRIALS,
    "RE/Utilities":  REAL_ESTATE_UTILITIES,
    "Swing Favs":    POPULAR_SWING,
    "ETFs":          ETFS,
}
