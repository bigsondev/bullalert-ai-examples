"""Signals breadth-feed reader (Python).

The /v1/signals endpoint is the raw, strategy-agnostic breadth feed: every
$0.20-$20 small-cap that BullAlert's scanner validated this session (hundreds
of rows), as identity + catch-time + session only. This script paginates the
whole session pool with limit/offset and prints it grouped by session,
freshest-first.

Informational data feed, NOT financial advice and NOT a recommendation.

Run:  python signals_feed.py
"""
from __future__ import annotations

import sys
from collections import defaultdict

from bullalert_client import BullAlertClient, BullAlertError, load_dotenv

PAGE_SIZE = 50


def fetch_all_signals(client: BullAlertClient) -> list[dict]:
    all_rows: list[dict] = []
    offset = 0
    for _ in range(50):  # hard page cap (a session is hundreds of rows)
        res = client.signals(session="all", limit=PAGE_SIZE, offset=offset)
        rows = res.get("data", {}).get("signals", [])
        all_rows.extend(rows)
        if len(rows) < PAGE_SIZE:  # short page => last page
            break
        offset += PAGE_SIZE
    return all_rows


def main() -> int:
    load_dotenv()
    client = BullAlertClient()

    print("BullAlert -- validated candidate breadth feed (/v1/signals)")
    print("Strategy-agnostic data feed. Informational only, NOT financial advice.\n")

    rows = fetch_all_signals(client)
    if not rows:
        print("No validated signals right now (market may be closed). Try as_of= to replay a past session.")
        return 0

    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        buckets[r.get("session", "unknown")].append(r)

    labels = {"pre_market": "PRE-MARKET", "market": "REGULAR HOURS", "after_hours": "AFTER HOURS"}
    for session in ("pre_market", "market", "after_hours"):
        session_rows = buckets.get(session, [])
        if not session_rows:
            continue
        print(f"== {labels[session]} ({len(session_rows)}) ==")
        for r in session_rows:
            caught = (r.get("caught_at") or "unknown").replace("T", " ").replace(".000Z", "Z")
            print(f"  {r['ticker']:<8} caught {caught}")
        print("")

    print(f"Total validated candidates this session: {len(rows)}")
    print("This is breadth (the universe we screened), not a pick list. Do your own research.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BullAlertError as err:
        print(f"\n[{err.code or 'error'}] {err}", file=sys.stderr)
        sys.exit(1)
