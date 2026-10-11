import { parseConfig, normalize } from "./config.js";
import { EVENTS_SCHEMA, eventsCssVars, titleFor } from "./events-schema.js";
import { loadFont } from "./fonts.js";
import { BOXES, mapFollow, mapUsernotice } from "./event-map.js";
import { createBox, setTitle, setName, fitName } from "./boxes.js";
import { createNameStore } from "./name-store.js";
import { connectChat } from "./twitch.js";
import { connectEventSub } from "./eventsub.js";
import { CLIENT_ID, tokenFromHash, validateToken } from "./auth.js";
import { getUserId, getFollowers } from "./helix.js";
import { startEventsDemo } from "./events-demo.js";

const VALIDATE_MS = 3600000; // Twitch requires validating a token at least hourly

const row = document.getElementById("row");
const slots = new Map(BOXES.map(key => [key, createBox(key)]));
row.append(...slots.values());

// Dev only: point EventSub at the Twitch CLI mock server.
const dev = new URLSearchParams(location.search);
const eventsubUrl = dev.get("eventsub") || undefined;
const eventsubApi = dev.get("api") || undefined;
const token = tokenFromHash(location.hash);

let config = null;
let store = null;
let chat = null;
let eventsub = null;
let demo = null;
let validateTimer = null;
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
  if (!prev || prev.channel !== config.channel || prev.demo !== config.demo) start();
  else refit();
}

function refit() {
  requestAnimationFrame(() => slots.forEach(fitName));
}

function show(update, animate = true) {
  if (!update) return;
  setName(slots.get(update.box), update.name, animate);
  if (!config.demo) store.save(update.box, update.name);
}

function stop() {
  session++;
  chat?.close();
  eventsub?.close();
  demo?.stop();
  clearInterval(validateTimer);
  chat = eventsub = demo = validateTimer = null;
}

function start() {
  stop();
  store = createNameStore(config.channel);
  for (const key of BOXES) setName(slots.get(key), config.demo ? "" : store.load(key) ?? "", false);
  if (config.demo) {
    demo = startEventsDemo(update => show(update));
    return;
  }
  chat = connectChat(config.channel, ev => show(mapUsernotice(ev)));
  if (!token) {
    console.warn("Event boxes: no Twitch login, the follower box will not update");
    return;
  }
  startFollows(session);
}

async function startFollows(mine) {
  try {
    const me = await validateToken(token);
    if (mine !== session) return;
    if (!me) {
      console.warn("Event boxes: Twitch login expired or revoked, log in again on the settings page");
      return;
    }
    const api = { token, clientId: CLIENT_ID };
    const broadcasterId = await getUserId(config.channel, api);
    if (mine !== session) return;
    try {
      const { name } = await getFollowers(broadcasterId, api);
      if (mine !== session) return;
      if (name) show({ box: "follower", name }, false);
    } catch (err) {
      console.warn("Event boxes: could not load the latest follower", err);
    }
    if (mine !== session) return;
    eventsub = connectEventSub({
      token,
      clientId: CLIENT_ID,
      broadcasterId,
      moderatorId: me.userId,
      onNotification: payload => show(mapFollow(payload)),
      url: eventsubUrl,
      apiBase: eventsubApi,
    });
    validateTimer = setInterval(async () => {
      try {
        if (await validateToken(token)) return;
        console.warn("Event boxes: Twitch login expired, follower updates stopped");
        eventsub?.close();
        eventsub = null;
        clearInterval(validateTimer);
      } catch {
        // Network blip; try again next hour.
      }
    }, VALIDATE_MS);
  } catch (err) {
    console.warn("Event boxes: follower setup failed", err);
  }
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values, EVENTS_SCHEMA));
});

// Names are measured for scrolling, so measure again once web fonts arrive.
document.fonts?.addEventListener("loadingdone", refit);
applyConfig(parseConfig(location.search, EVENTS_SCHEMA));
