import { el } from "./view.js";

/** WMO weather codes, checked in order: first entry whose max covers the code wins. */
const CONDITIONS = [
  { max: 0, icon: "☀️", label: "맑음" },
  { max: 1, icon: "🌤️", label: "대체로 맑음" },
  { max: 2, icon: "⛅", label: "구름 조금" },
  { max: 3, icon: "☁️", label: "흐림" },
  { max: 48, icon: "🌫️", label: "안개" },
  { max: 57, icon: "🌦️", label: "이슬비" },
  { max: 67, icon: "🌧️", label: "비" },
  { max: 77, icon: "🌨️", label: "눈" },
  { max: 82, icon: "🌦️", label: "소나기" },
  { max: 86, icon: "🌨️", label: "눈 소나기" },
  { max: 99, icon: "⛈️", label: "뇌우" },
];

export function describeCode(code) {
  return CONDITIONS.find((condition) => code <= condition.max) ?? { icon: "🌡️", label: "" };
}

const degrees = (value) => `${Math.round(value)}°`;

export function renderWeather(root, weather) {
  if (!weather) return root.replaceChildren();
  const condition = describeCode(weather.code);
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
      el("div", { class: "weather-place", text: `${weather.place} · 체감 ${degrees(weather.feelsLike)}` }),
    ]),
  );
}
