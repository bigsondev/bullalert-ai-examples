"""Small client for the BullAlert API (https://api.bullalert.ai).

Reads the API key from the BULLALERT_API_KEY environment variable and sends it
in the ``x-ba-api-key`` header. Raises a typed ``BullAlertError`` so callers can
handle 401 / 402 / 429 cleanly.

BullAlert is an informational / data tool, NOT financial advice. The API returns
DERIVED intelligence (a 0-100 score, a momentum/watch status, SEC public-domain
filing facts) -- never raw prices, percentages, or volume.

Dependencies: ``requests`` (see requirements.txt). Stdlib only otherwise.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import requests

DEFAULT_BASE_URL = "https://api.bullalert.ai"

_FRIENDLY = {
    "missing_key": "No API key sent. Set BULLALERT_API_KEY (see .env.example).",
    "invalid_key": "API key is invalid or revoked. Generate a new one in the dashboard.",
    "subscription_inactive": "Your BullAlert subscription is not active. Resume it to use the API.",
    "billing_suspended": "Billing is suspended. Contact partners@bullalert.ai.",
    "contract_expired": "Your contract has ended. Contact partners@bullalert.ai to renew.",
    "rate_limit_exceeded": "Per-minute rate limit hit. Slow down and respect Retry-After.",
    "daily_pool_exhausted": "Daily request pool exhausted. Resets at UTC midnight.",
    "monthly_pool_exhausted": "Monthly request pool exhausted. Resets next month.",
    "unresolved_ticker": "Ticker is not an SEC filer (or unknown).",
    "upstream_unavailable": "SEC EDGAR is temporarily unavailable. Retry shortly.",
    "invalid_params": "One or more query parameters were invalid.",
}


class BullAlertError(Exception):
    """An API error with the typed ``code`` attached."""

    def __init__(self, message: str, *, status: int | None = None,
                 code: str | None = None, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.retry_after = retry_after


def load_dotenv() -> None:
    """Load KEY=value pairs from a .env file (repo root or ./.env) into os.environ.

    Zero-dependency; does NOT overwrite variables already set in the real
    environment, so shell exports / CI take precedence. Copy .env.example to .env
    and fill in BULLALERT_API_KEY to use it.
    """
    here = Path(__file__).resolve().parent
    for path in (here.parent / ".env", here / ".env"):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            if value[:1] in {'"', "'"} and value[-1:] == value[:1]:
                value = value[1:-1]
            os.environ.setdefault(key, value)


class BullAlertClient:
    """Thin wrapper over the BullAlert REST API."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("BULLALERT_API_KEY")
        self.base_url = (base_url or os.environ.get("BULLALERT_API_BASE") or DEFAULT_BASE_URL).rstrip("/")
        if not self.api_key:
            raise BullAlertError(_FRIENDLY["missing_key"], status=401, code="missing_key")
        self._session = requests.Session()
        self._session.headers.update({"x-ba-api-key": self.api_key, "accept": "application/json"})
        # Most-recent rate-limit headers, refreshed after every request.
        self.rate_limit: dict[str, Any] = {"remaining": None, "reset": None, "limit": None}

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Low-level GET. Drops None/empty params; returns the parsed JSON body."""
        clean = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        resp = self._session.get(self.base_url + path, params=clean, timeout=30)
        self._capture_rate_limit(resp)

        try:
            body = resp.json()
        except ValueError:
            body = None

        if not resp.ok:
            code = (body or {}).get("error", {}).get("code", "http_error")
            message = _FRIENDLY.get(code) or (body or {}).get("error", {}).get("message") or f"HTTP {resp.status_code}"
            retry = resp.headers.get("retry-after")
            raise BullAlertError(
                message,
                status=resp.status_code,
                code=code,
                retry_after=int(retry) if retry and retry.isdigit() else None,
            )
        return body or {}

    def _capture_rate_limit(self, resp: requests.Response) -> None:
        h = resp.headers
        if "x-ratelimit-remaining" in h:
            self.rate_limit["remaining"] = int(h["x-ratelimit-remaining"])
        if "x-ratelimit-reset" in h:
            self.rate_limit["reset"] = h["x-ratelimit-reset"]
        if "x-ratelimit-limit" in h:
            self.rate_limit["limit"] = int(h["x-ratelimit-limit"])

    # -- Endpoint helpers; each returns the parsed {"data": ..., "meta": ...} envelope. --

    def health(self) -> dict[str, Any]:
        return self.get("/v1/health")

    def watchlist(self, *, session: str | None = None, limit: int | None = None,
                  status: str | None = None, as_of: str | None = None) -> dict[str, Any]:
        return self.get("/v1/watchlist", {"session": session, "limit": limit,
                                          "status": status, "as_of": as_of})

    def alerts(self, *, session: str | None = None, as_of: str | None = None) -> dict[str, Any]:
        return self.get("/v1/alerts", {"session": session, "as_of": as_of})

    def signals(self, *, session: str | None = None, limit: int | None = None,
                offset: int | None = None, as_of: str | None = None) -> dict[str, Any]:
        return self.get("/v1/signals", {"session": session, "limit": limit,
                                        "offset": offset, "as_of": as_of})

    def edgar(self, ticker: str, *, detail: bool | None = None, as_of: str | None = None) -> dict[str, Any]:
        t = ticker.upper()
        return self.get(f"/v1/edgar/{t}", {"detail": "true" if detail else None, "as_of": as_of})
