import { parseConfig, normalize, cssVars } from "./config.js";
import { FONTS } from "./schema.js";
import { connectChat } from "./twitch.js";
import { loadEmotes } from "./emotes.js";
import { tokenize } from "./tokenize.js";
import { createBubble } from "./render.js";
import { startDemo } from "./demo.js";
import { renderStarfield, startShootingStars, sparklePop, drawConstellation } from "./effects.js";

const chat = document.getElementById("chat");
const stars = document.getElementById("stars");
const lines = document.getElementById("lines");

const LEAVE_MS = 500; // matches .bubble.leave animation in style.css
const loadedFonts = new Set();

let config = null;
let emoteMap = new Map();
let roomId = null;
let connection = null;
let demo = null;

function loadFont(family) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${FONTS[family]}&display=swap`;
  document.head.append(link);
}

function applyConfig(next) {
  const prev = config;
  config = next;
  for (const [name, value] of Object.entries(cssVars(config))) {
    document.documentElement.style.setProperty(name, value);
  }
  loadFont(config.font);
  loadFont(config.namefont);
  document.body.classList.toggle("preview", config.bg);
  if (!prev || prev.stars !== config.stars || prev.starcount !== config.starcount) renderStarfield(stars, config);
  if (!prev || prev.channel !== config.channel) connect();
  if (!prev || prev.demo !== config.demo) toggleDemo();
}

// Demo mode stays connected so the preview can use the channel's real emotes.
function connect() {
  connection?.close();
  roomId = null;
  emoteMap = new Map();
  connection = connectChat(config.channel, onEvent);
}

function toggleDemo() {
  demo?.stop();
  demo = config.demo ? startDemo(showMessage, () => [...emoteMap.keys()].slice(0, 40)) : null;
}

function onEvent(ev) {
  switch (ev.type) {
    case "roomstate":
      if (ev.roomId && ev.roomId !== roomId) {
        const id = (roomId = ev.roomId);
        loadEmotes(id).then(map => {
          if (roomId === id) emoteMap = map;
        });
      }
      break;
    case "message":
      if (!config.demo) showMessage(ev);
      break;
    case "clearmsg":
      removeWhere(b => b.dataset.msgId === ev.targetId);
      break;
    case "clearuser":
      removeWhere(b => b.dataset.userId === ev.userId);
      break;
    case "clearall":
      removeWhere(() => true);
      break;
  }
}

function isHidden(ev) {
  const users = config.hide.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  return users.includes(ev.login) || (config.hidecmd && ev.text.startsWith("!"));
}

function liveBubbles() {
  return [...chat.children].filter(b => !b.dataset.leaving);
}

function showMessage(ev) {
  if (isHidden(ev)) return;
  const previous = liveBubbles().at(-1);
  const bubble = createBubble(ev, tokenize(ev.text, ev.emotes, emoteMap), config);
  chat.append(bubble);
  if (config.sparkles) sparklePop(bubble);
  if (config.constellation && previous) requestAnimationFrame(() => drawConstellation(lines, previous, bubble));
  const live = liveBubbles();
  while (live.length > config.max) fadeOut(live.shift());
  if (config.fade > 0) bubble.fadeTimer = setTimeout(() => fadeOut(bubble), config.fade * 1000);
}

function fadeOut(bubble) {
  if (bubble.dataset.leaving) return;
  bubble.dataset.leaving = "1";
  clearTimeout(bubble.fadeTimer);
  bubble.classList.add("leave");
  setTimeout(() => bubble.remove(), LEAVE_MS);
}

function removeWhere(match) {
  for (const bubble of [...chat.children]) {
    if (!match(bubble)) continue;
    clearTimeout(bubble.fadeTimer);
    bubble.remove();
  }
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values));
});

applyConfig(parseConfig(location.search));
startShootingStars(stars, () => config);
