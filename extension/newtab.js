import { toDateKey } from "./logic.js";
import { fetchData, isStale, loadCache, loadSource } from "./store.js";
import { COLUMNS, renderColumn, renderLog, renderSummary, toEntries } from "./view.js";

const CLOCK_TICK_MS = 1000;
const $ = (id) => document.getElementById(id);
let activeFilters = { jobs: "all", gpu: "all" };
let current = null;

function renderClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  $("today").textContent = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

function showNotice(message) {
  $("notice").textContent = message ?? "";
  $("notice").hidden = !message;
}

function render() {
  const data = current?.data ?? {};
  const todayKey = toDateKey(new Date());
  const latestRun = data.runs?.[0]?.date ?? null;
  const entries = Object.fromEntries(
    Object.keys(COLUMNS).map((key) => [key, toEntries(data[key], todayKey, latestRun)]),
  );
  for (const [key, column] of Object.entries(COLUMNS)) {
    renderColumn($(key), column, entries[key], activeFilters[key], (filterKey) => {
      activeFilters = { ...activeFilters, [key]: filterKey };
      render();
    });
  }
  renderSummary($("summary"), Object.values(entries).flat());
  renderLog($("log"), data.runs);
  $("updated").textContent = data.updated_at
    ? `마지막 업데이트 ${new Date(data.updated_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}`
    : "업데이트 기록 없음";
}

async function refresh() {
  $("refresh").disabled = true;
  try {
    current = await fetchData(await loadSource());
    showNotice(null);
  } catch (error) {
    const reason = error instanceof TypeError ? "네트워크 연결 실패." : error.message;
    showNotice(current ? `${reason} 저장된 마지막 데이터를 표시합니다.` : reason);
  } finally {
    $("refresh").disabled = false;
    render();
  }
}

async function start() {
  renderClock();
  setInterval(renderClock, CLOCK_TICK_MS);
  $("refresh").addEventListener("click", refresh);
  $("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  current = await loadCache();
  render();
  if (isStale(current)) await refresh();
}

start();
