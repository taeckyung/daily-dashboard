# daily-dashboard

Chrome new-tab extension plus accumulated data file. A scheduled Claude session updates `data/data.json` once per day; the extension reads `data/data.json` from GitHub.

## Layout

| Path | Role |
|---|---|
| `extension/` | Manifest V3 extension, plain HTML/CSS/JS, no build step |
| `data/data.json` | Accumulated data. Edit through `scripts/merge.py` only |
| `scripts/merge.py` | Merge one day's findings into `data/data.json` |
| `scripts/test_merge.py` | Tests for `scripts/merge.py` |

## Daily update procedure

1. When the clone is missing, clone with `git clone git@github.com:taeckyung/daily-dashboard.git` (HTTPS clone fails on auth).
2. Run `git pull --ff-only origin main`.
3. Read `data/data.json`. Reuse the existing `id` for every item already listed.
4. Search the web for both topics (see Search scope).
5. Write the findings file to `.claude/tmp/findings.json` (see Findings schema).
6. Run `python3 scripts/merge.py .claude/tmp/findings.json`.
7. Run `python3 -m unittest discover -s scripts`. When a test fails, stop and report; no commit.
8. Commit `data/data.json` only, message `data: YYYY-MM-DD update`, push to `main`.
9. Report new, changed, and closing-soon items in the conversation.

## Search scope

- `jobs`: PhD-level AI research positions in Korea and 전문연구요원 positions. Always check: 삼성리서치, SAIT, LG전자, LG AI Research, 삼성메디슨, HD현대로보틱스.
- `gpu`: Korean GPU support programs. Government (과기정통부, NIPA, IITP, NIA, 국가AI컴퓨팅센터, 지자체) and corporate (cloud, telecom, large-company GPU credit or research support).

## Findings schema

```json
{
  "date": "2026-11-14",
  "summary": "one-line Korean summary of the day's changes",
  "jobs": [{
    "id": "lg-ai-research-phd-2026", "company": "LG AI Research", "title": "...",
    "qualification": "...", "jeonmun": "가능 | 불가 | 미확인",
    "deadline": "2026-11-30", "deadline_text": "상시", "url": "https://...", "note": "..."
  }],
  "gpu": [{
    "id": "nipa-gpu-2026-4q", "name": "...", "org": "NIPA", "kind": "정부 | 기업", "univ": "가능 | 불가 | 미확인",
    "target": "...", "scale": "...", "deadline": "2026-11-20", "url": "https://...", "note": "..."
  }]
}
```

## Findings rules

- `date`: run date in Asia/Seoul, `YYYY-MM-DD`.
- Required: `id`, `url`, plus `company` and `title` (jobs) or `name` and `org` (gpu).
- `id`: stable lowercase slug. Changing the `id` of an existing item prohibited.
- `url`: the original posting, `http(s)` only.
- `deadline`: `YYYY-MM-DD` or `null`. When the posting is rolling, use `null` and set `deadline_text`.
- `univ` (gpu): whether universities or university labs are eligible applicants. Set on every gpu item.
- The extension displays only jobs with `jeonmun` = `가능` and gpu items with `univ` = `가능`. Collect all items regardless; filtering is display-only.
- Include only facts confirmed on the original posting. When 전문연 eligibility is unconfirmed, use `미확인`.
- Include every currently open item found, including items already in `data/data.json`.
- When a posting was taken down before the deadline, include the item with `"status": "closed"`.
- Deleting items from `data/data.json` prohibited. Items accumulate; expired items close automatically.
- Hand-editing `data/data.json` prohibited.
