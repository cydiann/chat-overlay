import { moonPhase, moonPath } from "./moon.js";
import { isEmoteOnly } from "./tokenize.js";
import { isHex, hexToRgba, mixWithWhite } from "./color.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SPARKLE = "M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z";
const ROLE_MARKS = { broadcaster: "☀︎", moderator: "✦", vip: "◆" };

function svg(className, paths) {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("class", className);
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("aria-hidden", "true");
  for (const [d, cls] of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    if (cls) path.setAttribute("class", cls);
    el.append(path);
  }
  return el;
}

function emoteImg(name, url, className = "emote") {
  const img = document.createElement("img");
  img.className = className;
  img.alt = name;
  img.src = url;
  img.decoding = "async";
  img.addEventListener("error", () => img.replaceWith(document.createTextNode(name)), { once: true });
  return img;
}

function renderToken(token) {
  if (token.type === "text") return document.createTextNode(token.text);
  const base = emoteImg(token.name, token.url);
  if (!token.overlays.length) return base;
  const stack = document.createElement("span");
  stack.className = "emote-stack";
  stack.append(base, ...token.overlays.map(o => emoteImg(o.name, o.url, "emote overlay")));
  return stack;
}

function createPill(ev, config) {
  const pill = document.createElement("div");
  pill.className = "pill";
  const phase = config.moons ? moonPhase(ev.userId) : 1;
  pill.append(svg("moon", [[moonPath(4), "dark"], [moonPath(phase), "lit"]]));
  if (ev.role) {
    const mark = document.createElement("span");
    mark.className = `role role-${ev.role}`;
    mark.textContent = ROLE_MARKS[ev.role];
    pill.append(mark);
  }
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = ev.displayName;
  pill.append(name);
  if (config.namecolor && ev.color && isHex(ev.color)) {
    pill.style.setProperty("--pill-bg", hexToRgba(mixWithWhite(ev.color, 35), config.pillop));
  }
  return pill;
}

export function createBubble(ev, tokens, config) {
  const bubble = document.createElement("div");
  bubble.className = "bubble enter";
  bubble.dataset.msgId = ev.id;
  bubble.dataset.userId = ev.userId;
  if (isEmoteOnly(tokens)) bubble.classList.add("big-emotes");

  const body = document.createElement("div");
  body.className = ev.action ? "body action" : "body";
  body.append(...tokens.map(renderToken));

  bubble.append(
    createPill(ev, config),
    body,
    svg("orn sparkle", [[SPARKLE]]),
    svg("orn crescent", [[moonPath(7)]]),
  );
  return bubble;
}
