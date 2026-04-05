# SwingMaster AI — Setup Guide

## Get your free API keys (5 minutes)

### 1. Google Gemini API Key (FREE — no credit card)
- Go to **aistudio.google.com** → click **Get API Key** → Create API key
- Copy the `AIza...` key
- Free tier: 15 requests/minute, 1,500 requests/day — more than enough

### 2. Finnhub API Key (free, no card)
- Go to finnhub.io → Sign Up (free)
- Dashboard → API Key → copy it

### 3. Gmail App Password (for email alerts, optional)
- Google Account → Security → 2-Step Verification → App Passwords
- Generate a password for "Mail" — use this (NOT your regular Gmail password)

---

## Backend Setup

```bash
cd backend

# 1. Copy env file
cp .env.example .env
# Fill in your API keys in .env

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

---

## Frontend Setup

```bash
cd frontend

# 1. Copy env
cp .env.local.example .env.local

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Frontend runs at: http://localhost:3000

---

## How it works

1. The backend scans your watchlist every 10 minutes during US market hours (9:30 AM – 4:00 PM ET)
2. For each ticker, Claude fetches live price + indicators + recent news
3. If a high-confidence swing setup is found, an alert is generated
4. Alerts are pushed to the frontend in real-time via WebSocket
5. Email notification is sent (if configured)

## Manual scan
- Click **Scan Now** in the top-right of the UI
- Or hit the ⚡ icon next to any ticker in the watchlist

## Customize
- Add/remove tickers directly in the Watchlist panel (UI auto-saves)
- Change scan interval: edit `SCAN_INTERVAL_MINUTES` in `.env`
- Change risk rules: edit `backend/system_prompt.txt`
