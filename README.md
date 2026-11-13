# Daily Dashboard

**TL;DR**: A Chrome new-tab page that shows PhD-level AI research openings (including 전문연구요원 positions) and Korean GPU support programs. A scheduled Claude session refreshes the data every day and the history keeps accumulating.

## How it works

```
Scheduled Claude session (daily, 08:34 KST)
    |  web search -> findings.json -> scripts/merge.py
    v
data/data.json on GitHub (main branch)
    |  GitHub contents API over HTTPS
    v
Chrome extension (new tab) -> local cache -> rendered page
```

The extension talks only to `api.github.com`, so it works on any network. No VPN or Tailscale is needed. The last fetched data is cached in the browser, so a new tab still renders when you are offline.

## Install

1. Clone this repository, or download it as a ZIP and extract it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` folder.
4. Open a new tab.

To pick up extension code changes later, pull the repository and click the reload icon on the extension card. Data updates need no action.

### Private repository

If this repository is private, the extension needs a token to read the data.

1. Create a fine-grained personal access token on GitHub: repository access limited to this repository, permission **Contents: Read-only**.
2. On the new tab, click **설정**, paste the token, and save.

The token is stored only in this browser's extension storage.

## What the page shows

| Area | Content |
|---|---|
| Summary | Counts of new, closing soon (within 7 days), open, and total items |
| AI 연구직 · 전문연 가능 | Open positions where 전문연구요원 is confirmed possible; filters for new, closing soon |
| GPU 지원사업 · 대학 가능 | Open programs that universities or university labs can apply to; filters for new, closing soon, government, corporate |
| 지난 항목 | Closed or expired items, folded by default |
| 업데이트 기록 | One line per daily run with new and changed counts |

All found items are stored in `data/data.json`, but the page shows only 전문연-eligible positions and university-eligible GPU programs. Items are sorted with new ones first, then by nearest deadline. Data is refetched when the cached copy is older than 30 minutes, or when you click **새로고침**.

## Data accumulation

`data/data.json` is append-only in practice. Each daily run upserts items by `id` (or `url`), so:

- an item found again keeps its `first_seen` date and gets a new `last_seen`
- a changed deadline or status is recorded in the item's `changes` list
- an item that is no longer found stays in the file
- an item whose deadline has passed is marked `closed` and moves to 지난 항목

<details>
<summary>Running an update by hand</summary>

```bash
python3 scripts/merge.py path/to/findings.json
python3 -m unittest discover -s scripts
```

The findings format is described in `CLAUDE.md`.

</details>

## Why these choices

- **GitHub as the data store**: the scheduled session can push to it, the extension can read it from anywhere, and git history doubles as a backup of every daily state.
- **No build step**: the page is one HTML file with a few ES modules, so there is nothing to compile before loading it.
- **Merge script instead of free-form edits**: the daily run is done by an AI session; a validated, tested merge keeps the file consistent and makes sure nothing is silently dropped.
