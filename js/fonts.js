import { FONTS } from "./schema.js";

const loaded = new Set();

export function loadFont(family) {
  if (loaded.has(family) || !FONTS[family]) return;
  loaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${FONTS[family]}&display=swap`;
  document.head.append(link);
}
