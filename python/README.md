# BullAlert API — Python examples

Small, readable Python (3.9+) examples for the [BullAlert](https://bullalert.ai) small-cap
momentum + SEC EDGAR API. One dependency: `requests`.

> **Informational only — not financial advice.** BullAlert is a data / intelligence tool.
> The API returns derived intelligence (a 0-100 score, a `momentum`/`watch` status, public-domain
> SEC filing facts) — never raw prices, percentages, or volume. Do your own research.

## Setup

1. Install the one dependency (a virtualenv is recommended):

   ```bash
   python -m venv .venv
   # Windows PowerShell:  .venv\Scripts\Activate.ps1
   # macOS / Linux:       source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Provide your API key (dashboard → Account → API). Either copy the env template:

   ```bash
   cp ../.env.example ../.env   # then edit ../.env and set BULLALERT_API_KEY
   ```

   …or export it in your shell:

   ```bash
   export BULLALERT_API_KEY=your_key_here   # PowerShell:  $env:BULLALERT_API_KEY = "your_key_here"
   ```

3. Run any example:

   ```bash
   python signals_feed.py
   python momentum_tracker.py
   python pump_and_dump_screener.py
   ```

## Files

| File | What it does |
|---|---|
| `bullalert_client.py` | `BullAlertClient` class — adds `x-ba-api-key`, captures rate-limit headers, raises typed `BullAlertError`. Also a zero-dep `load_dotenv()`. |
| `signals_feed.py` | Paginates `/v1/signals` and prints the validated breadth feed grouped by session. |
| `momentum_tracker.py` | Combines signals + watchlist + alerts into a signal → rank → alert funnel view. |
| `pump_and_dump_screener.py` | Cross-references the momentum board with SEC dilution facts as **risk context** (not advice). |
| `catalyst_momentum.py` | Cross-references the **freshest validated signals** with SEC filings (signals × edgar) — which fresh movers have a **material 8-K / recent filing** behind them (catalyst context, not advice). |
| `new_alert_watcher.py` | Polls `/v1/alerts` on an interval and prints **new names** as they're flagged (`POLL_INTERVAL_SEC` / `MAX_POLLS` env). |

## Using the client in your own code

```python
from bullalert_client import BullAlertClient, load_dotenv

load_dotenv()
client = BullAlertClient()  # reads BULLALERT_API_KEY from env
resp = client.watchlist(status="momentum", limit=10)
for row in resp["data"]["watchlist"]:
    print(f"#{row['rank']} {row['ticker']} score={row['score']} ({row['status']})")
```

See [`../docs/API.md`](../docs/API.md) for the full endpoint reference and
[`../docs/RATE_LIMITS.md`](../docs/RATE_LIMITS.md) for limits.
