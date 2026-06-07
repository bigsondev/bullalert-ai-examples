# Disclaimer

> Full disclaimer: https://bullalert.ai/disclaimer

**BullAlert is an informational data / intelligence tool. It is not financial advice, not
investment advice, not a recommendation, and not a brokerage or trading service.**

Everything in this repository and everything the BullAlert API returns is provided for
informational and educational purposes only. Nothing here is a solicitation, offer, or
recommendation to buy, sell, or hold any security. You are solely responsible for your own
decisions. **Do your own research** and consider consulting a licensed financial professional.

## What the API publishes

The BullAlert API publishes **derived intelligence** plus **public-domain SEC data**:

- A **momentum score** (an integer `0`–`100`) — a proprietary composite, not a price or percentage.
- A **status** of `momentum` or `watch` — a derived classification, not a buy/sell label.
- **Identity + timing** of validated candidates and published alerts (ticker, catch time, session).
- **SEC EDGAR** company facts (financial snapshot, dilution context, runway, insider direction,
  factual 8-K disclosure flags) — sourced from public-domain filings.

The API does **not** publish raw prices, percentage moves, trading volume, relative volume (RVOL),
bid/ask, or any reverse-engineerable market-data values. The score and status are non-reversible
derived outputs.

## SEC data

SEC EDGAR data is in the **public domain**. The `/v1/edgar/:ticker` endpoint surfaces facts from
companies' own filings (10-K, 10-Q, 8-K, Form 4, registration statements). These describe **what a
company filed** — never a judgment. For example, an `equity_offering_filed` flag means an offering
document was filed, not that the stock is "good" or "bad". Dilution is presented as a fact
(share-count growth and offering filings), not as a high/low verdict — high-dilution names
historically perform as well as low-dilution ones. **BullAlert is not affiliated with or endorsed
by the U.S. Securities and Exchange Commission.**

## No warranty

The data is provided "as is," without warranty of any kind. Markets are risky; past behavior does
not predict future results. BullAlert makes no guarantee of accuracy, completeness, timeliness, or
fitness for any particular purpose, and is not liable for any loss arising from use of the API or
these examples. See [`../LICENSE`](../LICENSE).

## "Momentum trader style"

Some examples describe building a "momentum trader style" application. That phrase refers to the
**kind of app you can build** on top of this informational data — it is not advice to trade and not
a claim that any output is actionable. The `status` values are deliberately `momentum` / `watch`,
never "trade" or "buy".
