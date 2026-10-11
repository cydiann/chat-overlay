import { parseLine, toEvent } from "./irc.js";

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

export function backoffDelay(attempt) {
  return Math.min(1000 * 2 ** attempt, 30000);
}

export function connectChat(channel, onEvent, { WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout } = {}) {
  let attempt = 0;
  let stopped = false;
  let current = null;

  function open() {
    const ws = new WebSocketImpl(IRC_URL);
    current = ws;

    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${channel.toLowerCase()}`);
    };

    ws.onmessage = ({ data }) => {
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
      setTimer(open, backoffDelay(attempt++));
    };
  }

  open();
  return {
    close() {
      stopped = true;
      current.close();
    },
  };
}
