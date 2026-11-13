import { WEATHER_API, WEATHER_FALLBACK_API, WEATHER_TIMEOUT_MS } from "./config.js";
import { toDateKey } from "./logic.js";
import { saveWeatherCache } from "./store.js";

/** WMO codes (Open-Meteo), checked in order: first entry whose max covers the code wins. */
const WMO_KINDS = [
  [0, "clear"], [1, "mostly-clear"], [2, "partly-cloudy"], [3, "cloudy"], [48, "fog"], [57, "drizzle"],
  [67, "rain"], [77, "snow"], [82, "showers"], [86, "snow-showers"], [99, "thunder"],
];

/** MET Norway symbol codes, matched by substring in order (e.g. "lightrainshowers_day"). */
const SYMBOL_KINDS = [
  ["thunder", "thunder"], ["snowshowers", "snow-showers"], ["sleet", "snow"], ["snow", "snow"],
  ["showers", "showers"], ["rain", "rain"], ["fog", "fog"], ["partlycloudy", "partly-cloudy"],
  ["cloudy", "cloudy"], ["fair", "mostly-clear"], ["clearsky", "clear"],
];

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`날씨 응답 오류 (${response.status})`);
  return response.json();
}

async function fromOpenMeteo(place) {
  const query = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1",
  });
  const { current, daily } = await fetchJson(`${WEATHER_API}?${query}`);
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    kind: WMO_KINDS.find(([max]) => current.weather_code <= max)?.[1] ?? null,
    high: daily.temperature_2m_max[0],
    low: daily.temperature_2m_min[0],
    rainChance: daily.precipitation_probability_max[0],
  };
}

/** Fallback source. It has no feels-like or rain chance; high and low cover the rest of today. */
async function fromMetNo(place) {
  const query = new URLSearchParams({ lat: place.latitude.toFixed(4), lon: place.longitude.toFixed(4) });
  const series = (await fetchJson(`${WEATHER_FALLBACK_API}?${query}`)).properties.timeseries;
  const today = toDateKey(new Date());
  const temperatures = series
    .filter((entry) => toDateKey(new Date(entry.time)) === today)
    .map((entry) => entry.data.instant.details.air_temperature);
  const now = series[0].data;
  const symbol = (now.next_1_hours ?? now.next_6_hours)?.summary.symbol_code ?? "";
  return {
    temperature: now.instant.details.air_temperature,
    feelsLike: null,
    kind: SYMBOL_KINDS.find(([part]) => symbol.includes(part))?.[1] ?? null,
    high: Math.max(...temperatures),
    low: Math.min(...temperatures),
    rainChance: null,
  };
}

/** Try each source in order and cache the first that answers. Throws when all fail. */
export async function fetchWeather(place) {
  let lastError;
  for (const source of [fromOpenMeteo, fromMetNo]) {
    try {
      return await saveWeatherCache({ place: place.name, ...(await source(place)) });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
