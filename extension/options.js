import { loadSource, saveSource } from "./store.js";

const FIELDS = ["owner", "repo", "branch", "token"];
const form = document.getElementById("form");

async function start() {
  const source = await loadSource();
  for (const field of FIELDS) form.elements[field].value = source[field];
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const edited = Object.fromEntries(FIELDS.map((field) => [field, form.elements[field].value.trim()]));
    await saveSource({ ...source, ...edited });
    document.getElementById("saved").hidden = false;
  });
}

start();
