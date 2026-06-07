/**
 * Momentum-tracker, "momentum trader style" 3-tier view (JavaScript).
 *
 * Shows how a ticker progresses through BullAlert's three public layers:
 *
 *   1. SIGNALS   (/v1/signals)   — breadth: every validated $0.20-$20 candidate
 *   2. WATCHLIST (/v1/watchlist) — ranking: our proprietary 0-100 momentum score + status
 *   3. ALERTS    (/v1/alerts)    — conviction record: the names we actually flagged
 *
 * For each ticker on the momentum watchlist, it reports whether that name also
 * appears in the breadth feed and/or the published-alerts record — the
 * signal -> watchlist-rank -> alert funnel.
 *
 *   Informational only. This is data, NOT financial advice, NOT a recommendation,
 *   and "momentum trader style" describes the app you build — not a suggestion
 *   to trade. Build your own strategy and do your own research.
 *
 * Run:  node momentum-tracker.js
 */
import { loadEnv } from './lib/env.js';
import { BullAlertClient, BullAlertError } from './lib/client.js';

loadEnv();

async function collectSignalTickers(client) {
  const set = new Set();
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const res = await client.signals({ session: 'current', limit: 50, offset });
    const rows = res.data?.signals ?? [];
    for (const r of rows) set.add(r.ticker);
    if (rows.length < 50) break;
    offset += 50;
  }
  return set;
}

function cell(value, width) {
  const s = value == null ? '-' : String(value);
  return s.length > width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}

async function main() {
  const client = new BullAlertClient();

  console.log('BullAlert — momentum tracker (signal -> watchlist rank -> alert)');
  console.log('Informational only, NOT financial advice. Do your own research.\n');

  // Tier 2: the ranked momentum board (the spine of the view).
  const wl = await client.watchlist({ status: 'momentum', limit: 25 });
  const board = wl.data?.watchlist ?? [];

  if (board.length === 0) {
    const status = wl.meta?.market_status;
    console.log(status === 'closed'
      ? 'Momentum board is empty (market closed). Try ~8am-5pm ET on a weekday.'
      : 'No momentum-status tickers right now.');
    return;
  }

  // Tier 1 + Tier 3 lookups.
  const signalTickers = await collectSignalTickers(client);
  const alertsRes = await client.alerts({ session: 'current' });
  const alertMap = new Map();
  for (const a of alertsRes.data?.alerts ?? []) alertMap.set(a.ticker, a.caught_at);

  console.log(
    cell('TICKER', 8) + cell('RANK', 6) + cell('SCORE', 7) +
    cell('IN SIGNALS', 12) + cell('ALERTED', 9) + cell('CAUGHT_AT', 24),
  );
  console.log('-'.repeat(66));

  for (const row of board) {
    const inSignals = signalTickers.has(row.ticker) ? 'yes' : 'no';
    const alerted = alertMap.has(row.ticker);
    console.log(
      cell(row.ticker, 8) + cell(`#${row.rank}`, 6) + cell(row.score, 7) +
      cell(inSignals, 12) + cell(alerted ? 'yes' : 'no', 9) +
      cell(alerted ? alertMap.get(row.ticker) : '-', 24),
    );
  }

  console.log('\nFunnel: breadth (signals) -> our ranking (watchlist) -> conviction record (alerts).');
  console.log('Not financial advice. BullAlert is a data/intelligence tool — your decisions are your own.');
}

main().catch((err) => {
  if (err instanceof BullAlertError) {
    console.error(`\n[${err.code ?? 'error'}] ${err.message}`);
    process.exit(1);
  }
  console.error('Unexpected error:', err);
  process.exit(1);
});
