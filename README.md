# BullAlert API — examples (JavaScript, Python & MCP)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Not financial advice](https://img.shields.io/badge/disclaimer-not%20financial%20advice-orange.svg)](./docs/DISCLAIMER.md)
[![API docs](https://img.shields.io/badge/API-docs-blue.svg)](https://bullalert.ai/api)

Official **JavaScript + Python + MCP** examples for the **[BullAlert API](https://bullalert.ai/api)** —
a real-time **small-cap / microcap momentum** intelligence and **SEC EDGAR filings** API. Build a
**stock momentum scanner**, a **breadth-feed agent**, a **pump-and-dump risk screener**, or wire
the hosted **MCP server into Claude or ChatGPT** in minutes.

> **BullAlert is an informational data / intelligence tool — not financial advice.** The API returns
> **derived IP** (a 0-100 momentum score, a `momentum`/`watch` status) and **public-domain SEC EDGAR**
> facts. It does **not** return raw prices, percentages, or volume. You build your own strategy and
> do your own research. See [`docs/DISCLAIMER.md`](./docs/DISCLAIMER.md).

**Keywords:** BullAlert API · small-cap momentum API · microcap stock signals API · momentum scanner ·
stock screener API · SEC EDGAR filings API · pump and dump detector · MCP server for Claude & ChatGPT ·
algotrading examples · fintech developer tools · JavaScript & Python stock API.

---

## What BullAlert is

BullAlert is an **alternative-intelligence layer for US small-cap momentum**. It surfaces
positive-momentum **$0.20–$20 microcaps** early, ranks them with a proprietary 0-100 score, and
records the names it flags. The public API exposes that intelligence as clean derived data —
**a score, a status, identity + timing, and SEC filing facts** — so you can build screeners,
agents, dashboards, and research tools. It is an **information tool, never a trading app**: you
compute your own decisions.

## Signals vs Watchlist vs Alerts — one funnel, three widths

These three surfaces are the **same pipeline at three levels of conviction**. Same universe,
progressively narrower. Think **breadth → ranking → conviction**:

| | **`/v1/signals`** — breadth | **`/v1/watchlist`** — ranking | **`/v1/alerts`** — conviction |
|---|---|---|---|
| **What it is** | The full validated candidate pool — every $0.20–$20 microcap our scanner cleared the universe + junk/scam filters on this session. | The **top-N of that pool, ranked** by our proprietary 0-100 momentum score, each tagged `momentum` or `watch`. | The handful that passed the **full promotion pipeline** (all 20 gates + strategy checks). The published record of what we actually flagged. |
| **Think of it as** | The raw data layer / "what's in play". | "What to watch **right now**", ranked. | "What we're **most confident** in", with a timestamp. |
| **Volume** | **Hundreds** per session — grows from a few at the open to hundreds by close. | Exactly up to your `limit` (**10 / 25 / 50 / 100**). | **A few per day** (hard cap 3 pre-market / 5 regular / 3 after-hours). |
| **Fields** | `ticker`, `caught_at`, `session` (identity only — no score). | `rank`, `ticker`, `score` (0–100), `status` (`momentum`/`watch`). | `ticker`, `caught_at` (identity + time). |
| **Sort** | Freshest catch first (`caught_at` ↓) — **stacks/accumulates** through the session; paginate with `offset`. | Highest score first (`momentum` rows always above `watch`). | Newest first. |
| **Use it for** | Backtests, breadth agents, "scan everything we validated". | A ranked momentum board / dashboard. | A clean conviction feed / "did we flag X today?". |

**The funnel:** every alert was on the watchlist; every watchlist row was a signal first. Signals
is the widest net (hundreds), the watchlist is the ranked shortlist (top-N), and alerts is the
narrow, highest-conviction set (a few a day). The [momentum-tracker](#examples-included) example
walks a ticker through all three.

## Endpoints

| Endpoint | What you get |
|---|---|
| `GET /v1/health` | Liveness + version (no auth). |
| `GET /v1/watchlist` | Ranked momentum board: `rank`, `ticker`, `score` (0–100), `status` (`momentum`/`watch`). |
| `GET /v1/alerts` | Published-alert record: `ticker`, `caught_at`. |
| `GET /v1/signals` | Validated candidate breadth feed: `ticker`, `caught_at`, `session`. |
| `GET /v1/edgar/:ticker` | SEC-EDGAR company intelligence: financial snapshot, dilution, runway, insider, 8-K flags. |
| `POST /v1/mcp` | MCP (Model Context Protocol) server — 4 tools for Claude / ChatGPT / Cursor. |

Full reference: [`docs/API.md`](./docs/API.md).

## Get your API key

1. **Create your account** at **[bullalert.ai](https://bullalert.ai)** — sign up and pick a plan (API access is included with every subscription).
2. Once you're in, open **Account → API** in the app.
3. Generate a key. Keep it secret — send it in the `x-ba-api-key` header.
4. Set it as an environment variable (never hardcode it):

   ```bash
   # macOS / Linux
   export BULLALERT_API_KEY=your_key_here
   # Windows PowerShell
   $env:BULLALERT_API_KEY = "your_key_here"
   ```

   Or copy [`.env.example`](./.env.example) to `.env` and fill it in.

## Quickstart

### cURL

```bash
curl -s https://api.bullalert.ai/v1/watchlist?status=momentum&limit=10 \
  -H "x-ba-api-key: $BULLALERT_API_KEY"
```

### JavaScript (Node 18+, zero dependencies)

```bash
cd javascript
node signals-feed.js          # validated breadth feed
node momentum-tracker.js      # signal -> watchlist rank -> alert funnel
node pump-and-dump-screener.js  # momentum board + SEC dilution risk context
node catalyst-momentum.js     # freshest signals cross-referenced with SEC filings
node new-alert-watcher.js     # poll the conviction feed for new names
```

```js
import { BullAlertClient } from './lib/client.js';
const client = new BullAlertClient();                       // reads BULLALERT_API_KEY
const { data } = await client.watchlist({ status: 'momentum', limit: 10 });
data.watchlist.forEach((r) => console.log(`#${r.rank} ${r.ticker} ${r.score} (${r.status})`));
```

More: [`javascript/README.md`](./javascript/README.md).

### Python (3.9+, `requests`)

```bash
cd python
pip install -r requirements.txt
python signals_feed.py
python momentum_tracker.py
python pump_and_dump_screener.py
python catalyst_momentum.py
python new_alert_watcher.py
```

```python
from bullalert_client import BullAlertClient, load_dotenv
load_dotenv()
client = BullAlertClient()                                  # reads BULLALERT_API_KEY
for r in client.watchlist(status="momentum", limit=10)["data"]["watchlist"]:
    print(f"#{r['rank']} {r['ticker']} {r['score']} ({r['status']})")
```

More: [`python/README.md`](./python/README.md).

### MCP — talk to your momentum data in Claude / ChatGPT / Cursor

BullAlert hosts an **MCP server** at `https://api.bullalert.ai/v1/mcp` with 4 tools
(`list_watchlist`, `list_signals`, `list_alerts`, `get_company_financials`). Drop in a config and
ask in plain English: *"List the top 10 BullAlert momentum tickers and check each for an SEC
equity-offering flag."*

- Claude Desktop / Claude Code → [`mcp/claude-desktop.json`](./mcp/claude-desktop.json)
- Cursor → [`mcp/cursor.json`](./mcp/cursor.json)
- ChatGPT → [`mcp/chatgpt.md`](./mcp/chatgpt.md)

More: [`mcp/README.md`](./mcp/README.md).

## Examples included

| Example | JS | Python | What it shows |
|---|---|---|---|
| **Signals breadth feed** | `signals-feed.js` | `signals_feed.py` | Paginate the full validated candidate pool, grouped by session. |
| **Momentum tracker** | `momentum-tracker.js` | `momentum_tracker.py` | The signal → watchlist-rank → alert funnel ("momentum trader style"). |
| **Pump-and-dump risk screener** | `pump-and-dump-screener.js` | `pump_and_dump_screener.py` | Cross-reference the momentum board with SEC dilution facts as **risk context** (not advice). |
| **Catalyst scan (signals × edgar)** | `catalyst-momentum.js` | `catalyst_momentum.py` | Cross-reference the **freshest validated signals** with SEC filings — which fresh movers have a **material 8-K / recent filing** behind them (catalyst context, not advice). |
| **New-alert watcher** | `new-alert-watcher.js` | `new_alert_watcher.py` | Poll the published conviction feed and print **new names** as they're flagged. |

## Rate limits

Per key: **lite 30 / default 60 / b2b 300** requests per minute, plus daily + monthly pools. All
`/v1/*` share one bucket; responses carry `X-RateLimit-*` headers; over-limit returns `429` with a
`Retry-After`. The limiter fails open. Full details: [`docs/RATE_LIMITS.md`](./docs/RATE_LIMITS.md).

## Suggested GitHub topics

When you publish this repo, add topics for discoverability:

```
bullalert, stock-api, momentum, small-cap, microcap, stock-screener, stock-signals,
sec-edgar, edgar-api, financial-data, fintech, algotrading, mcp, model-context-protocol,
claude, chatgpt, trading-tools, market-data, javascript, python
```

## License

[MIT](./LICENSE) — © 2026 BullAlert. Examples are provided as-is, for informational purposes only.
**Not financial advice.** See [`docs/DISCLAIMER.md`](./docs/DISCLAIMER.md).

Links: [BullAlert API docs](https://bullalert.ai/api) · [Dashboard](https://bullalert.ai/dashboard) · [Blog](https://bullalert.ai/blog)
