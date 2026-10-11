import { mountSettings } from "./settings-form.js";
import { EVENTS_SCHEMA } from "./events-schema.js";
import { CLIENT_ID, authorizeUrl, readHash, tokenFromHash, tokenHash, validateToken, missingScopes } from "./auth.js";
import { getUserId, getFollowers } from "./helix.js";

const STATE_KEY = "event-boxes:auth-state";
const QUERY_KEY = "event-boxes:auth-query";
const OVERLAY_WIDTH = 1700;

const status = document.getElementById("auth-status");
const connect = document.getElementById("connect");
const stage = document.querySelector(".stage");

function session(action) {
  try {
    return action(sessionStorage);
  } catch {
    return null;
  }
}

let token = tokenFromHash(location.hash);
let loginError = null;

// Coming back from Twitch: check state, restore the settings query the redirect dropped.
const callback = readHash(location.hash);
const query = new URLSearchParams(location.search);
if (callback.access_token || query.has("error")) {
  const expected = session(s => s.getItem(STATE_KEY));
  const saved = session(s => s.getItem(QUERY_KEY)) ?? "";
  session(s => (s.removeItem(STATE_KEY), s.removeItem(QUERY_KEY)));
  const state = callback.state ?? query.get("state");
  if (query.has("error")) loginError = `Twitch login failed: ${query.get("error_description") || query.get("error")}`;
  else if (!expected || state !== expected) loginError = "Login rejected because it did not come from this page. Try again.";
  else token = callback.access_token;
  history.replaceState(null, "", saved ? `?${saved}` : location.pathname);
}

let check = 0;
async function checkStatus(channel) {
  const mine = ++check;
  const say = text => {
    if (mine === check) status.textContent = text;
  };
  if (!token) {
    say(loginError ?? "Not connected. Subs, gifts and resubs work without a login; the follower box needs a moderator login.");
    return;
  }
  try {
    const me = await validateToken(token);
    if (!me) return say("Login expired or revoked. Connect again.");
    const missing = missingScopes(me.scopes);
    if (missing.length) return say(`Login is missing ${missing.join(", ")}. Connect again.`);
    const days = Math.floor(me.expiresIn / 86400);
    const expiry = me.expiresIn > 0 ? `expires in ${days} day${days === 1 ? "" : "s"}` : "no expiry reported";
    const api = { token, clientId: CLIENT_ID };
    const notMod = `${me.login} is not a moderator of ${channel}, so the follower box will not update`;
    let access;
    try {
      const { total, name } = await getFollowers(await getUserId(channel, api), api);
      access = total > 0 && !name ? notMod : `can read ${channel}'s followers`;
    } catch (err) {
      // Twitch answers 401/403 instead of an empty list when the login can't moderate this channel.
      if (err.status === 401 || err.status === 403) access = notMod;
      else throw err;
    }
    say(`Connected as ${me.login} · ${expiry} · ${access}`);
  } catch (err) {
    say(`Could not check the login: ${err.message}`);
  }
}

// Dragging a color picker fires onChange dozens of times a second; only re-check Twitch when the channel itself changes.
let lastChecked;
function onFormChange(values) {
  if (values.channel === lastChecked) return;
  lastChecked = values.channel;
  checkStatus(values.channel);
}

const settings = mountSettings({
  schema: EVENTS_SCHEMA,
  overlay: "events.html",
  preview: "events.html",
  fragment: () => tokenHash(token),
  onChange: onFormChange,
});
settings.update();

connect.addEventListener("click", () => {
  const state = crypto.randomUUID();
  session(s => (s.setItem(STATE_KEY, state), s.setItem(QUERY_KEY, location.search.slice(1))));
  location.href = authorizeUrl(location.origin + location.pathname, state);
});

// The preview renders at the real 1700x330 OBS size and is scaled down to fit.
new ResizeObserver(() => stage.style.setProperty("--scale", stage.clientWidth / OVERLAY_WIDTH)).observe(stage);
