import { API_BASE, DEFAULT_SOURCE, REFRESH_AFTER_MS, STORAGE_KEYS } from "./config.js";

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
