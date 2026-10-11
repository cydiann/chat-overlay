import { parseConfig, normalize } from "./config.js";
import { EVENTS_SCHEMA, eventsCssVars, titleFor } from "./events-schema.js";
import { loadFont } from "./fonts.js";
import { BOXES, mapFollow, mapUsernotice } from "./event-map.js";
import { createBox, setTitle, setName, fitName } from "./boxes.js";
import { createNameStore } from "./name-store.js";
import { mergeHistory, fetchHistory } from "./history.js";
import { connectChat, backoffDelay } from "./twitch.js";
import { connectEventSub } from "./eventsub.js";
import { CLIENT_ID, tokenFromHash, validateToken } from "./auth.js";
import { getUserId, getFollowers } from "./helix.js";
import { startEventsDemo } from "./events-demo.js";

const VALIDATE_MS = 3600000; // Twitch requires validating a token at least hourly

const row = document.getElementById("row");
const slots = new Map(BOXES.map(key => [key, createBox(key)]));
row.append(...slots.values());

// Dev only: point EventSub at the Twitch CLI mock server. Never honor this from a non-local
// host, since the eventsub/api params would otherwise send the token to any server.
function localDevParam(value, label) {
  if (!value) return undefined;
  try {
    const { hostname } = new URL(value);
    if (hostname === "localhost" || hostname === "127.0.0.1") return value;
  } catch {
    // Falls through to the warning below.
  }
  console.warn(`Event boxes: ignoring ?${label}= (not localhost)`);
  return undefined;
}

const dev = new URLSearchParams(location.search);
const eventsubUrl = localDevParam(dev.get("eventsub"), "eventsub");
const eventsubApi = localDevParam(dev.get("api"), "api");
const token = tokenFromHash(location.hash);

let config = null;
let store = null;
let chat = null;
let eventsub = null;
let demo = null;
let validateTimer = null;
let followRetryTimer = null;
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
  if (!config.demo) store.save(update.box, update.name, update.at);
}

function stop() {
  session++;
  chat?.close();
  eventsub?.close();
  demo?.stop();
  clearInterval(validateTimer);
  clearTimeout(followRetryTimer);
  chat = eventsub = demo = validateTimer = followRetryTimer = null;
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
  if (config.history) loadHistory(session);
  if (!token) {
    console.warn("Event boxes: no Twitch login, the follower box will not update");
    return;
  }
  startFollows(session);
}

function cachedEntries() {
  return Object.fromEntries(BOXES.map(key => [key, store.load(key)]));
}

// Compares against the cache when the reply arrives, not at startup, so a live event that
// lands while the request is in flight is not overwritten by an older recorded one.
async function loadHistory(mine) {
  let remote;
  try {
    remote = await fetchHistory(config.history);
  } catch (err) {
    console.warn("Event boxes: could not load recent events, keeping the cached names", err);
    return;
  }
  if (mine !== session) return;
  for (const update of mergeHistory(cachedEntries(), remote)) show(update, false);
}

// A transient failure (network blip, Twitch hiccup) retries with backoff; a definitive "this
// token cannot do this" answer (401/403, or a null/expired validate) logs and stops instead.
function retryFollows(mine, attempt, err) {
  if (mine !== session) return;
  console.warn("Event boxes: follower setup failed, retrying", err);
  followRetryTimer = setTimeout(() => startFollows(mine, attempt + 1), backoffDelay(attempt));
}

async function startFollows(mine, attempt = 0) {
  let me;
  try {
    me = await validateToken(token);
  } catch (err) {
    retryFollows(mine, attempt, err);
    return;
  }
  if (mine !== session) return;
  if (!me) {
    console.warn("Event boxes: Twitch login expired or revoked, log in again on the settings page");
    return;
  }
  const api = { token, clientId: CLIENT_ID };
  let broadcasterId;
  try {
    broadcasterId = await getUserId(config.channel, api);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      console.warn("Event boxes: follower setup failed", err);
      return;
    }
    retryFollows(mine, attempt, err);
    return;
  }
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
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values, EVENTS_SCHEMA));
});

// Names are measured for scrolling, so measure again once web fonts arrive.
document.fonts?.addEventListener("loadingdone", refit);
applyConfig(parseConfig(location.search, EVENTS_SCHEMA));
