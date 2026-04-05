from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    gemini_api_key: str          # Free — get at aistudio.google.com (no credit card)
    finnhub_api_key: str

    # Email notifications (optional — leave blank to disable)
    email_sender: str = ""
    email_password: str = ""      # Gmail App Password
    email_recipient: str = ""
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587

    # Scheduler
    scan_interval_minutes: int = 10

    # Default watchlist
    watchlist: List[str] = [
        "AAPL", "MSFT", "NVDA", "TSLA", "AMD",
        "GOOGL", "META", "AMZN", "SPY", "QQQ"
    ]

    class Config:
        env_file = ".env"


settings = Settings()
