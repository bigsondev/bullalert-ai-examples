# BullAlert MCP server — talk to your momentum data

BullAlert hosts a **Model Context Protocol (MCP)** server so AI agents — Claude Desktop, Claude
Code, Cursor, ChatGPT, Lindy, and any other MCP client — can query small-cap momentum data and
SEC filings in plain English.

- **Server URL:** `https://api.bullalert.ai/v1/mcp`
- **Transport:** Streamable HTTP (JSON-RPC 2.0)
- **Auth:** static API key in the `x-ba-api-key` header (no OAuth) — get one at
  [bullalert.ai/dashboard](https://bullalert.ai/dashboard) → Account → API

> **Informational only — not financial advice.** The tools return derived intelligence (a 0-100
> score, a `momentum`/`watch` status, public-domain SEC filing facts), never raw prices or volume.

## Setup files

| Client | File | Notes |
|---|---|---|
| Claude Desktop / Claude Code | [`claude-desktop.json`](./claude-desktop.json) | Merge `mcpServers` into your config, set the key, restart. |
| Cursor | [`cursor.json`](./cursor.json) | Put in `.cursor/mcp.json`, set the key, enable in Settings → MCP. |
| ChatGPT | [`chatgpt.md`](./chatgpt.md) | Add as a custom MCP connector with the `x-ba-api-key` header. |

## The 4 tools

| Tool | Args | What it answers |
|---|---|---|
| `list_watchlist` | `session`, `limit`, `status?`, `as_of?` | "What's ranked on the momentum board right now?" |
| `list_signals` | `session`, `limit`, `offset?`, `as_of?` | "What's the full validated candidate pool this session?" |
| `list_alerts` | `session`, `as_of?` | "Which tickers did BullAlert flag today, and when?" |
| `get_company_financials` | `ticker`, `detail?`, `as_of?` | "What do this company's SEC filings show — dilution, runway, insider, 8-Ks?" |

## Prompt recipes

Once the connector is enabled, just ask:

- **Board scan** — *"Use BullAlert to list the top 10 momentum-status tickers right now, with their scores."*
- **Breadth** — *"Pull the BullAlert signals feed for the current session and group it by session window."*
- **Funnel** — *"For each momentum ticker on the BullAlert watchlist, tell me whether it also shows up in today's published alerts."*
- **Due diligence** — *"Get the SEC-EDGAR financials for LASE via BullAlert and summarize the dilution and runway. Frame it as research context, not advice."*
- **Risk context** — *"List BullAlert momentum tickers, then for each one check SEC filings for an equity_offering_filed or going_concern flag. Present it as factual context I should read before deciding anything — not a recommendation."*
- **Historical replay** — *"Replay the BullAlert watchlist as of 2026-06-05 at 15:00 UTC and compare it to now."*

The agent decides which tool to call and with what arguments; you talk to your data in natural
language. Remember: BullAlert is an intelligence tool — every output is informational, and your
decisions are your own.
