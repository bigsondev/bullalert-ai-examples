/**
 * New-alert watcher — a simple conviction-feed notifier (JavaScript).
 *
 * Polls the published-alert record (GET /v1/alerts) on an interval and prints a
 * line the moment a NEW ticker appears since the last poll — the "did we flag a
 * new name?" notifier. The first poll prints the current set as a baseline.
 *
 *   Informational only. The alerts feed is BullAlert's published conviction
 *   record (which names we flagged + when), NOT financial advice and NOT a
 *   recommendation to act. "Alert" means "we flagged it", not "buy it". Do your
 *   own research.
 *
 * Config (env, with sensible defaults — keep the interval polite to respect
 * per-minute rate limits):
 *   POLL_INTERVAL_SEC   seconds between polls       (default 60)
 *   MAX_POLLS           number of polls then stop   (default 5; 0 = run forever)
 *
 * Run:  node new-alert-watcher.js
 */
import { loadEnv } from './lib/env.js';
import { BullAlertClient, BullAlertError } from './lib/client.js';

loadEnv();

const POLL_INTERVAL_SEC = Math.max(5, Number(process.env.POLL_INTERVAL_SEC ?? 60));
const MAX_POLLS = Math.max(0, Number(process.env.MAX_POLLS ?? 5));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nowLabel() {
  return new Date().toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

/** Fetch current alerts; fall back to the whole day when the live session is closed. */
async function fetchAlerts(client) {
  let res = await client.alerts({ session: 'current' });
  let rows = res.data?.alerts ?? [];
  const status = res.meta?.market_status;
  if (rows.length === 0 && status === 'closed') {
    res = await client.alerts({ session: 'all' });
    rows = res.data?.alerts ?? [];
  }
  return { rows, marketStatus: res.meta?.market_status ?? null };
}

async function main() {
  const client = new BullAlertClient();

  console.log('BullAlert — new-alert watcher (published conviction feed)');
  console.log('Informational only, NOT financial advice. "Alert" = we flagged it, not "buy it".');
  console.log(`Polling /v1/alerts every ${POLL_INTERVAL_SEC}s` +
    (MAX_POLLS ? ` for ${MAX_POLLS} polls.\n` : ' (forever — Ctrl-C to stop).\n'));

  const seen = new Set();
  let poll = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    poll += 1;
    let rows = [];
    let marketStatus = null;
    try {
      ({ rows, marketStatus } = await fetchAlerts(client));
    } catch (err) {
      if (err instanceof BullAlertError && err.code === 'rate_limit_exceeded') {
        const wait = err.retryAfter ?? POLL_INTERVAL_SEC;
        console.error(`[${nowLabel()}] rate limited — backing off ${wait}s.`);
        await sleep(wait * 1000);
        poll -= 1; // this poll didn't count
        continue;
      }
      throw err;
    }

    if (poll === 1) {
      // Baseline: record what's already there, don't treat it as "new".
      if (rows.length === 0) {
        console.log(`[${nowLabel()}] ${marketStatus === 'closed'
          ? 'market closed — nothing to watch yet.'
          : 'no alerts on the board yet — watching for the first one.'}`);
      } else {
        const names = rows.map((r) => r.ticker).join(', ');
        console.log(`[${nowLabel()}] baseline: ${rows.length} alert(s) already flagged — ${names}`);
      }
      for (const r of rows) seen.add(r.ticker);
    } else {
      const fresh = rows.filter((r) => !seen.has(r.ticker));
      if (fresh.length === 0) {
        console.log(`[${nowLabel()}] no new names` +
          (marketStatus === 'closed' ? ' (market closed).' : '.'));
      }
      for (const r of fresh) {
        console.log(`[${nowLabel()}] NEW ALERT: ${r.ticker} @ ${r.caught_at ?? 'unknown'}`);
        seen.add(r.ticker);
      }
    }

    if (MAX_POLLS && poll >= MAX_POLLS) break;
    await sleep(POLL_INTERVAL_SEC * 1000);
  }

  console.log(`\nDone. Tracked ${seen.size} distinct flagged name(s). Not advice — do your own research.`);
}

main().catch((err) => {
  if (err instanceof BullAlertError) {
    console.error(`\n[${err.code ?? 'error'}] ${err.message}`);
    if (err.code === 'rate_limit_exceeded' && err.retryAfter) {
      console.error(`Retry after ${err.retryAfter}s.`);
    }
    process.exit(1);
  }
  console.error('Unexpected error:', err);
  process.exit(1);
});
