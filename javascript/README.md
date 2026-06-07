# BullAlert API — JavaScript examples

Zero-dependency Node.js (>= 18) examples for the [BullAlert](https://bullalert.ai) small-cap
momentum + SEC EDGAR API. Uses the built-in global `fetch` — no npm install needed.

> **Informational only — not financial advice.** BullAlert is a data / intelligence tool.
> The API returns derived intelligence (a 0-100 score, a `momentum`/`watch` status, public-domain
> SEC filing facts) — never raw prices, percentages, or volume. Do your own research.

## Setup

1. Copy the env template and add your key (dashboard → Account → API):

   ```bash
   cp ../.env.example ../.env
   # then edit ../.env and set BULLALERT_API_KEY
   ```

   Or just export it in your shell:

   ```bash
   export BULLALERT_API_KEY=your_key_here   # PowerShell:  $env:BULLALERT_API_KEY = "your_key_here"
   ```

2. Run any example (no `npm install` required):

   ```bash
   node signals-feed.js
   node momentum-tracker.js
   node pump-and-dump-screener.js
   ```

   Or via the package scripts: `npm run signals`, `npm run momentum`, `npm run screener`.

## Files

| File | What it does |
|---|---|
| `lib/client.js` | Tiny `fetch` wrapper — adds `x-ba-api-key`, captures rate-limit headers, throws typed `BullAlertError`. |
| `lib/env.js` | Minimal `.env` loader (no dependency). |
| `signals-feed.js` | Paginates `/v1/signals` and prints the validated breadth feed grouped by session. |
| `momentum-tracker.js` | Combines signals + watchlist + alerts into a signal → rank → alert funnel view. |
| `pump-and-dump-screener.js` | Cross-references the momentum board with SEC dilution facts as **risk context** (not advice). |
| `catalyst-momentum.js` | Cross-references the **freshest validated signals** with SEC filings (signals × edgar) — which fresh movers have a **material 8-K / recent filing** behind them (catalyst context, not advice). |
| `new-alert-watcher.js` | Polls `/v1/alerts` on an interval and prints **new names** as they're flagged (`POLL_INTERVAL_SEC` / `MAX_POLLS` env). |

## Using the client in your own code

```js
import { BullAlertClient } from './lib/client.js';

const client = new BullAlertClient(); // reads BULLALERT_API_KEY from env
const { data, meta } = await client.watchlist({ status: 'momentum', limit: 10 });
for (const row of data.watchlist) {
  console.log(`#${row.rank} ${row.ticker} score=${row.score} (${row.status})`);
}
```

See [`../docs/API.md`](../docs/API.md) for the full endpoint reference and
[`../docs/RATE_LIMITS.md`](../docs/RATE_LIMITS.md) for limits.
