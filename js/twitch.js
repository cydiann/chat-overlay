import { parseLine, toEvent } from "./irc.js";

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
const KEEPALIVE_MS = 60000;
// Twitch PINGs about every 5 minutes and answers our keepalive, so 6 silent minutes means a dead socket.
const STALE_MS = 360000;

export function backoffDelay(attempt) {
  return Math.min(1000 * 2 ** attempt, 30000);
}

export function connectChat(channel, onEvent, {
  WebSocketImpl = globalThis.WebSocket,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  setTicker = setInterval,
  clearTicker = clearInterval,
  now = Date.now,
} = {}) {
  let attempt = 0;
  let stopped = false;
  let current = null;
  let reconnectTimer = null;
  let lastSeen = now();

  function open() {
    reconnectTimer = null;
    if (stopped) return;
    const ws = new WebSocketImpl(IRC_URL);
    current = ws;
    lastSeen = now();

    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${channel.toLowerCase()}`);
    };

    ws.onmessage = ({ data }) => {
      lastSeen = now();
      for (const line of String(data).split("\r\n")) {
        if (!line) continue;
        const event = toEvent(parseLine(line));
        if (!event) continue;
        if (event.type === "ping") ws.send(`PONG :${event.payload}`);
        else if (event.type === "reconnect") ws.close();
        else {
          if (event.type === "roomstate") attempt = 0;
          onEvent(event);
        }
      }
    };

    ws.onclose = () => {
      if (stopped || ws !== current) return;
      reconnect();
    };
  }

  function reconnect() {
    reconnectTimer = setTimer(open, backoffDelay(attempt++));
  }

  // A half-open socket never fires onclose, so drop it ourselves when it goes quiet.
  function keepalive() {
    if (!current || reconnectTimer !== null) return;
    if (now() - lastSeen > STALE_MS) {
      const ws = current;
      current = null;
      ws.onopen = ws.onmessage = ws.onclose = null;
      ws.close();
      reconnect();
    } else if (current.readyState === WebSocketImpl.OPEN) {
      current.send("PING :keepalive");
    }
  }

  open();
  const ticker = setTicker(keepalive, KEEPALIVE_MS);
  return {
    close() {
      stopped = true;
      clearTimer(reconnectTimer);
      clearTicker(ticker);
      current?.close();
    },
  };
}
