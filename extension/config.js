export const DEFAULT_SOURCE = Object.freeze({
  owner: "taeckyung",
  repo: "daily-dashboard",
  branch: "main",
  path: "data/data.json",
  token: "",
});

export const DEFAULT_PLACE = Object.freeze({ name: "서울", latitude: 37.5665, longitude: 126.978 });

export const API_BASE = "https://api.github.com";
export const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
export const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
export const REFRESH_AFTER_MS = 30 * 60 * 1000;
export const CLOSING_SOON_DAYS = 7;
export const STORAGE_KEYS = Object.freeze({
  source: "source",
  cache: "cache",
  favorites: "favorites",
  hidden: "hidden",
  place: "place",
  weather: "weather",
});
