/**
 * Pump-and-dump RISK-CONTEXT screener (JavaScript).
 *
 * Pulls the momentum board (GET /v1/watchlist?status=momentum) and, for each
 * ticker, the public-domain SEC-EDGAR intelligence (GET /v1/edgar/:ticker).
 * It surfaces FACTUAL dilution / financial-health context from SEC filings so
 * you can do your own due diligence on a name that is moving.
 *
 *   IMPORTANT — this is research context, NOT financial advice and NOT a
 *   buy/sell/avoid signal. High dilution is NOT inherently bearish; companies
 *   raise capital for many reasons. We only show what was FILED with the SEC.
 *   Do your own research.
 *
 * Run:  node pump-and-dump-screener.js
 */
import { loadEnv } from './lib/env.js';
import { BullAlertClient, BullAlertError } from './lib/client.js';

loadEnv();

// SEC 8-K disclosure flags worth reading before chasing a mover. These are
// FACTS about what the company filed, not a verdict.
const DILUTION_FLAGS = new Set(['equity_offering_filed', 'going_concern']);

/** Parse a formatted percent string like "+2.1%" -> 2.1 (or null). */
function parsePct(s) {
  if (typeof s !== 'string') return null;
  const m = /^([+-]?)(\d+(?:\.\d+)?)%$/.exec(s.trim());
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === '-' ? -n : n;
}

/** Pad/truncate a cell to a fixed width for a simple text table. */
function cell(value, width) {
  const s = value == null ? '-' : String(value);
  return s.length > width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}

async function main() {
  const client = new BullAlertClient();

  console.log('BullAlert — pump-and-dump RISK-CONTEXT screener');
  console.log('Informational only. NOT financial advice. Facts are from SEC filings. Do your own research.\n');

  const wl = await client.watchlist({ status: 'momentum', limit: 25 });
  const rows = wl.data?.watchlist ?? [];

  if (rows.length === 0) {
    const status = wl.meta?.market_status;
    console.log(status === 'closed'
      ? 'The momentum board is empty right now (market closed). Try during ~8am-5pm ET on a weekday.'
      : 'No momentum-status tickers on the board right now.');
    return;
  }

  console.log(
    cell('TICKER', 8) + cell('SCORE', 7) + cell('STATUS', 10) +
    cell('SEC DILUTION FLAGS', 32) + cell('INSIDER', 14) + cell('RUNWAY', 12),
  );
  console.log('-'.repeat(83));

  for (const row of rows) {
    let flagsText = 'n/a';
    let insider = 'n/a';
    let runway = 'n/a';
    let highDilution = false;

    try {
      const edgar = await client.edgar(row.ticker);
      const sig = edgar.data?.signals ?? {};
      const flags = Array.isArray(sig.flags) ? sig.flags : [];
      const dilutionFlags = flags.filter((f) => DILUTION_FLAGS.has(f));
      const growth = parsePct(sig.share_growth_1y);
      // "High positive" share-count growth (>25% YoY) is dilution CONTEXT, not a verdict.
      highDilution = growth != null && growth >= 25;

      const parts = [...dilutionFlags];
      if (highDilution) parts.push(`share_growth ${sig.share_growth_1y}`);
      flagsText = parts.length ? parts.join(', ') : 'none disclosed';
      insider = sig.insider ?? 'n/a';
      runway = sig.runway ?? 'n/a';
    } catch (err) {
      if (err instanceof BullAlertError && err.code === 'unresolved_ticker') {
        flagsText = '(not an SEC filer)';
      } else if (err instanceof BullAlertError && err.code === 'upstream_unavailable') {
        flagsText = '(SEC EDGAR unavailable)';
      } else {
        throw err;
      }
    }

    const marker = (flagsText.includes('equity_offering_filed') || flagsText.includes('going_concern') || highDilution) ? '*' : ' ';
    console.log(
      marker +
      cell(row.ticker, 7) + cell(row.score, 7) + cell(row.status, 10) +
      cell(flagsText, 32) + cell(insider, 14) + cell(runway, 12),
    );
  }

  console.log('\n* = SEC filings disclose dilution context worth reading before you decide anything.');
  console.log('Context, not advice. High dilution is NOT inherently bearish — read the filings yourself.');
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
