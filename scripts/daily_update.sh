#!/bin/bash
# Run the daily data update with headless Claude Code. Meant for cron.
# Skips when today's (Asia/Seoul) run is already in data/data.json. FORCE=1 overrides.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
LOG_DIR="${LOG_DIR:-$HOME/.local/state/daily-dashboard}"
PROMPT_FILE="${PROMPT_FILE:-$REPO/scripts/daily_prompt.md}"
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$LOG_DIR"
TODAY="$(TZ=Asia/Seoul date +%F)"
LOG="$LOG_DIR/$TODAY.log"
exec >>"$LOG" 2>&1
echo "=== $(date -Is) start"

exec 9>"$LOG_DIR/lock"
flock -n 9 || { echo "another run is in progress; exit"; exit 0; }

cd "$REPO" || exit 1
git pull --ff-only origin main || echo "pull failed; continuing with local copy"
if [ "${FORCE:-0}" != "1" ] && grep -q "\"date\": \"$TODAY\"" data/data.json; then
  echo "run for $TODAY already present; skip"
  exit 0
fi

"$CLAUDE_BIN" -p "${PROMPT_OVERRIDE:-$(cat "$PROMPT_FILE")}" \
  --allowedTools "Bash(git push origin main*)" "Bash(git config*)" "WebFetch" "WebSearch"
echo "=== $(date -Is) end (exit $?)"
find "$LOG_DIR" -name '*.log' -mtime +30 -delete
