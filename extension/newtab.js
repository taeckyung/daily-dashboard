import { toDateKey } from "./logic.js";
import { STORAGE_KEYS } from "./config.js";
import {
  fetchData,
  isStale,
  loadCache,
  loadKeys,
  loadPlace,
  loadSource,
  loadWeatherCache,
  saveKeys,
} from "./store.js";
import { fetchWeather } from "./weather-source.js";
import { renderWeather } from "./weather.js";
import { COLUMNS, renderColumn, renderFavorites, renderLog, toEntries } from "./view.js";

const CLOCK_TICK_MS = 1000;
const $ = (id) => document.getElementById(id);
let activeFilters = { jobs: "all", gpu: "all" };
let current = null;
let marks = { favorites: [], hidden: [] };

const toggled = (keys, key) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);

async function saveMarks(next) {
  marks = next;
  render();
  await Promise.all([
    saveKeys(STORAGE_KEYS.favorites, marks.favorites),
    saveKeys(STORAGE_KEYS.hidden, marks.hidden),
  ]);
}

const actions = {
  onToggle: (key) => saveMarks({ ...marks, favorites: toggled(marks.favorites, key) }),
  /** Deleting a card also drops it from favorites; restoring does not re-add it. */
  onHide: (key) => saveMarks({
    favorites: marks.favorites.filter((k) => k !== key),
    hidden: toggled(marks.hidden, key),
  }),
};

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
    Object.keys(COLUMNS).map((key) => [key, toEntries(data[key], key, marks, todayKey, latestRun)]),
  );
  for (const [key, column] of Object.entries(COLUMNS)) {
    renderColumn($(key), column, entries[key], activeFilters[key], (filterKey) => {
      activeFilters = { ...activeFilters, [key]: filterKey };
      render();
    }, actions);
  }
  renderFavorites($("favorites"), Object.values(entries).flat(), actions);
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

/** Weather is optional: on failure the last cached value stays on screen. */
async function showWeather() {
  const [cached, place] = await Promise.all([loadWeatherCache(), loadPlace()]);
  const usable = cached?.data.place === place.name && "tomorrow" in cached.data;
  let weather = usable ? cached : null;
  renderWeather($("weather"), weather?.data);
  if (!isStale(weather)) return;
  try {
    weather = await fetchWeather(place);
    renderWeather($("weather"), weather.data);
  } catch {
    // Keep whatever is already rendered.
  }
}

async function start() {
  renderClock();
  setInterval(renderClock, CLOCK_TICK_MS);
  $("refresh").addEventListener("click", refresh);
  $("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  const [cache, favorites, hidden] = await Promise.all([
    loadCache(),
    loadKeys(STORAGE_KEYS.favorites),
    loadKeys(STORAGE_KEYS.hidden),
  ]);
  current = cache;
  marks = { favorites, hidden };
  showWeather();
  render();
  if (isStale(current)) await refresh();
}

start();
