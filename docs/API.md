# BullAlert API reference

Base URL: `https://api.bullalert.ai`
Auth: send your key in the **`x-ba-api-key`** header on every `/v1/*` request.
Get a key from the dashboard → Account → API: <https://bullalert.ai/dashboard>.

> **Informational only — not financial advice.** BullAlert is a data / intelligence tool, not a
> brokerage or advisor. The API publishes **derived IP** — a 0-100 score, a `momentum`/`watch`
> status — plus **public-domain SEC EDGAR** facts. It does **not** return raw prices, percentages,
> volume, or RVOL. You compute your own decisions. See [`DISCLAIMER.md`](./DISCLAIMER.md).

Every endpoint returns a `{ "data": ..., "meta": ... }` envelope (the SEC endpoint nests its
payload directly under `data`). Errors use `{ "error": { "code", "message" } }` — see
[Error codes](#error-codes).

## Endpoints at a glance

| Method | Path | Auth | Cache | Purpose |
|---|---|---|---|---|
| GET | `/v1/health` | none | 60s | Liveness probe. |
| GET | `/v1/watchlist` | key | 5 min | Ranked momentum board (our IP). |
| GET | `/v1/alerts` | key | 1 min | Published-alert record (identity + time). |
| GET | `/v1/signals` | key | 1 min | Validated candidate breadth feed. |
| GET | `/v1/edgar/:ticker` | key | 15 min | SEC-EDGAR company intelligence (public domain). |
| POST | `/v1/mcp` | key | — | MCP JSON-RPC server (4 tools). |

---

## GET /v1/health

No auth. Liveness/version probe.

```json
{ "data": { "status": "ok", "version": "v1", "uptime_sec": 12345 } }
```

---

## GET /v1/watchlist

The ranked momentum board — BullAlert's core derived IP.

**Query params**

| Param | Values | Default | Notes |
|---|---|---|---|
| `session` | `pre_market` \| `market` \| `after_hours` \| `all` \| `current` | `current` | `current` auto-resolves to the active ET session. |
| `limit` | `1`–`100` | `10` | Capped by your plan's max limit. |
| `status` | `momentum` \| `watch` \| `all` | `all` | Cohort filter; ranked momentum-first. |
| `as_of` | ISO8601 timestamp | — | Historical replay (data back to 2026-02-19 alerts / 2026-04-20 firehose). |

**Row fields**

| Field | Type | Meaning |
|---|---|---|
| `rank` | int | 1-based rank in the response. |
| `ticker` | string | The symbol. |
| `score` | int `0`–`100` | Derived momentum score (our IP — not a price/%/RVOL). |
| `status` | `momentum` \| `watch` | `momentum` = cleared all admission gates this refresh; `watch` = informational fill-back. |

Sorted momentum-first, then score descending. The board always returns up to `limit` rows (filled
back with `watch` rows on quiet days).

**Meta**: `timestamp`, `api_version`, `algorithm_version`, `session`, `count`, `momentum_count`,
`data_freshness_seconds`, `daily_as_of`, `rate_limit_remaining`, `rate_limit_reset`,
`mtf_enabled`, and — only when not fully live — `market_status` (`closed` | `delayed`) + `message`.

Outside ~8am–5pm ET on weekdays the board returns an **empty** `data.watchlist` with
`meta.market_status = "closed"`.

```jsonc
{
  "data": { "watchlist": [ { "rank": 1, "ticker": "WCT", "score": 88, "status": "momentum" } ] },
  "meta": { "session": "market", "count": 10, "momentum_count": 4, "algorithm_version": "v1.1.0" }
}
```

---

## GET /v1/alerts

The published-alert record — which tickers BullAlert flagged, and when. Identity + timing only.

**Query params**

| Param | Values | Default |
|---|---|---|
| `session` | `pre_market` \| `market` \| `after_hours` \| `all` \| `current` | `current` |
| `as_of` | ISO8601 timestamp | — |

No `limit` or `status` params (a day holds at most a handful of alerts). Session lives in
`meta.session`, not per row.

**Row fields**

| Field | Type | Meaning |
|---|---|---|
| `ticker` | string | The flagged symbol. |
| `caught_at` | ISO8601 UTC string \| null | When BullAlert caught it. |

Sorted newest-first. **Meta**: `timestamp`, `api_version`, `algorithm_version`, `session`,
`scan_date`, `count`, plus rate-limit fields.

```jsonc
{
  "data": { "alerts": [ { "ticker": "DXST", "caught_at": "2026-06-05T14:02:11.085Z" } ] },
  "meta": { "session": "market", "scan_date": "2026-06-05", "count": 3 }
}
```

---

## GET /v1/signals

The validated candidate breadth feed — every $0.20–$20 small-cap our scanner validated this
session (hundreds of rows). Strategy-agnostic; identity + catch-time + session only.

**Query params**

| Param | Values | Default | Notes |
|---|---|---|---|
| `session` | `pre_market` \| `market` \| `after_hours` \| `all` \| `current` | `current` | |
| `limit` | `1`–`100` | `50` | Page size (capped by plan). |
| `offset` | `>= 0` | `0` | Paginate the session pool. |
| `as_of` | ISO8601 timestamp | — | Replay a settled session (back to 2026-04-20). |

**Row fields**

| Field | Type | Meaning |
|---|---|---|
| `ticker` | string | The candidate symbol. |
| `caught_at` | ISO8601 UTC string \| null | First caught this session. |
| `session` | `pre_market` \| `market` \| `after_hours` | The session window. |

Sorted `caught_at` descending (freshest first). Paginate with `offset` until a page returns fewer
than `limit` rows. **Meta** adds `limit`, `offset`, `scan_date`, and `market_status` when closed.

```jsonc
{
  "data": { "signals": [ { "ticker": "GXAI", "caught_at": "2026-06-05T13:31:02.000Z", "session": "market" } ] },
  "meta": { "session": "market", "count": 50, "limit": 50, "offset": 0, "scan_date": "2026-06-05" }
}
```

---

## GET /v1/edgar/:ticker

SEC-EDGAR company intelligence — **public-domain** filing data (raw values OK here; this is the one
endpoint not under the derived-IP output rules). `:ticker` is 1–8 chars `[A-Z0-9.-]`.

**Query params**

| Param | Values | Notes |
|---|---|---|
| `detail` | `true` | Adds a `raw` block (numbers + provenance + full recent filings). |
| `as_of` | `YYYY-MM-DD` or ISO8601 | Point-in-time: only filings filed on/before that date. |

**Lean `data`**

```jsonc
{
  "ticker": "LASE",
  "company": "Laser Photonics Corp",
  "as_of": "2026-05-14",
  "snapshot": {            // pre-formatted strings or null (NOT raw numbers)
    "revenue_ttm": "$6.3B",
    "net_income_ttm": "-$12.0M",
    "eps": "-$0.41",
    "cash": "$8.0M",
    "debt": "$1.2M",
    "shares_out": "21.0M",
    "net_margin": "+9%"
  },
  "signals": {
    "share_growth_1y": "+2.1%",        // string | null
    "runway": "24 mo",                 // "<n> mo" | "cash-flow positive" | null
    "insider": "net buying",           // net buying | net selling | neutral | no recent activity
    "flags": ["material_agreement"]    // factual 8-K disclosure slugs (see below)
  },
  "latest_filing": { "form": "8-K", "filed": "2026-05-14", "headline": "...", "url": "https://www.sec.gov/..." }
}
```

**Flag slugs** are factual 8-K / disclosure subjects — never a verdict:
`going_concern`, `equity_offering_filed`, `material_agreement`, `acquisition_completed`,
`change_of_control`, `bankruptcy_filing`, `listing_rule_notice`, `non_reliance`.

**Meta** carries `source: "SEC EDGAR (public domain)"`, a `disclaimer`, `cik`, `as_of`,
`as_of_requested`, `algorithm_version`, cache flags, and rate-limit fields.

> Dilution is presented as a **fact** (share-count growth + offering filings), not a high/low
> verdict — high-dilution names historically perform as well as low-dilution ones. Read the filings
> and decide for yourself.

---

## POST /v1/mcp

A Model Context Protocol (MCP) JSON-RPC 2.0 server. Same `x-ba-api-key` auth and the same shared
rate-limit bucket. Exposes 4 tools, each returning the same JSON as its REST sibling:

| Tool | Args | REST sibling |
|---|---|---|
| `list_watchlist` | `session`, `limit`, `status?`, `as_of?` | `/v1/watchlist` |
| `list_signals` | `session`, `limit`, `offset?`, `as_of?` | `/v1/signals` |
| `list_alerts` | `session`, `as_of?` | `/v1/alerts` |
| `get_company_financials` | `ticker`, `detail?`, `as_of?` | `/v1/edgar/:ticker` |

Discovery: `GET /.well-known/oauth-protected-resource` advertises **no auth server**
(`authorization_servers: []`) → clients use the static `x-ba-api-key` header. See
[`../mcp/`](../mcp/) for ready-to-use client configs.

---

## Error codes

All error bodies share the shape `{ "error": { "code", "message" } }`.

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_params` | Bad query param (e.g. `limit` out of range, malformed `as_of`/ticker). |
| 401 | `missing_key` | No `x-ba-api-key` header. |
| 401 | `invalid_key` | Key is invalid or revoked. |
| 402 | `subscription_inactive` | Subscription not active. |
| 402 | `billing_suspended` | Billing suspended. |
| 402 | `contract_expired` | B2B contract ended. |
| 404 | `unresolved_ticker` | (edgar) Ticker is not an SEC filer. |
| 429 | `rate_limit_exceeded` | Per-minute limit hit (see `Retry-After`). |
| 429 | `daily_pool_exhausted` | Daily request pool used up. |
| 429 | `monthly_pool_exhausted` | Monthly request pool used up. |
| 503 | `upstream_unavailable` | (edgar) SEC EDGAR temporarily unavailable; retry. |
| 500 | `internal_error` | Unexpected server error. |

See [`RATE_LIMITS.md`](./RATE_LIMITS.md) for the rate-limit headers and tier ceilings.
