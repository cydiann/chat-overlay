import { backoffDelay } from "./twitch.js";
import { API_BASE } from "./helix.js";

export const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const DEFAULT_KEEPALIVE_S = 10;
const GRACE_MS = 5000;
const SEEN_MAX = 500;

export function followSubscription(sessionId, broadcasterId, moderatorId) {
  return {
    type: "channel.follow",
    version: "2",
    condition: { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorId },
    transport: { method: "websocket", session_id: sessionId },
  };
}

export function connectEventSub(
  { token, clientId, broadcasterId, moderatorId, onNotification, url = EVENTSUB_URL, apiBase = API_BASE, log = console },
  {
    WebSocketImpl = globalThis.WebSocket,
    fetchImpl = (...args) => globalThis.fetch(...args),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {},
) {
  let attempt = 0;
  let stopped = false;
  let current = null;
  // Socket opened from a session_reconnect, waiting for its welcome before replacing `current`.
  let pending = null;
  let reconnectTimer = null;
  let silenceTimer = null;
  let silenceMs = DEFAULT_KEEPALIVE_S * 1000 + GRACE_MS;
  const seen = new Set();

  function open(target, isReconnect = false) {
    const ws = new WebSocketImpl(target);
    ws.isReconnect = isReconnect;
    ws.onmessage = ({ data }) => handle(ws, data);
    ws.onclose = () => closed(ws);
    return ws;
  }

  function detach(ws) {
    ws.onmessage = ws.onclose = null;
    ws.close();
  }

  function connect() {
    reconnectTimer = null;
    if (stopped) return;
    current = open(url);
    armSilence();
  }

  function armSilence() {
    clearTimer(silenceTimer);
    silenceTimer = setTimer(drop, silenceMs);
  }

  function scheduleReconnect() {
    clearTimer(silenceTimer);
    if (stopped || reconnectTimer !== null) return;
    reconnectTimer = setTimer(connect, backoffDelay(attempt++));
  }

  // A half-open socket never fires onclose, so silence or a failed subscribe drops it ourselves.
  function drop() {
    if (current) detach(current);
    if (pending) detach(pending);
    current = pending = null;
    scheduleReconnect();
  }

  function closed(ws) {
    if (stopped) return;
    if (ws === pending) {
      pending = null;
      return;
    }
    if (ws !== current) return;
    if (pending) {
      current = pending;
      pending = null;
      armSilence();
      return;
    }
    current = null;
    scheduleReconnect();
  }

  function welcome(ws, session) {
    silenceMs = (session.keepalive_timeout_seconds ?? DEFAULT_KEEPALIVE_S) * 1000 + GRACE_MS;
    // A reconnect carries subscriptions over, so its welcome is itself the success signal;
    // a fresh session only resets the backoff once its subscribe POST actually succeeds.
    if (ws.isReconnect) attempt = 0;
    if (ws === pending) {
      const old = current;
      current = ws;
      pending = null;
      if (old) detach(old);
    }
    armSilence();
    // Subscriptions carry over to a reconnect URL; posting again would duplicate them.
    if (!ws.isReconnect) subscribe(ws, session.id);
  }

  async function subscribe(ws, sessionId) {
    let res;
    try {
      res = await fetchImpl(`${apiBase}/eventsub/subscriptions`, {
        method: "POST",
        headers: { "Client-Id": clientId, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(followSubscription(sessionId, broadcasterId, moderatorId)),
      });
    } catch (err) {
      if (stopped || ws !== current) return;
      log.warn("EventSub follow subscription failed, retrying", err);
      drop();
      return;
    }
    // The socket this POST was for may already be gone (closed, superseded by a
    // reconnect); its outcome no longer applies to whichever socket is live now.
    if (stopped || ws !== current) return;
    if (res.ok || res.status === 409) {
      attempt = 0;
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      log.warn(`EventSub follow subscription failed (${res.status}), retrying`);
      drop();
      return;
    }
    log.error(`EventSub follow subscription refused (${res.status}); the follower box will not update`);
    close();
  }

  function notification(metadata, payload) {
    const id = metadata.message_id;
    if (seen.has(id)) return;
    seen.add(id);
    if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value);
    onNotification(payload);
  }

  function handle(ws, data) {
    if (ws !== current && ws !== pending) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (ws === current) armSilence();
    const { metadata = {}, payload = {} } = msg;
    switch (metadata.message_type) {
      case "session_welcome":
        welcome(ws, payload.session ?? {});
        break;
      case "session_reconnect":
        if (ws === current && !pending) pending = open(payload.session.reconnect_url, true);
        break;
      case "notification":
        notification(metadata, payload);
        break;
      case "revocation":
        log.warn(`EventSub ${payload.subscription?.type} revoked: ${payload.subscription?.status}`);
        break;
    }
  }

  function close() {
    stopped = true;
    clearTimer(reconnectTimer);
    clearTimer(silenceTimer);
    if (current) detach(current);
    if (pending) detach(pending);
    current = pending = null;
  }

  connect();
  return { close };
}
