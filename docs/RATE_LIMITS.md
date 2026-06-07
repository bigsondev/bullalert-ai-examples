# Rate limits

Every `/v1/*` request shares a single rate-limit bucket per API key. Limits are enforced on three
ceilings, checked in order:

1. **Per-minute** (burst) — by key.
2. **Daily pool** — by consumer (overnight runaway protection).
3. **Monthly pool** — by consumer (billing-period budget).

## Per-minute ceilings by tier

| Tier | Per-minute |
|---|---|
| lite | 30 req/min |
| default | 60 req/min |
| b2b | 300 req/min |

Daily and monthly pools are plan-dependent (set on your key). Higher tiers also get a larger
per-request `limit` cap on `/v1/watchlist` and `/v1/signals`.

## Response headers

Every authenticated response includes:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Your per-minute ceiling. |
| `X-RateLimit-Remaining` | Requests left in the current minute. |
| `X-RateLimit-Reset` | ISO8601 time the minute window resets. |
| `X-RateLimit-Daily-Limit` / `-Daily-Remaining` / `-Daily-Reset` | Daily pool (when one applies). |
| `X-RateLimit-Monthly-Limit` / `-Monthly-Remaining` / `-Monthly-Reset` | Monthly pool (when one applies). |

The watchlist/alerts/signals/edgar responses also echo `rate_limit_remaining` and
`rate_limit_reset` in `meta`.

## When you exceed a limit

You get **HTTP 429** with a `Retry-After` header (seconds) and one of these codes:

| `code` | Ceiling |
|---|---|
| `rate_limit_exceeded` | per-minute |
| `daily_pool_exhausted` | daily pool |
| `monthly_pool_exhausted` | monthly pool |

Respect `Retry-After` and back off. The example clients in this repo
([`javascript/lib/client.js`](../javascript/lib/client.js),
[`python/bullalert_client.py`](../python/bullalert_client.py)) surface `retryAfter`/`retry_after`
on the thrown error so you can sleep precisely.

## Caching reduces your usage

Each endpoint is cached server-side, so polling faster than the cache window just returns the same
response without burning more of your real compute budget:

| Endpoint | Cache window |
|---|---|
| `/v1/watchlist` | 5 minutes (aligned to 5-min wall-clock boundaries) |
| `/v1/alerts` | 1 minute |
| `/v1/signals` | 1 minute |
| `/v1/edgar/:ticker` | 15 minutes |
| `/v1/health` | 60 seconds |

The watchlist recomputes only on 5-minute boundaries, so there is no benefit to polling it more
often than once every ~5 minutes. Conditional requests (ETag) return `304` and don't count against
your usage in a meaningful way.

> **Reliability note:** the limiter fails **open** — a transient database blip will let your request
> through rather than 429 you. Build for occasional bursts, not for a hard wall.
