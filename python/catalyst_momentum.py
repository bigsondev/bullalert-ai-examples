"""Catalyst scan -- signals x EDGAR (Python).

Asks one question: which of the FRESHEST names we just validated have a FRESH
SEC filing behind them? It pulls the breadth feed (GET /v1/signals -- the
freshest validated $0.20-$20 candidates) and, for each ticker, the public-domain
SEC-EDGAR intelligence (GET /v1/edgar/:ticker), then surfaces the names that
recently FILED something material -- a material 8-K disclosure and/or a recent
``latest_filing``.

This is the catalyst / news angle over the WHOLE validated pool (not the ranked
board): "did a fresh mover just file something?". Research CONTEXT, NOT financial
advice and NOT a buy/sell signal. Flags describe WHAT was filed, not a verdict.
We only show what is in the public SEC record. Do your own research.

(Combo variety: pump_and_dump_screener.py uses watchlist x edgar for dilution
RISK context; this uses signals x edgar for the fresh-catalyst breadth scan.)

Run:  python catalyst_momentum.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from bullalert_client import BullAlertClient, BullAlertError, load_dotenv

# SEC 8-K disclosure slugs we treat as a fresh "catalyst" -- a material event
# the company itself disclosed. FACTS about what was filed, not a verdict.
CATALYST_FLAGS = {
    "material_agreement",
    "acquisition_completed",
    "change_of_control",
    "equity_offering_filed",
}

# A ``latest_filing`` filed within this many days counts as "recent".
RECENT_FILING_DAYS = 14

# How many of the freshest validated candidates to cross-reference (one EDGAR
# call each -- keep it modest to respect the rate limit).
SAMPLE = 25


def cell(value: object, width: int) -> str:
    s = "-" if value is None else str(value)
    return (s[: width - 1] + "…") if len(s) > width else s.ljust(width)


def days_ago(date_str: object) -> int | None:
    """Days between an ISO / 'YYYY-MM-DD' date and now (or None if unparseable)."""
    if not isinstance(date_str, str) or not date_str:
        return None
    try:
        then = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return None
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - then).days


def hhmm(iso: object) -> str:
    """HH:MM (UTC) from an ISO timestamp -- identity/timing only, no price."""
    if not isinstance(iso, str) or not iso:
        return "-"
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return "-"
    return d.astimezone(timezone.utc).strftime("%H:%MZ")


def main() -> int:
    load_dotenv()
    client = BullAlertClient()

    print("BullAlert -- catalyst scan (signals x EDGAR: which fresh movers just filed something?)")
    print("Research context, NOT financial advice. Flags describe what was FILED, not a verdict.\n")

    resp = client.signals(limit=SAMPLE, offset=0)
    pool = resp.get("data", {}).get("signals", [])

    if not pool:
        status = resp.get("meta", {}).get("market_status")
        print("No validated signals (market closed). Try ~8am-5pm ET on a weekday."
              if status == "closed" else "No validated signals in the pool right now.")
        return 0

    print(cell("TICKER", 8) + cell("SESSION", 12) + cell("CAUGHT", 8)
          + cell("LATEST FILING", 26) + cell("FRESH 8-K FLAGS", 30))
    print("-" * 84)

    with_catalyst = 0

    for row in pool:
        filing_text, flags_text, is_fresh = "none on record", "none disclosed", False
        try:
            data = client.edgar(row["ticker"]).get("data", {})
            sig = data.get("signals", {})
            flags = sig.get("flags") or []

            # Show every flag present, but mark a name as a catalyst only when a
            # *material* slug appears and/or the latest filing is recent.
            if flags:
                flags_text = ", ".join(flags)
            has_material_flag = any(f in CATALYST_FLAGS for f in flags)

            filing = data.get("latest_filing")
            if filing and (filing.get("form") or filing.get("headline")):
                age = days_ago(filing.get("filed"))
                recent = age is not None and age <= RECENT_FILING_DAYS
                age_label = "" if age is None else f" ({age}d ago)"
                head = f": {filing['headline']}" if filing.get("headline") else ""
                filing_text = f"{filing.get('form') or 'filing'}{age_label}{head}"
                is_fresh = has_material_flag or recent
            else:
                is_fresh = has_material_flag
        except BullAlertError as err:
            if err.code == "unresolved_ticker":
                filing_text = "(not an SEC filer)"
            elif err.code == "upstream_unavailable":
                filing_text = "(SEC EDGAR unavailable)"
            else:
                raise

        if is_fresh:
            with_catalyst += 1
        marker = "*" if is_fresh else " "
        print(marker + cell(row["ticker"], 7) + cell(row.get("session"), 12) + cell(hhmm(row.get("caught_at")), 8)
              + cell(filing_text, 26) + cell(flags_text, 30))

    print(f"\n* = a fresh validated mover with a FRESH SEC filing (material 8-K and/or filed in the last {RECENT_FILING_DAYS} days).")
    print(f"{with_catalyst}/{len(pool)} of the freshest validated names have a fresh filing to read.")
    print("Context, not advice. A fresh filing is not a verdict -- read it yourself and do your own research.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BullAlertError as err:
        print(f"\n[{err.code or 'error'}] {err}", file=sys.stderr)
        if err.code == "rate_limit_exceeded" and err.retry_after:
            print(f"Retry after {err.retry_after}s.", file=sys.stderr)
        sys.exit(1)
