"""Momentum-tracker, "momentum trader style" 3-tier view (Python).

Shows how a ticker progresses through BullAlert's three public layers:

  1. SIGNALS   (/v1/signals)   -- breadth: every validated $0.20-$20 candidate
  2. WATCHLIST (/v1/watchlist) -- ranking: our proprietary 0-100 momentum score + status
  3. ALERTS    (/v1/alerts)    -- all-gates record: the names that cleared all 20 gates

For each ticker on the momentum watchlist, it reports whether that name also
appears in the breadth feed and/or the published-alerts record -- the
signal -> watchlist-rank -> alert funnel.

Informational only. This is data, NOT financial advice, NOT a recommendation,
and "momentum trader style" describes the app you build -- not a suggestion to
trade. Build your own strategy and do your own research.

Run:  python momentum_tracker.py
"""
from __future__ import annotations

import sys

from bullalert_client import BullAlertClient, BullAlertError, load_dotenv


def collect_signal_tickers(client: BullAlertClient) -> set[str]:
    tickers: set[str] = set()
    offset = 0
    for _ in range(20):
        res = client.signals(session="current", limit=50, offset=offset)
        rows = res.get("data", {}).get("signals", [])
        tickers.update(r["ticker"] for r in rows)
        if len(rows) < 50:
            break
        offset += 50
    return tickers


def cell(value: object, width: int) -> str:
    s = "-" if value is None else str(value)
    return (s[: width - 1] + "…") if len(s) > width else s.ljust(width)


def main() -> int:
    load_dotenv()
    client = BullAlertClient()

    print("BullAlert -- momentum tracker (signal -> watchlist rank -> alert)")
    print("Informational only, NOT financial advice. Do your own research.\n")

    wl = client.watchlist(status="momentum", limit=25)
    board = wl.get("data", {}).get("watchlist", [])
    if not board:
        status = wl.get("meta", {}).get("market_status")
        print("Momentum board is empty (market closed). Try ~8am-5pm ET on a weekday."
              if status == "closed" else "No momentum-status tickers right now.")
        return 0

    signal_tickers = collect_signal_tickers(client)
    alerts_res = client.alerts(session="current")
    alert_map = {a["ticker"]: a.get("caught_at") for a in alerts_res.get("data", {}).get("alerts", [])}

    print(cell("TICKER", 8) + cell("RANK", 6) + cell("SCORE", 7)
          + cell("IN SIGNALS", 12) + cell("ALERTED", 9) + cell("CAUGHT_AT", 24))
    print("-" * 66)

    for row in board:
        ticker = row["ticker"]
        in_signals = "yes" if ticker in signal_tickers else "no"
        alerted = ticker in alert_map
        print(cell(ticker, 8) + cell(f"#{row.get('rank')}", 6) + cell(row.get("score"), 7)
              + cell(in_signals, 12) + cell("yes" if alerted else "no", 9)
              + cell(alert_map.get(ticker) if alerted else "-", 24))

    print("\nFunnel: breadth (signals) -> our ranking (watchlist) -> all-gates record (alerts).")
    print("Not financial advice. BullAlert is a data/intelligence tool -- your decisions are your own.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BullAlertError as err:
        print(f"\n[{err.code or 'error'}] {err}", file=sys.stderr)
        sys.exit(1)
