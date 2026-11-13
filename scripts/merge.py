"""Merge one day's search findings into data/data.json.

Items are never deleted: every run upserts by id (or url) and appends a run
record, so the file accumulates the full history.

Usage: python3 scripts/merge.py <findings.json> [data.json]
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "data.json"
CATEGORIES = ("jobs", "gpu")
REQUIRED_FIELDS = {
    "jobs": ("id", "company", "title", "url"),
    "gpu": ("id", "name", "org", "url"),
}
TRACKED_FIELDS = ("deadline", "deadline_text", "status", "jeonmun", "scale")
META_FIELDS = ("first_seen", "last_seen", "changes")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://", re.IGNORECASE)
EMPTY_DATA = {"updated_at": None, "runs": [], "jobs": [], "gpu": []}


class FindingsError(ValueError):
    """Raised when a findings file does not match the schema."""


def validate_item(category, item):
    for field in REQUIRED_FIELDS[category]:
        if not str(item.get(field) or "").strip():
            raise FindingsError(f"{category}: missing '{field}' in {item!r}")
    if not URL_RE.match(item["url"]):
        raise FindingsError(f"{category}/{item['id']}: url must be http(s)")
    deadline = item.get("deadline")
    if deadline is not None and not DATE_RE.match(str(deadline)):
        raise FindingsError(f"{category}/{item['id']}: deadline must be YYYY-MM-DD or null")
    if item.get("status", "open") not in ("open", "closed"):
        raise FindingsError(f"{category}/{item['id']}: status must be open or closed")


def validate_findings(findings):
    if not DATE_RE.match(str(findings.get("date", ""))):
        raise FindingsError("findings.date must be YYYY-MM-DD")
    for category in CATEGORIES:
        ids = [item.get("id") for item in findings.get(category, [])]
        if len(ids) != len(set(ids)):
            raise FindingsError(f"{category}: duplicate ids in findings")
        for item in findings.get(category, []):
            validate_item(category, item)


def find_existing(items, incoming):
    for item in items:
        if item["id"] == incoming["id"]:
            return item
    for item in items:
        if item["url"] == incoming["url"]:
            return item
    return None


def diff_changes(old, new, date):
    return [
        {"date": date, "field": field, "from": old.get(field), "to": new.get(field)}
        for field in TRACKED_FIELDS
        if field in new and old.get(field) != new.get(field)
    ]


def upsert(items, incoming, date):
    """Return (new item list, kind) where kind is 'new', 'changed' or 'same'."""
    payload = {k: v for k, v in incoming.items() if k not in META_FIELDS}
    payload.setdefault("status", "open")
    old = find_existing(items, incoming)
    if old is None:
        created = {**payload, "first_seen": date, "last_seen": date, "changes": []}
        return [*items, created], "new"
    changes = diff_changes(old, payload, date)
    updated = {
        **old,
        **payload,
        "id": old["id"],
        "last_seen": date,
        "changes": [*old.get("changes", []), *changes],
    }
    merged = [updated if item is old else item for item in items]
    return merged, "changed" if changes else "same"


def expire(items, date):
    """Close open items whose deadline has passed."""
    result = []
    for item in items:
        expired = item.get("status") == "open" and item.get("deadline") and item["deadline"] < date
        if expired:
            change = {"date": date, "field": "status", "from": "open", "to": "closed"}
            item = {**item, "status": "closed", "changes": [*item.get("changes", []), change]}
        result.append(item)
    return result


def merge(data, findings, now_iso):
    """Pure merge: returns a new data dict, inputs stay untouched."""
    validate_findings(findings)
    date = findings["date"]
    result = {**EMPTY_DATA, **data, "updated_at": now_iso}
    run = {"date": date, "summary": findings.get("summary", ""), "new": {}, "changed": {}}
    for category in CATEGORIES:
        items = list(result.get(category, []))
        new_ids, changed_ids = [], []
        for incoming in findings.get(category, []):
            items, kind = upsert(items, incoming, date)
            stored_id = find_existing(items, incoming)["id"]
            if kind == "new":
                new_ids.append(stored_id)
            elif kind == "changed":
                changed_ids.append(stored_id)
        result[category] = expire(items, date)
        run["new"][category] = new_ids
        run["changed"][category] = changed_ids
    result["runs"] = merge_run(result.get("runs", []), run)
    return result


def merge_run(runs, run):
    """Newest first. A rerun on the same date keeps that date's earlier ids."""
    previous = next((r for r in runs if r["date"] == run["date"]), None)
    if previous:
        for key in ("new", "changed"):
            for category in CATEGORIES:
                earlier = previous.get(key, {}).get(category, [])
                combined = [*earlier, *[i for i in run[key][category] if i not in earlier]]
                run[key][category] = combined
        run["changed"] = {
            c: [i for i in run["changed"][c] if i not in run["new"][c]] for c in CATEGORIES
        }
    others = [r for r in runs if r["date"] != run["date"]]
    return sorted([run, *others], key=lambda r: r["date"], reverse=True)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    findings_path = Path(argv[1])
    data_path = Path(argv[2]) if len(argv) > 2 else DEFAULT_DATA_PATH
    findings = json.loads(findings_path.read_text(encoding="utf-8"))
    data = json.loads(data_path.read_text(encoding="utf-8")) if data_path.exists() else EMPTY_DATA
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    merged = merge(data, findings, now_iso)
    data_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    run = merged["runs"][0] if merged["runs"][0]["date"] == findings["date"] else None
    counts = {c: len(merged[c]) for c in CATEGORIES}
    print(f"merged {findings['date']}: totals={counts} run={run and {'new': run['new'], 'changed': run['changed']}}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
