export const DEFAULT_SOURCE = Object.freeze({
  owner: "taeckyung",
  repo: "daily-dashboard",
  branch: "main",
  path: "data/data.json",
  token: "",
});

export const API_BASE = "https://api.github.com";
export const REFRESH_AFTER_MS = 30 * 60 * 1000;
export const CLOSING_SOON_DAYS = 7;
export const STORAGE_KEYS = Object.freeze({ source: "source", cache: "cache" });
