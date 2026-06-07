/**
 * Signals breadth-feed reader (JavaScript).
 *
 * The /v1/signals endpoint is the raw, strategy-agnostic breadth feed: every
 * $0.20-$20 small-cap that BullAlert's scanner validated this session
 * (hundreds of rows), as identity + catch-time + session only. This script
 * paginates the whole session pool with limit/offset and prints it grouped by
 * session, freshest-first.
 *
 *   Informational data feed, NOT financial advice and NOT a recommendation.
 *
 * Run:  node signals-feed.js
 */
import { loadEnv } from './lib/env.js';
import { BullAlertClient, BullAlertError } from './lib/client.js';

loadEnv();

const PAGE_SIZE = 50;

async function fetchAllSignals(client) {
  const all = [];
  let offset = 0;
  let metaSession = 'current';
  // Page until a page comes back shorter than the page size (the last page).
  for (let page = 0; page < 50; page += 1) {
    const res = await client.signals({ session: 'all', limit: PAGE_SIZE, offset });
    const rows = res.data?.signals ?? [];
    metaSession = res.meta?.session ?? metaSession;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break; // short page => done
    offset += PAGE_SIZE;
  }
  return { all, metaSession };
}

function group(rows) {
  const buckets = { pre_market: [], market: [], after_hours: [] };
  for (const r of rows) {
    (buckets[r.session] ?? (buckets[r.session] = [])).push(r);
  }
  return buckets;
}

async function main() {
  const client = new BullAlertClient();

  console.log('BullAlert — validated candidate breadth feed (/v1/signals)');
  console.log('Strategy-agnostic data feed. Informational only, NOT financial advice.\n');

  const { all } = await fetchAllSignals(client);

  if (all.length === 0) {
    console.log('No validated signals right now (market may be closed). Try ?as_of= to replay a past session.');
    return;
  }

  const buckets = group(all);
  const order = ['pre_market', 'market', 'after_hours'];
  const labels = { pre_market: 'PRE-MARKET', market: 'REGULAR HOURS', after_hours: 'AFTER HOURS' };

  for (const session of order) {
    const rows = buckets[session] ?? [];
    if (rows.length === 0) continue;
    console.log(`== ${labels[session]} (${rows.length}) ==`);
    for (const r of rows) {
      const when = r.caught_at ? new Date(r.caught_at).toISOString().replace('T', ' ').replace('.000Z', 'Z') : 'unknown';
      console.log(`  ${r.ticker.padEnd(8)} caught ${when}`);
    }
    console.log('');
  }

  console.log(`Total validated candidates this session: ${all.length}`);
  console.log('This is breadth (the universe we screened), not a pick list. Do your own research.');
}

main().catch((err) => {
  if (err instanceof BullAlertError) {
    console.error(`\n[${err.code ?? 'error'}] ${err.message}`);
    process.exit(1);
  }
  console.error('Unexpected error:', err);
  process.exit(1);
});
