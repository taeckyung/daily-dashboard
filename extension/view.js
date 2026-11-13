import { classify, ddayLabel, safeUrl, sortClosed, sortOpen } from "./logic.js";

export const COLUMNS = Object.freeze({
  jobs: {
    title: "AI 연구직 · 전문연 가능",
    visible: (item) => item.jeonmun === "가능",
    heading: (item) => item.title,
    owner: (item) => item.company,
    details: (item) => [item.qualification, item.note],
    filters: [
      { key: "all", label: "전체", test: () => true },
      { key: "new", label: "신규", test: (e) => e.state.isNew },
      { key: "soon", label: "마감 임박", test: (e) => e.state.closingSoon },
    ],
    tags: () => [],
  },
  gpu: {
    title: "GPU 지원사업 · 대학 가능",
    visible: (item) => item.univ === "가능",
    heading: (item) => item.name,
    owner: (item) => item.org,
    details: (item) => [item.target, item.scale, item.note],
    filters: [
      { key: "all", label: "전체", test: () => true },
      { key: "new", label: "신규", test: (e) => e.state.isNew },
      { key: "soon", label: "마감 임박", test: (e) => e.state.closingSoon },
      { key: "gov", label: "정부", test: (e) => e.item.kind === "정부" },
      { key: "corp", label: "기업", test: (e) => e.item.kind === "기업" },
    ],
    tags: (item) => (item.kind ? [item.kind] : []),
  },
});

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

export function favoriteKey(category, item) {
  return `${category}:${item.id}`;
}

/** Favorited items stay listed even when the column's visibility rule would hide them. */
export function toEntries(items, category, { favorites, hidden }, todayKey, latestRun) {
  const column = COLUMNS[category];
  return (items ?? [])
    .map((item) => ({ item, category, favKey: favoriteKey(category, item), state: classify(item, todayKey, latestRun) }))
    .map((entry) => ({ ...entry, isFavorite: favorites.includes(entry.favKey), isHidden: hidden.includes(entry.favKey) }))
    .filter((entry) => entry.isFavorite || column.visible(entry.item));
}

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_PATHS = Object.freeze({
  star: "M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z",
  close: "M6.5 6.5l11 11M17.5 6.5l-11 11",
});

/** Icons are drawn as SVG in one shared box so they line up regardless of font. */
function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

function starButton(entry, onToggle) {
  const button = el("button", {
    type: "button",
    class: "star",
    "aria-pressed": String(entry.isFavorite),
    "aria-label": entry.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
    title: entry.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
  }, [icon("star")]);
  button.addEventListener("click", () => onToggle(entry.favKey));
  return button;
}

function hideButton(entry, onHide) {
  const button = entry.isHidden
    ? el("button", { type: "button", class: "restore", text: "복원" })
    : el("button", { type: "button", class: "hide", "aria-label": "삭제", title: "삭제" }, [icon("close")]);
  button.addEventListener("click", () => onHide(entry.favKey));
  return button;
}

function badge(text, kind) {
  return el("span", { class: `badge ${kind}`, text });
}

function titleNode(text, url) {
  const href = safeUrl(url);
  const inner = href
    ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text })
    : el("span", { text });
  return el("h3", { class: "card-title", title: text }, [inner]);
}

function card(entry, actions) {
  const { item, state } = entry;
  const column = COLUMNS[entry.category];
  const urgency = state.closed ? "closed" : state.closingSoon ? "soon" : "plain";
  const badges = [
    state.isNew && badge("신규", "new"),
    !state.closed && !state.isNew && state.changedOn && badge(`변경 ${state.changedOn.slice(5)}`, "changed"),
    ...column.tags(item).map((tag) => badge(tag, "tag")),
  ];
  const details = column.details(item).filter(Boolean).join(" · ");
  const deadline = item.deadline && `마감 ${item.deadline.slice(5).replace("-", ".")}`;
  const marked = entry.isFavorite || entry.isHidden ? "is-marked" : "";
  return el("article", { class: `card ${urgency} ${state.closed ? "is-closed" : ""} ${marked}` }, [
    el("div", { class: "card-head" }, [
      el("span", { class: "card-owner", text: column.owner(item) }),
      el("span", { class: `dday ${urgency}`, text: ddayLabel(state, item) }),
    ]),
    titleNode(column.heading(item), item.url),
    details && el("p", { class: "card-details", title: details, text: details }),
    el("div", { class: "card-foot" }, [
      el("div", { class: "card-meta" }, [...badges, deadline && el("span", { class: "dates", text: deadline })]),
      el("div", { class: "card-actions" }, [
        !entry.isHidden && starButton(entry, actions.onToggle),
        hideButton(entry, actions.onHide),
      ]),
    ]),
  ]);
}

function sectionTitle(text, count) {
  return el("h2", {}, [el("span", { text }), el("span", { class: "count", text: String(count) })]);
}

function filterBar(column, activeKey, onSelect) {
  return el("div", { class: "filters" }, column.filters.map((filter) => {
    const pressed = String(filter.key === activeKey);
    const button = el("button", { type: "button", class: "chip", "aria-pressed": pressed, text: filter.label });
    button.addEventListener("click", () => onSelect(filter.key));
    return button;
  }));
}

function foldedList(label, entries, actions) {
  if (!entries.length) return "";
  return el("details", { class: "archive" }, [
    el("summary", { text: `${label} ${entries.length}` }),
    el("div", { class: "list" }, entries.map((entry) => card(entry, actions))),
  ]);
}

export function renderColumn(root, column, allEntries, activeKey, onSelect, actions) {
  const visible = allEntries.filter((e) => column.visible(e.item));
  const entries = visible.filter((e) => !e.isHidden);
  const removed = sortClosed(visible.filter((e) => e.isHidden));
  const filter = column.filters.find((f) => f.key === activeKey) ?? column.filters[0];
  const open = sortOpen(entries.filter((e) => !e.state.closed && filter.test(e)));
  const closed = sortClosed(entries.filter((e) => e.state.closed));
  const openCount = entries.filter((e) => !e.state.closed).length;
  const list = open.length
    ? open.map((entry) => card(entry, actions))
    : [el("p", { class: "empty", text: entries.length ? "조건에 맞는 항목 없음" : "아직 수집된 항목 없음" })];
  root.replaceChildren(
    el("div", { class: "section-head" }, [
      sectionTitle(column.title, openCount),
      filterBar(column, filter.key, onSelect),
    ]),
    el("div", { class: "list" }, list),
    foldedList("지난 항목", closed, actions),
    foldedList("삭제한 항목", removed, actions),
  );
}

export function renderFavorites(root, allEntries, actions) {
  const favorites = allEntries.filter((e) => e.isFavorite && !e.isHidden);
  const open = sortOpen(favorites.filter((e) => !e.state.closed));
  const closed = sortClosed(favorites.filter((e) => e.state.closed));
  const body = favorites.length
    ? el("div", { class: "list" }, [...open, ...closed].map((entry) => card(entry, actions)))
    : el("p", { class: "hint", text: "카드의 ☆를 누르면 여기에 모입니다." });
  root.replaceChildren(el("div", { class: "section-head" }, [sectionTitle("즐겨찾기", favorites.length)]), body);
}

export function renderLog(root, runs) {
  if (!runs?.length) return root.replaceChildren();
  const rows = runs.map((run) => {
    const added = (run.new?.jobs?.length ?? 0) + (run.new?.gpu?.length ?? 0);
    const changed = (run.changed?.jobs?.length ?? 0) + (run.changed?.gpu?.length ?? 0);
    return el("li", {}, [
      el("span", { class: "log-date", text: run.date }),
      el("span", { class: "log-counts", text: `신규 ${added} · 변경 ${changed}` }),
      el("span", { class: "log-summary", text: run.summary || "" }),
    ]);
  });
  root.replaceChildren(el("details", {}, [
    el("summary", { text: `업데이트 기록 ${runs.length}일` }),
    el("ul", {}, rows),
  ]));
}
