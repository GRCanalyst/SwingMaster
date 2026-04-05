"""
Notification channels: console (always on) + email (optional).
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

log = logging.getLogger("notifier")


def notify_console(ticker: str, message: str) -> None:
    separator = "=" * 60
    print(f"\n{separator}")
    print(f"  SwingMaster Alert — {ticker}")
    print(separator)
    print(message)
    print(separator + "\n")


def notify_email(ticker: str, message: str) -> None:
    if not all([settings.email_sender, settings.email_password, settings.email_recipient]):
        log.debug("Email not configured — skipping email notification.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🚨 SwingMaster Alert — {ticker}"
        msg["From"] = settings.email_sender
        msg["To"] = settings.email_recipient

        # Plain-text version
        plain = MIMEText(message, "plain")

        # Simple HTML version (bold, monospace)
        html_body = message.replace("\n", "<br>").replace("**", "<strong>", 1)
        html_body = html_body.replace("**", "</strong>", 1)
        html_content = f"""
        <html><body style="font-family: monospace; background:#0a0b0e; color:#e2e8f0; padding:20px;">
        <h2 style="color:#10b981;">🚨 SwingMaster — {ticker}</h2>
        <pre style="white-space:pre-wrap;">{message}</pre>
        </body></html>
        """
        html = MIMEText(html_content, "html")
        msg.attach(plain)
        msg.attach(html)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.email_sender, settings.email_password)
            server.sendmail(settings.email_sender, settings.email_recipient, msg.as_string())

        log.info(f"Email alert sent for {ticker}.")
    except Exception as e:
        log.error(f"Email send failed for {ticker}: {e}")


def send_alert(ticker: str, message: str) -> None:
    """Send alert to all configured channels."""
    notify_console(ticker, message)
    notify_email(ticker, message)
