/**
 * Catalyst scan — signals × EDGAR (JavaScript).
 *
 * Asks one question: which of the FRESHEST names we just validated have a
 * FRESH SEC filing behind them? It pulls the breadth feed (GET /v1/signals —
 * the freshest validated $0.20–$20 candidates) and, for each ticker, the
 * public-domain SEC-EDGAR intelligence (GET /v1/edgar/:ticker), then surfaces
 * the names that recently FILED something material — a material 8-K disclosure
 * and/or a recent `latest_filing`.
 *
 *   This is the catalyst / news angle over the WHOLE validated pool (not the
 *   ranked board): "did a fresh mover just file something?". Research CONTEXT,
 *   NOT financial advice and NOT a buy/sell signal. Flags describe WHAT was
 *   filed, not a verdict on the company. Do your own research.
 *
 * (Combo variety: pump-and-dump-screener uses watchlist × edgar for dilution
 * RISK context; this uses signals × edgar for the fresh-catalyst breadth scan.)
 *
 * Run:  node catalyst-momentum.js
 */
import { loadEnv } from './lib/env.js';
import { BullAlertClient, BullAlertError } from './lib/client.js';

loadEnv();

// SEC 8-K disclosure slugs we treat as a fresh "catalyst" — a material event
// the company itself disclosed. These are FACTS about what was filed, not a
// verdict on whether the move is justified.
const CATALYST_FLAGS = new Set([
  'material_agreement',
  'acquisition_completed',
  'change_of_control',
  'equity_offering_filed',
]);

// A `latest_filing` filed within this many days counts as "recent".
const RECENT_FILING_DAYS = 14;

// How many of the freshest validated candidates to cross-reference (one EDGAR
// call each — keep it modest to respect the rate limit).
const SAMPLE = 25;

/** Pad/truncate a cell to a fixed width for a simple text table. */
function cell(value, width) {
  const s = value == null ? '-' : String(value);
  return s.length > width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}

/** Days between an ISO/`YYYY-MM-DD` date and now (or null if unparseable). */
function daysAgo(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return null;
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

/** HH:MM (UTC) from an ISO timestamp — identity/timing only, no price. */
function hhmm(iso) {
  if (typeof iso !== 'string' || !iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(11, 16) + 'Z';
}

async function main() {
  const client = new BullAlertClient();

  console.log('BullAlert — catalyst scan (signals × EDGAR: which fresh movers just filed something?)');
  console.log('Research context, NOT financial advice. Flags describe what was FILED, not a verdict.\n');

  const resp = await client.signals({ limit: SAMPLE, offset: 0 });
  const pool = resp.data?.signals ?? [];

  if (pool.length === 0) {
    const status = resp.meta?.market_status;
    console.log(status === 'closed'
      ? 'No validated signals (market closed). Try ~8am-5pm ET on a weekday.'
      : 'No validated signals in the pool right now.');
    return;
  }

  console.log(
    cell('TICKER', 8) + cell('SESSION', 12) + cell('CAUGHT', 8) +
    cell('LATEST FILING', 26) + cell('FRESH 8-K FLAGS', 30),
  );
  console.log('-'.repeat(84));

  let withCatalyst = 0;

  for (const row of pool) {
    let filingText = 'none on record';
    let flagsText = 'none disclosed';
    let isFresh = false;

    try {
      const edgar = await client.edgar(row.ticker);
      const data = edgar.data ?? {};
      const sig = data.signals ?? {};
      const flags = Array.isArray(sig.flags) ? sig.flags : [];

      // Show every flag present, but mark this name as a catalyst only when a
      // *material* slug appears and/or the latest filing is recent.
      if (flags.length) flagsText = flags.join(', ');
      const hasMaterialFlag = flags.some((f) => CATALYST_FLAGS.has(f));

      const filing = data.latest_filing;
      if (filing && (filing.form || filing.headline)) {
        const age = daysAgo(filing.filed);
        const recent = age != null && age <= RECENT_FILING_DAYS;
        const ageLabel = age == null ? '' : ` (${age}d ago)`;
        const head = filing.headline ? `: ${filing.headline}` : '';
        filingText = `${filing.form ?? 'filing'}${ageLabel}${head}`;
        isFresh = hasMaterialFlag || recent;
      } else {
        isFresh = hasMaterialFlag;
      }
    } catch (err) {
      if (err instanceof BullAlertError && err.code === 'unresolved_ticker') {
        filingText = '(not an SEC filer)';
      } else if (err instanceof BullAlertError && err.code === 'upstream_unavailable') {
        filingText = '(SEC EDGAR unavailable)';
      } else {
        throw err;
      }
    }

    if (isFresh) withCatalyst += 1;
    const marker = isFresh ? '*' : ' ';
    console.log(
      marker +
      cell(row.ticker, 7) + cell(row.session, 12) + cell(hhmm(row.caught_at), 8) +
      cell(filingText, 26) + cell(flagsText, 30),
    );
  }

  console.log(`\n* = a fresh validated mover with a FRESH SEC filing (material 8-K and/or filed in the last ${RECENT_FILING_DAYS} days).`);
  console.log(`${withCatalyst}/${pool.length} of the freshest validated names have a fresh filing to read.`);
  console.log('Context, not advice. A fresh filing is not a verdict — read it yourself and do your own research.');
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
