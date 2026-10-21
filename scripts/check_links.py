#!/usr/bin/env python3
"""Check MahiFlix directory links conservatively; anti-bot responses are not marked down."""
from __future__ import annotations

import json
import re
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
OUTPUT_PATH = ROOT / "link-status.json"
USER_AGENT = "MahiFlix-LinkStatusBot/1.0 (+scheduled directory link health check)"
TIMEOUT_SECONDS = 12


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value


def extract_items(source: str, array_name: str) -> list[dict[str, str]]:
    match = re.search(rf"const\s+{re.escape(array_name)}\s*=\s*\[(.*?)\n\];", source, re.S)
    if not match:
        raise RuntimeError(f"Could not find the {array_name} catalog array in index.html")
    rows = re.findall(
        r'\{\s*name:"([^"]+)",url:"([^"]+)",domain:"([^"]+)"',
        match.group(1),
    )
    return [{"name": name, "url": url, "domain": domain} for name, url, domain in rows]


def check_url(url: str) -> dict[str, object]:
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
    )
    status_code: int | None = None
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        if status_code == 405:
            # A HEAD rejection is common; try a tiny ranged GET before concluding anything.
            get_request = urllib.request.Request(
                url,
                method="GET",
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "text/html,*/*;q=0.8",
                    "Range": "bytes=0-0",
                },
            )
            try:
                with urllib.request.urlopen(get_request, timeout=TIMEOUT_SECONDS) as response:
                    status_code = response.getcode()
            except urllib.error.HTTPError as get_exc:
                status_code = get_exc.code
            except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as get_exc:
                return {
                    "status": "unknown",
                    "http_status": None,
                    "reason": f"GET check could not verify link: {type(get_exc).__name__}",
                    "checked_url": url,
                    "checked_at": checked_at,
                }
    except (urllib.error.URLError, TimeoutError, socket.timeout, socket.gaierror, OSError) as exc:
        # Transient DNS/network failures are not enough evidence to label a link as dead.
        return {
            "status": "unknown",
            "http_status": None,
            "reason": f"Network check could not verify link: {type(exc).__name__}",
            "checked_url": url,
            "checked_at": checked_at,
        }

    if status_code in (404, 410):
        state = "down"
        reason = f"HTTP {status_code}"
    elif status_code is not None and 200 <= status_code < 400:
        state = "up"
        reason = f"HTTP {status_code}"
    else:
        # 401/403/429 and server errors can be anti-bot or temporary restrictions.
        state = "unknown"
        reason = f"HTTP {status_code}" if status_code is not None else "No HTTP response"
    return {
        "status": state,
        "http_status": status_code,
        "reason": reason,
        "checked_url": url,
        "checked_at": checked_at,
    }


def main() -> None:
    source = HTML_PATH.read_text(encoding="utf-8")
    entries: dict[str, dict[str, object]] = {}
    for kind, array_name in (("site", "S"), ("app", "A")):
        for item in extract_items(source, array_name):
            # App entries point to an internal detail/download route; check the listed source domain.
            url = item["url"] if item["url"].startswith(("https://", "http://")) else f"https://{item['domain']}/"
            key = f"{kind}:{slug(item['name'])}"
            result = check_url(url)
            entries[key] = {"name": item["name"], "kind": kind, **result}
            print(f"{key}: {result['status']} ({result['reason']})")

    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entries": entries,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} link checks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
