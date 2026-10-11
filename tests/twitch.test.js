import { test } from "node:test";
import assert from "node:assert/strict";
import { connectChat, backoffDelay } from "../js/twitch.js";

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeSocket.instances.push(this);
  }
  send(line) { this.sent.push(line); }
  close() { this.onclose?.(); }
  open() { this.onopen?.(); }
  receive(data) { this.onmessage?.({ data }); }
}

function setup(channel = "Lennelen") {
  FakeSocket.instances = [];
  const events = [];
  const timers = [];
  const conn = connectChat(channel, ev => events.push(ev), {
    WebSocketImpl: FakeSocket,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
  });
  return { conn, events, timers, latest: () => FakeSocket.instances.at(-1) };
}

const ROOMSTATE = "@room-id=659811388 :tmi.twitch.tv ROOMSTATE #lennelen";
const PRIVMSG = "@display-name=A;id=1;user-id=2 :a!a@a.tmi.twitch.tv PRIVMSG #lennelen :hi";

test("backoffDelay doubles from 1s and caps at 30s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 10].map(backoffDelay), [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
});

test("joins anonymously on open", () => {
  const { latest } = setup();
  const s = latest();
  assert.equal(s.url, "wss://irc-ws.chat.twitch.tv:443");
  s.open();
  assert.equal(s.sent[0], "CAP REQ :twitch.tv/tags twitch.tv/commands");
  assert.match(s.sent[1], /^NICK justinfan\d+$/);
  assert.equal(s.sent[2], "JOIN #lennelen");
});

test("answers PING without forwarding it", () => {
  const { latest, events } = setup();
  latest().receive("PING :tmi.twitch.tv\r\n");
  assert.deepEqual(latest().sent, ["PONG :tmi.twitch.tv"]);
  assert.deepEqual(events, []);
});

test("forwards every line of a frame", () => {
  const { latest, events } = setup();
  latest().receive(`${ROOMSTATE}\r\n${PRIVMSG}\r\n`);
  assert.deepEqual(events.map(e => e.type), ["roomstate", "message"]);
});

test("reconnects with backoff and resets after a join", () => {
  const { latest, timers } = setup();
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000]);
  timers[0].fn();
  assert.equal(FakeSocket.instances.length, 2);
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000, 2000]);
  timers[1].fn();
  latest().receive(ROOMSTATE);
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000, 2000, 1000]);
});

test("RECONNECT from Twitch triggers a reconnect", () => {
  const { latest, timers } = setup();
  latest().receive(":tmi.twitch.tv RECONNECT\r\n");
  assert.equal(timers.length, 1);
});

test("close() stops reconnecting", () => {
  const { conn, timers } = setup();
  conn.close();
  assert.equal(timers.length, 0);
});
