"""Pump-and-dump RISK-CONTEXT screener (Python).

Pulls the momentum board (GET /v1/watchlist?status=momentum) and, for each
ticker, the public-domain SEC-EDGAR intelligence (GET /v1/edgar/:ticker). It
surfaces FACTUAL dilution / financial-health context from SEC filings so you
can do your own due diligence on a name that is moving.

IMPORTANT -- this is research context, NOT financial advice and NOT a
buy/sell/avoid signal. High dilution is NOT inherently bearish; companies raise
capital for many reasons. We only show what was FILED with the SEC. Do your own
research.

Run:  python pump_and_dump_screener.py
"""
from __future__ import annotations

import re
import sys

from bullalert_client import BullAlertClient, BullAlertError, load_dotenv

# SEC 8-K disclosure flags worth reading before chasing a mover. FACTS, not a verdict.
DILUTION_FLAGS = {"equity_offering_filed", "going_concern"}

_PCT_RE = re.compile(r"^([+-]?)(\d+(?:\.\d+)?)%$")


def parse_pct(value: object) -> float | None:
    """Parse a formatted percent string like '+2.1%' -> 2.1 (or None)."""
    if not isinstance(value, str):
        return None
    m = _PCT_RE.match(value.strip())
    if not m:
        return None
    n = float(m.group(2))
    return -n if m.group(1) == "-" else n


def cell(value: object, width: int) -> str:
    s = "-" if value is None else str(value)
    return (s[: width - 1] + "…") if len(s) > width else s.ljust(width)


def main() -> int:
    load_dotenv()
    client = BullAlertClient()

    print("BullAlert -- pump-and-dump RISK-CONTEXT screener")
    print("Informational only. NOT financial advice. Facts are from SEC filings. Do your own research.\n")

    wl = client.watchlist(status="momentum", limit=25)
    rows = wl.get("data", {}).get("watchlist", [])

    if not rows:
        status = wl.get("meta", {}).get("market_status")
        print("Market closed -- the momentum board is empty (try ~8am-5pm ET on a weekday)."
              if status == "closed" else "No momentum-status tickers on the board right now.")
        return 0

    header = (cell("TICKER", 8) + cell("SCORE", 7) + cell("STATUS", 10)
              + cell("SEC DILUTION FLAGS", 32) + cell("INSIDER", 14) + cell("RUNWAY", 12))
    print(header)
    print("-" * 83)

    for row in rows:
        flags_text, insider, runway, high_dilution = "n/a", "n/a", "n/a", False
        try:
            edgar = client.edgar(row["ticker"])
            sig = edgar.get("data", {}).get("signals", {})
            flags = sig.get("flags") or []
            dilution_flags = [f for f in flags if f in DILUTION_FLAGS]
            growth = parse_pct(sig.get("share_growth_1y"))
            high_dilution = growth is not None and growth >= 25  # >25% YoY = context, not a verdict
            parts = list(dilution_flags)
            if high_dilution:
                parts.append(f"share_growth {sig.get('share_growth_1y')}")
            flags_text = ", ".join(parts) if parts else "none disclosed"
            insider = sig.get("insider") or "n/a"
            runway = sig.get("runway") or "n/a"
        except BullAlertError as err:
            if err.code == "unresolved_ticker":
                flags_text = "(not an SEC filer)"
            elif err.code == "upstream_unavailable":
                flags_text = "(SEC EDGAR unavailable)"
            else:
                raise

        marker = "*" if ("equity_offering_filed" in flags_text or "going_concern" in flags_text or high_dilution) else " "
        print(marker + cell(row["ticker"], 7) + cell(row.get("score"), 7) + cell(row.get("status"), 10)
              + cell(flags_text, 32) + cell(insider, 14) + cell(runway, 12))

    print("\n* = SEC filings disclose dilution context worth reading before you decide anything.")
    print("Context, not advice. High dilution is NOT inherently bearish -- read the filings yourself.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BullAlertError as err:
        print(f"\n[{err.code or 'error'}] {err}", file=sys.stderr)
        if err.code == "rate_limit_exceeded" and err.retry_after:
            print(f"Retry after {err.retry_after}s.", file=sys.stderr)
        sys.exit(1)
