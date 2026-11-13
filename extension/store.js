import {
  API_BASE,
  DEFAULT_PLACE,
  DEFAULT_SOURCE,
  GEOCODING_API,
  REFRESH_AFTER_MS,
  STORAGE_KEYS,
  WEATHER_API,
} from "./config.js";

export async function loadSource() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.source);
  return { ...DEFAULT_SOURCE, ...(stored[STORAGE_KEYS.source] ?? {}) };
}

export async function saveSource(source) {
  await chrome.storage.local.set({ [STORAGE_KEYS.source]: source });
  await chrome.storage.local.remove(STORAGE_KEYS.cache);
}

export async function loadCache() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.cache);
  return stored[STORAGE_KEYS.cache] ?? null;
}

export function isStale(cache, now = Date.now()) {
  return !cache || now - cache.fetchedAt > REFRESH_AFTER_MS;
}

function describeFailure(status, hasToken) {
  if (status === 404 || status === 401) {
    return hasToken
      ? "데이터를 찾을 수 없습니다. 저장소 설정과 토큰 권한을 확인하세요."
      : "데이터를 찾을 수 없습니다. 비공개 저장소라면 설정에서 토큰을 입력하세요.";
  }
  if (status === 403 || status === 429) return "GitHub 요청 한도 초과. 잠시 후 다시 시도하세요.";
  return `GitHub 응답 오류 (${status})`;
}

/** Fetch the latest data.json from GitHub and store it as the cache. */
export async function fetchData(source) {
  const { owner, repo, branch, path, token } = source;
  const url = `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const headers = { Accept: "application/vnd.github.raw+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(describeFailure(response.status, Boolean(token)));
  const cache = { data: await response.json(), fetchedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEYS.cache]: cache });
  return cache;
}

/** Favorites and hidden cards are lists of "category:id" keys, synced across the user's Chrome profiles. */
export async function loadKeys(storageKey) {
  const stored = await chrome.storage.sync.get(storageKey);
  return stored[storageKey] ?? [];
}

export async function saveKeys(storageKey, keys) {
  await chrome.storage.sync.set({ [storageKey]: keys });
}

export async function loadPlace() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.place);
  return { ...DEFAULT_PLACE, ...(stored[STORAGE_KEYS.place] ?? {}) };
}

export async function savePlace(place) {
  await chrome.storage.local.set({ [STORAGE_KEYS.place]: place });
  await chrome.storage.local.remove(STORAGE_KEYS.weather);
}

/** Resolve a city name to coordinates. Throws when nothing matches. */
export async function geocode(name) {
  const response = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(name)}&count=1&language=ko`);
  const match = response.ok ? (await response.json()).results?.[0] : null;
  if (!match) throw new Error(`"${name}" 지역을 찾을 수 없습니다.`);
  return { name: match.name, latitude: match.latitude, longitude: match.longitude };
}

export async function loadWeatherCache() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.weather);
  return stored[STORAGE_KEYS.weather] ?? null;
}

/** Fetch today's weather for a place and store it as the cache. */
export async function fetchWeather(place) {
  const query = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1",
  });
  const response = await fetch(`${WEATHER_API}?${query}`);
  if (!response.ok) throw new Error(`날씨 응답 오류 (${response.status})`);
  const { current, daily } = await response.json();
  const data = {
    place: place.name,
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    code: current.weather_code,
    high: daily.temperature_2m_max[0],
    low: daily.temperature_2m_min[0],
    rainChance: daily.precipitation_probability_max[0],
  };
  const cache = { data, fetchedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEYS.weather]: cache });
  return cache;
}
