import { el } from "./view.js";

const CONDITIONS = {
  "clear": { icon: "☀️", label: "맑음" },
  "mostly-clear": { icon: "🌤️", label: "대체로 맑음" },
  "partly-cloudy": { icon: "⛅", label: "구름 조금" },
  "cloudy": { icon: "☁️", label: "흐림" },
  "fog": { icon: "🌫️", label: "안개" },
  "drizzle": { icon: "🌦️", label: "이슬비" },
  "rain": { icon: "🌧️", label: "비" },
  "snow": { icon: "🌨️", label: "눈" },
  "showers": { icon: "🌦️", label: "소나기" },
  "snow-showers": { icon: "🌨️", label: "눈 소나기" },
  "thunder": { icon: "⛈️", label: "뇌우" },
};
const UNKNOWN_CONDITION = { icon: "🌡️", label: "" };

const degrees = (value) => `${Math.round(value)}°`;

export function renderWeather(root, weather) {
  if (!weather) return root.replaceChildren();
  const condition = CONDITIONS[weather.kind] ?? UNKNOWN_CONDITION;
  const feels = weather.feelsLike == null ? null : `체감 ${degrees(weather.feelsLike)}`;
  const rain = weather.rainChance == null ? null : `강수 ${weather.rainChance}%`;
  const range = [`최고 ${degrees(weather.high)}`, `최저 ${degrees(weather.low)}`, rain].filter(Boolean).join(" · ");
  root.replaceChildren(
    el("div", { class: "weather-icon", text: condition.icon, "aria-hidden": "true" }),
    el("div", {}, [
      el("div", { class: "weather-now" }, [
        el("span", { class: "weather-temp", text: degrees(weather.temperature) }),
        el("span", { class: "weather-label", text: condition.label }),
      ]),
      el("div", { class: "weather-range", text: range }),
      el("div", { class: "weather-place", text: [weather.place, feels].filter(Boolean).join(" · ") }),
    ]),
  );
}
