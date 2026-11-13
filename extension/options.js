import { geocode, loadPlace, loadSource, savePlace, saveSource } from "./store.js";

const FIELDS = ["owner", "repo", "branch", "token"];
const form = document.getElementById("form");

function showResult(errorMessage) {
  document.getElementById("saved").hidden = Boolean(errorMessage);
  document.getElementById("error").hidden = !errorMessage;
  document.getElementById("error").textContent = errorMessage ?? "";
}

async function save(source, place) {
  const edited = Object.fromEntries(FIELDS.map((field) => [field, form.elements[field].value.trim()]));
  await saveSource({ ...source, ...edited });
  const city = form.elements.city.value.trim();
  if (city !== place.name) await savePlace(await geocode(city));
}

async function start() {
  const [source, place] = await Promise.all([loadSource(), loadPlace()]);
  for (const field of FIELDS) form.elements[field].value = source[field];
  form.elements.city.value = place.name;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await save(source, place);
      showResult(null);
    } catch (error) {
      showResult(error instanceof TypeError ? "네트워크 연결 실패." : error.message);
    }
  });
}

start();
