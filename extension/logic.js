import { CLOSING_SOON_DAYS } from "./config.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysUntil(deadline, todayKey) {
  if (!deadline) return null;
  return Math.round((Date.parse(deadline) - Date.parse(todayKey)) / DAY_MS);
}

/** Derive display state for one item. latestRun is the newest run date. */
export function classify(item, todayKey, latestRun) {
  const dday = daysUntil(item.deadline, todayKey);
  const closed = item.status === "closed" || (dday !== null && dday < 0);
  return {
    dday,
    closed,
    isNew: !closed && Boolean(latestRun) && item.first_seen === latestRun,
    closingSoon: !closed && dday !== null && dday <= CLOSING_SOON_DAYS,
    changedOn: (item.changes ?? []).at(-1)?.date ?? null,
  };
}

/** New first, then nearest deadline, rolling (no deadline) last. */
export function sortOpen(entries) {
  const rank = (e) => (e.state.dday === null ? Number.MAX_SAFE_INTEGER : e.state.dday);
  return [...entries].sort(
    (a, b) => Number(b.state.isNew) - Number(a.state.isNew) || rank(a) - rank(b),
  );
}

export function sortClosed(entries) {
  const key = (e) => e.item.deadline ?? e.item.last_seen ?? "";
  return [...entries].sort((a, b) => key(b).localeCompare(key(a)));
}

export function ddayLabel(state, item) {
  if (state.closed) return "마감";
  if (state.dday === null) return item.deadline_text || "상시";
  return state.dday === 0 ? "D-DAY" : `D-${state.dday}`;
}

export function safeUrl(url) {
  return /^https?:\/\//i.test(url ?? "") ? url : null;
}
