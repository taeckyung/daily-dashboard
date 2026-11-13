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

const DAY_MS = 24 * 60 * 60 * 1000;
const MIDDAY_HOUR = 12;

const wmoKind = (code) => WMO_KINDS.find(([max]) => code <= max)?.[1] ?? null;
const symbolKind = (symbol) => SYMBOL_KINDS.find(([part]) => (symbol ?? "").includes(part))?.[1] ?? null;
const symbolOf = (data) => (data.next_1_hours ?? data.next_6_hours)?.summary.symbol_code;

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
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "2",
  });
  const { current, daily } = await fetchJson(`${WEATHER_API}?${query}`);
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    kind: wmoKind(current.weather_code),
    high: daily.temperature_2m_max[0],
    low: daily.temperature_2m_min[0],
    rainChance: daily.precipitation_probability_max[0],
    tomorrow: {
      kind: wmoKind(daily.weather_code[1]),
      high: daily.temperature_2m_max[1],
      low: daily.temperature_2m_min[1],
      rainChance: daily.precipitation_probability_max[1],
    },
  };
}

/** Fallback source. No feels-like or rain chance; today's high and low cover the rest of the day. */
async function fromMetNo(place) {
  const query = new URLSearchParams({ lat: place.latitude.toFixed(4), lon: place.longitude.toFixed(4) });
  const series = (await fetchJson(`${WEATHER_FALLBACK_API}?${query}`)).properties.timeseries;
  const onDay = (date) => series.filter((entry) => toDateKey(new Date(entry.time)) === toDateKey(date));
  const range = (entries) => {
    const temperatures = entries.map((entry) => entry.data.instant.details.air_temperature);
    return { high: Math.max(...temperatures), low: Math.min(...temperatures), rainChance: null };
  };
  const nextDay = onDay(new Date(Date.now() + DAY_MS));
  const midday = nextDay.find((entry) => new Date(entry.time).getHours() >= MIDDAY_HOUR) ?? nextDay[0];
  const now = series[0].data;
  return {
    temperature: now.instant.details.air_temperature,
    feelsLike: null,
    kind: symbolKind(symbolOf(now)),
    ...range(onDay(new Date())),
    tomorrow: nextDay.length ? { kind: symbolKind(symbolOf(midday.data)), ...range(nextDay) } : null,
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
