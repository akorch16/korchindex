"""The 'brokerage price feed adapter': one quote per call from Yahoo Finance's
public chart endpoint. Sync httpx with a hard timeout (the old Node script had
none — a hung request stalled the whole run)."""
import datetime

import httpx

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) korchindex-price-updater"
TIMEOUT = 10.0

# Yahoo symbol format: class shares use '-' (BRK.B -> BRK-B)
to_yahoo = lambda t: t.strip().replace(".", "-")


def fetch_quote(ticker: str) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{to_yahoo(ticker)}"
    resp = httpx.get(
        url,
        params={"interval": "1d", "range": "5d"},
        headers={"User-Agent": USER_AGENT},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    meta = (resp.json().get("chart", {}).get("result") or [{}])[0].get("meta", {})
    price = meta.get("regularMarketPrice")
    if not isinstance(price, (int, float)):
        raise ValueError(f"no price data for {ticker}")
    quote_date = datetime.datetime.fromtimestamp(
        meta.get("regularMarketTime", 0), tz=datetime.timezone.utc
    ).date()
    return {"price": float(price), "date": quote_date}
