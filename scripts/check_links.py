#!/usr/bin/env python3
"""Conservatively check StreamCloud home links and direct APK/XAPK downloads."""
from __future__ import annotations

import concurrent.futures
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
USER_AGENT = "StreamCloud-LinkStatusBot/2.0 (+scheduled directory link health check)"
TIMEOUT_SECONDS = 12
APK_ZIP_MAGIC = b"PK\\x03\\x04"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def extract_items(source: str, array_name: str) -> list[dict[str, object]]:
    match = re.search(rf"const\\s+{re.escape(array_name)}\\s*=\\s*\\[(.*?)\\n\\];", source, re.S)
    if not match:
        raise RuntimeError(f"Could not find the {array_name} catalog array in index.html")
    rows: list[dict[str, object]] = []
    # A catalog object may start with appType/kind before name; property order is not significant.
    for object_match in re.finditer(r"\\{([^{}]*)\\}", match.group(1), re.S):
        row = object_match.group(1)
        name_match = re.search(r'\\bname\\s*:\\s*"([^"]+)"', row)
        url_match = re.search(r'\\burl\\s*:\\s*"([^"]+)"', row)
        domain_match = re.search(r'\\bdomain\\s*:\\s*"([^"]+)"', row)
        if not (name_match and url_match and domain_match):
            continue
        item: dict[str, object] = {
            "name": name_match.group(1),
            "url": url_match.group(1),
            "domain": domain_match.group(1),
        }
        download_match = re.search(r'\\bdownloadUrl\\s*:\\s*"([^"]+)"', row)
        direct_match = re.search(r'\\bdownloadDirect\\s*:\\s*(true|false)', row)
        format_match = re.search(r'\\bdownloadFormat\\s*:\\s*"([^"]+)"', row)
        if download_match:
            item["download_url"] = download_match.group(1)
        if direct_match:
            item["download_direct"] = direct_match.group(1) == "true"
        if format_match:
            item["download_format"] = format_match.group(1).upper()
        rows.append(item)
    return rows


def _unknown(url: str, checked_at: str, reason: str) -> dict[str, object]:
    return {"status": "unknown", "http_status": None, "reason": reason,
            "checked_url": url, "checked_at": checked_at}


def check_url(url: str) -> dict[str, object]:
    """Check an app/website page; bot blocks and server errors remain unknown."""
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    request = urllib.request.Request(
        url, method="HEAD",
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
    )
    status_code: int | None = None
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        if status_code == 405:
            get_request = urllib.request.Request(
                url, method="GET",
                headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8", "Range": "bytes=0-0"},
            )
            try:
                with urllib.request.urlopen(get_request, timeout=TIMEOUT_SECONDS) as response:
                    status_code = response.getcode()
            except urllib.error.HTTPError as get_exc:
                status_code = get_exc.code
            except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as get_exc:
                return _unknown(url, checked_at, f"GET check could not verify link: {type(get_exc).__name__}")
    except (urllib.error.URLError, TimeoutError, socket.timeout, socket.gaierror, OSError) as exc:
        return _unknown(url, checked_at, f"Network check could not verify link: {type(exc).__name__}")

    if status_code in (404, 410):
        state, reason = "down", f"HTTP {status_code}"
    elif status_code is not None and 200 <= status_code < 400:
        state, reason = "up", f"HTTP {status_code}"
    else:
        state = "unknown"
        reason = f"HTTP {status_code}" if status_code is not None else "No HTTP response"
    return {"status": state, "http_status": status_code, "reason": reason,
            "checked_url": url, "checked_at": checked_at}


def check_download_url(url: str, declared_format: str = "APK") -> dict[str, object]:
    """Verify that the final response starts with the ZIP signature used by APK/XAPK files."""
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    request = urllib.request.Request(
        url, method="GET",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/vnd.android.package-archive,application/octet-stream,*/*;q=0.8",
            "Range": "bytes=0-3",
        },
    )
    status_code: int | None = None
    prefix = b""
    content_type = ""
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            status_code = response.getcode()
            content_type = (response.headers.get("Content-Type") or "").lower()
            prefix = response.read(4)
    except urllib.error.HTTPError as exc:
        status_code = exc.code
    except (urllib.error.URLError, TimeoutError, socket.timeout, socket.gaierror, OSError) as exc:
        return _unknown(url, checked_at, f"Download could not be verified: {type(exc).__name__}")

    if status_code in (404, 410):
        state, reason = "down", f"HTTP {status_code}"
    elif status_code is not None and 200 <= status_code < 400:
        if prefix.startswith(APK_ZIP_MAGIC):
            state, reason = "up", f"{declared_format.upper()} archive signature verified"
        else:
            state = "not_direct"
            reason = f"HTTP {status_code}; response is not an APK/XAPK ZIP archive"
            if content_type:
                reason += f" (Content-Type: {content_type})"
    else:
        # 401/403/412/429 and 5xx can be bot controls or temporary restrictions.
        state = "unknown"
        reason = f"HTTP {status_code}" if status_code is not None else "No HTTP response"
    return {"status": state, "http_status": status_code, "reason": reason,
            "checked_url": url, "checked_at": checked_at}


def main() -> None:
    source = HTML_PATH.read_text(encoding="utf-8")
    entries: dict[str, dict[str, object]] = {}
    checks: list[tuple[str, str, str, str, str]] = []

    for kind, array_name in (("site", "S"), ("app", "A"), ("music", "M"), ("site", "G")):
        for item in extract_items(source, array_name):
            name = str(item["name"])
            url = str(item["url"])
            key = f"{kind}:{slug(name)}"
            checks.append(("page", key, name, url, ""))
            if array_name in ("A", "M") and item.get("download_url"):
                download_key = f"download:{slug(name)}"
                if item.get("download_direct") is True:
                    checks.append(("download", download_key, name, str(item["download_url"]),
                                   str(item.get("download_format") or "APK")))
                else:
                    # A listed page is not claimed to be a direct binary; retain reachability info only.
                    checks.append(("page", download_key, name, str(item["download_url"]), ""))

    def run(check: tuple[str, str, str, str, str]):
        kind, key, name, url, fmt = check
        result = check_download_url(url, fmt) if kind == "download" else check_url(url)
        return kind, key, name, result, fmt

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(run, check) for check in checks]
        for future in concurrent.futures.as_completed(futures):
            kind, key, name, result, fmt = future.result()
            entry_kind = "download" if kind == "download" else key.split(":", 1)[0]
            entry: dict[str, object] = {"name": name, "kind": entry_kind, **result}
            if kind == "download":
                entry["format"] = fmt
            entries[key] = entry
            print(f"{key}: {result['status']} ({result['reason']})")

    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entries": dict(sorted(entries.items())),
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\\n", encoding="utf-8")
    print(f"Wrote {len(entries)} page/download checks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
