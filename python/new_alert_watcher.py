"""New-alert watcher -- a simple alerts-feed notifier (Python).

Polls the published-alert record (GET /v1/alerts) on an interval and prints a
line the moment a NEW ticker appears since the last poll -- the "did we flag a
new name?" notifier. The first poll prints the current set as a baseline.

Informational only. The alerts feed is BullAlert's published alerts record
(which names we flagged + when), NOT financial advice and NOT a recommendation
to act. "Alert" means "we flagged it", not "buy it". Do your own research.

Config (env, with sensible defaults -- keep the interval polite to respect
per-minute rate limits):
  POLL_INTERVAL_SEC   seconds between polls       (default 60)
  MAX_POLLS           number of polls then stop   (default 5; 0 = run forever)

Run:  python new_alert_watcher.py
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone

from bullalert_client import BullAlertClient, BullAlertError, load_dotenv

POLL_INTERVAL_SEC = max(5, int(os.environ.get("POLL_INTERVAL_SEC", "60")))
MAX_POLLS = max(0, int(os.environ.get("MAX_POLLS", "5")))


def now_label() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")


def fetch_alerts(client: BullAlertClient) -> tuple[list[dict], str | None]:
    """Fetch current alerts; fall back to the whole day when the live session is closed."""
    res = client.alerts(session="current")
    rows = res.get("data", {}).get("alerts", [])
    if not rows and res.get("meta", {}).get("market_status") == "closed":
        res = client.alerts(session="all")
        rows = res.get("data", {}).get("alerts", [])
    return rows, res.get("meta", {}).get("market_status")


def main() -> int:
    load_dotenv()
    client = BullAlertClient()

    print("BullAlert -- new-alert watcher (published alerts feed)")
    print('Informational only, NOT financial advice. "Alert" = we flagged it, not "buy it".')
    print(f"Polling /v1/alerts every {POLL_INTERVAL_SEC}s"
          + (f" for {MAX_POLLS} polls.\n" if MAX_POLLS else " (forever -- Ctrl-C to stop).\n"))

    seen: set[str] = set()
    poll = 0

    while True:
        poll += 1
        try:
            rows, market_status = fetch_alerts(client)
        except BullAlertError as err:
            if err.code == "rate_limit_exceeded":
                wait = err.retry_after or POLL_INTERVAL_SEC
                print(f"[{now_label()}] rate limited -- backing off {wait}s.", file=sys.stderr)
                time.sleep(wait)
                poll -= 1  # this poll didn't count
                continue
            raise

        if poll == 1:
            # Baseline: record what's already there, don't treat it as "new".
            if not rows:
                print(f"[{now_label()}] " + ("market closed -- nothing to watch yet."
                      if market_status == "closed" else "no alerts on the board yet -- watching for the first one."))
            else:
                names = ", ".join(r["ticker"] for r in rows)
                print(f"[{now_label()}] baseline: {len(rows)} alert(s) already flagged -- {names}")
            seen.update(r["ticker"] for r in rows)
        else:
            fresh = [r for r in rows if r["ticker"] not in seen]
            if not fresh:
                print(f"[{now_label()}] no new names" + (" (market closed)." if market_status == "closed" else "."))
            for r in fresh:
                print(f"[{now_label()}] NEW ALERT: {r['ticker']} @ {r.get('caught_at') or 'unknown'}")
                seen.add(r["ticker"])

        if MAX_POLLS and poll >= MAX_POLLS:
            break
        time.sleep(POLL_INTERVAL_SEC)

    print(f"\nDone. Tracked {len(seen)} distinct flagged name(s). Not advice -- do your own research.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)
    except BullAlertError as err:
        print(f"\n[{err.code or 'error'}] {err}", file=sys.stderr)
        if err.code == "rate_limit_exceeded" and err.retry_after:
            print(f"Retry after {err.retry_after}s.", file=sys.stderr)
        sys.exit(1)
