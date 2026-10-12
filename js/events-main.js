import { parseConfig, normalize } from "./config.js";
import { EVENTS_SCHEMA, eventsCssVars, titleFor } from "./events-schema.js";
import { loadFont } from "./fonts.js";
import { BOXES, mapUsernotice } from "./event-map.js";
import { createBox, setTitle, setName, fitName } from "./boxes.js";
import { createNameStore } from "./name-store.js";
import { mergeHistory, fetchHistory, createWarnOnce } from "./history.js";
import { connectChat } from "./twitch.js";
import { startEventsDemo } from "./events-demo.js";

const POLL_MS = 10000; // followers only reach the overlay through LennBot, so ask often

const row = document.getElementById("row");
const slots = new Map(BOXES.map(key => [key, createBox(key)]));
row.append(...slots.values());

let config = null;
let store = null;
let chat = null;
let demo = null;
let pollTimer = null;
let session = 0;

function applyConfig(next) {
  const prev = config;
  config = next;
  for (const [name, value] of Object.entries(eventsCssVars(config))) {
    document.documentElement.style.setProperty(name, value);
  }
  loadFont(config.namefont);
  document.body.classList.toggle("preview", config.bg);
  for (const key of BOXES) setTitle(slots.get(key), titleFor(config, key));
  if (!prev || prev.channel !== config.channel || prev.demo !== config.demo || prev.history !== config.history) start();
  else refit();
}

function refit() {
  requestAnimationFrame(() => slots.forEach(fitName));
}

function show(update, animate = true) {
  if (!update) return;
  setName(slots.get(update.box), update.name, animate);
  if (!config.demo) store.save(update.box, update.name, update.at);
}

function stop() {
  session++;
  chat?.close();
  demo?.stop();
  clearInterval(pollTimer);
  chat = demo = pollTimer = null;
}

function start() {
  stop();
  store = createNameStore(config.channel);
  for (const key of BOXES) setName(slots.get(key), config.demo ? "" : store.load(key)?.name ?? "", false);
  if (config.demo) {
    demo = startEventsDemo(update => show(update));
    return;
  }
  chat = connectChat(config.channel, ev => show(mapUsernotice(ev)));
  if (config.history) startHistory(session);
}

function cachedEntries() {
  return Object.fromEntries(BOXES.map(key => [key, store.load(key)]));
}

function startHistory(mine) {
  const warn = createWarnOnce(err => console.warn("Event boxes: could not load recent events, keeping the cached names", err));
  loadHistory(mine, false, warn);
  pollTimer = setInterval(() => loadHistory(mine, true, warn), POLL_MS);
}

// Compares against the cache when the reply arrives, not when the request starts, so a live
// event that lands while the request is in flight is not overwritten by an older recorded one.
// The startup load fills the boxes quietly; later polls animate like a live event.
async function loadHistory(mine, animate, warn) {
  let remote;
  try {
    remote = await fetchHistory(config.history);
  } catch (err) {
    if (mine === session) warn.fail(err);
    return;
  }
  if (mine !== session) return;
  warn.ok();
  for (const update of mergeHistory(cachedEntries(), remote)) show(update, animate);
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values, EVENTS_SCHEMA));
});

// Names are measured for scrolling, so measure again once web fonts arrive.
document.fonts?.addEventListener("loadingdone", refit);
applyConfig(parseConfig(location.search, EVENTS_SCHEMA));
