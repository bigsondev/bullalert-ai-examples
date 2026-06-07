# Add BullAlert to ChatGPT (custom connector / MCP)

BullAlert ships a hosted **MCP (Model Context Protocol)** server, so ChatGPT — and any other
MCP-capable agent — can query your momentum data and SEC filings in natural language. No glue
code, no scraping.

> **Informational only — not financial advice.** BullAlert is a data / intelligence tool. The
> tools return derived intelligence (a 0-100 score, a `momentum`/`watch` status, public-domain
> SEC filing facts), never raw prices or volume.

## Connection details

| Field | Value |
|---|---|
| MCP server URL | `https://api.bullalert.ai/v1/mcp` |
| Transport | Streamable HTTP (JSON-RPC 2.0) |
| Auth | Static API key in the `x-ba-api-key` header (no OAuth) |
| API key | From the dashboard → Account → API: <https://bullalert.ai/dashboard> |

The server advertises `GET /.well-known/oauth-protected-resource` with **no authorization server**
(`authorization_servers: []`), which tells MCP clients to fall back to the static `x-ba-api-key`
header. There is no OAuth login flow.

## How to add it

ChatGPT's connector UI evolves, so follow whichever path your plan exposes (custom connectors /
MCP are generally available on Plus/Pro/Team/Enterprise tiers):

1. Open **Settings → Connectors** (or **Settings → Apps & Connectors**) → **Add / Create custom connector**.
2. Choose the **MCP server** option.
3. Set the **Server URL** to `https://api.bullalert.ai/v1/mcp`.
4. For authentication, choose **API key / custom header** and add a header:
   `x-ba-api-key: <your key>`. (If your build only offers a single "API key" field, that field is
   sent as `x-ba-api-key`.)
5. Save, then enable the **bullalert** connector in a chat (the tools menu / + menu).

If your ChatGPT build does not yet support custom MCP connectors, the same server works today in
**Claude Desktop**, **Claude Code**, and **Cursor** — see [`claude-desktop.json`](./claude-desktop.json)
and [`cursor.json`](./cursor.json).

## The 4 tools

| Tool | Args | Returns |
|---|---|---|
| `list_watchlist` | `session`, `limit`, `status?`, `as_of?` | Ranked board: `{ rank, ticker, score, status }`. |
| `list_signals` | `session`, `limit`, `offset?`, `as_of?` | Validated candidate breadth feed: `{ ticker, caught_at, session }`. |
| `list_alerts` | `session`, `as_of?` | Published-alert record: `{ ticker, caught_at }`. |
| `get_company_financials` | `ticker`, `detail?`, `as_of?` | SEC-EDGAR snapshot + dilution/runway/insider/flags. |

Each tool returns the same JSON as its REST sibling (`/v1/watchlist`, `/v1/signals`, `/v1/alerts`,
`/v1/edgar/:ticker`). See [`README.md`](./README.md) for prompt recipes and
[`../docs/API.md`](../docs/API.md) for full field definitions.
