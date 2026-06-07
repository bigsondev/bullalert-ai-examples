/**
 * Tiny zero-dependency client for the BullAlert API (https://api.bullalert.ai).
 *
 * Uses the built-in global `fetch` (Node 18+). Reads the API key from the
 * BULLALERT_API_KEY environment variable and sends it in the `x-ba-api-key`
 * header. Surfaces typed errors so callers can handle 401 / 402 / 429 cleanly.
 *
 * BullAlert is an informational / data tool, NOT financial advice. The API
 * returns DERIVED intelligence (a 0-100 score, a momentum/watch status, SEC
 * public-domain filing facts) — never raw prices, percentages, or volume.
 */

/** Error with the API's typed `code` attached (e.g. 'invalid_key', 'rate_limit_exceeded'). */
export class BullAlertError extends Error {
  constructor(message, { status, code, retryAfter } = {}) {
    super(message);
    this.name = 'BullAlertError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.retryAfter = retryAfter ?? null;
  }
}

const FRIENDLY = {
  missing_key: 'No API key sent. Set BULLALERT_API_KEY (see .env.example).',
  invalid_key: 'API key is invalid or revoked. Generate a new one in the dashboard.',
  subscription_inactive: 'Your BullAlert subscription is not active. Resume it to use the API.',
  billing_suspended: 'Billing is suspended. Contact partners@bullalert.ai.',
  contract_expired: 'Your contract has ended. Contact partners@bullalert.ai to renew.',
  rate_limit_exceeded: 'Per-minute rate limit hit. Slow down and respect Retry-After.',
  daily_pool_exhausted: 'Daily request pool exhausted. Resets at UTC midnight.',
  monthly_pool_exhausted: 'Monthly request pool exhausted. Resets next month.',
  unresolved_ticker: 'Ticker is not an SEC filer (or unknown).',
  upstream_unavailable: 'SEC EDGAR is temporarily unavailable. Retry shortly.',
  invalid_params: 'One or more query parameters were invalid.',
};

export class BullAlertClient {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey]  Defaults to process.env.BULLALERT_API_KEY.
   * @param {string} [opts.baseUrl] Defaults to process.env.BULLALERT_API_BASE or https://api.bullalert.ai.
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey ?? process.env.BULLALERT_API_KEY;
    this.baseUrl = (opts.baseUrl ?? process.env.BULLALERT_API_BASE ?? 'https://api.bullalert.ai').replace(/\/+$/, '');
    if (!this.apiKey) {
      throw new BullAlertError(FRIENDLY.missing_key, { status: 401, code: 'missing_key' });
    }
    // Most-recent rate-limit headers, refreshed after every request.
    this.rateLimit = { remaining: null, reset: null, limit: null };
  }

  /** Low-level GET against `path` (e.g. '/v1/watchlist') with optional query params. */
  async get(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-ba-api-key': this.apiKey, accept: 'application/json' },
    });
    this.#captureRateLimit(res);

    let body;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const code = body?.error?.code ?? 'http_error';
      const message = FRIENDLY[code] ?? body?.error?.message ?? `HTTP ${res.status}`;
      const retryAfter = res.headers.get('retry-after');
      throw new BullAlertError(message, {
        status: res.status,
        code,
        retryAfter: retryAfter ? Number(retryAfter) : null,
      });
    }
    return body;
  }

  #captureRateLimit(res) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    const limit = res.headers.get('x-ratelimit-limit');
    if (remaining !== null) this.rateLimit.remaining = Number(remaining);
    if (reset !== null) this.rateLimit.reset = reset;
    if (limit !== null) this.rateLimit.limit = Number(limit);
  }

  // ── Endpoint helpers — each returns the parsed `{ data, meta }` envelope. ──

  /** GET /v1/health (no auth strictly required, but harmless to send the key). */
  health() {
    return this.get('/v1/health');
  }

  /** GET /v1/watchlist — ranked board of { rank, ticker, score, status }. */
  watchlist({ session, limit, status, as_of } = {}) {
    return this.get('/v1/watchlist', { session, limit, status, as_of });
  }

  /** GET /v1/alerts — published-alert record of { ticker, caught_at }. */
  alerts({ session, as_of } = {}) {
    return this.get('/v1/alerts', { session, as_of });
  }

  /** GET /v1/signals — validated candidate breadth feed { ticker, caught_at, session }. */
  signals({ session, limit, offset, as_of } = {}) {
    return this.get('/v1/signals', { session, limit, offset, as_of });
  }

  /** GET /v1/edgar/:ticker — SEC-EDGAR public-domain company intelligence. */
  edgar(ticker, { detail, as_of } = {}) {
    const t = encodeURIComponent(String(ticker).toUpperCase());
    return this.get(`/v1/edgar/${t}`, { detail, as_of });
  }
}
