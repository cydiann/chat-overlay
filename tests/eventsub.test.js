import { test } from "node:test";
import assert from "node:assert/strict";
import { connectEventSub, followSubscription, EVENTSUB_URL } from "../js/eventsub.js";

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    FakeSocket.instances.push(this);
  }
  close() { this.closed = true; this.onclose?.(); }
  receive(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

const welcome = (id, keepalive = 10) => ({
  metadata: { message_type: "session_welcome" },
  payload: { session: { id, keepalive_timeout_seconds: keepalive } },
});
const keepaliveMsg = () => ({ metadata: { message_type: "session_keepalive" }, payload: {} });
const reconnectMsg = url => ({ metadata: { message_type: "session_reconnect" }, payload: { session: { reconnect_url: url } } });
const follow = (messageId, user = "MoonlitMara") => ({
  metadata: { message_id: messageId, message_type: "notification" },
  payload: { subscription: { type: "channel.follow" }, event: { user_name: user } },
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ status = 202, fetchError = null } = {}) {
  FakeSocket.instances = [];
  const posts = [];
  const notes = [];
  const logs = [];
  const timers = [];
  let nextId = 1;
  const conn = connectEventSub(
    {
      token: "tok", clientId: "cid", broadcasterId: "100", moderatorId: "200",
      onNotification: p => notes.push(p), apiBase: "https://api.test",
      log: { warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
    },
    {
      WebSocketImpl: FakeSocket,
      fetchImpl: async (url, init) => {
        posts.push({ url, init });
        if (fetchError) throw fetchError;
        return { ok: status >= 200 && status < 300, status };
      },
      setTimer: (fn, ms) => {
        const t = { id: nextId++, fn, ms, cleared: false, fired: false };
        timers.push(t);
        return t.id;
      },
      clearTimer: id => {
        const t = timers.find(x => x.id === id);
        if (t) t.cleared = true;
      },
    },
  );
  const live = () => timers.filter(t => !t.cleared && !t.fired);
  const fire = t => { t.fired = true; t.fn(); };
  return { conn, posts, notes, logs, live, fire, sockets: () => FakeSocket.instances, latest: () => FakeSocket.instances.at(-1) };
}

test("connects to the EventSub endpoint by default", () => {
  const { sockets } = setup();
  assert.equal(sockets()[0].url, EVENTSUB_URL);
  assert.equal(EVENTSUB_URL, "wss://eventsub.wss.twitch.tv/ws");
});

test("welcome subscribes to follows as the moderator", async () => {
  const { latest, posts } = setup();
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://api.test/eventsub/subscriptions");
  assert.equal(posts[0].init.method, "POST");
  assert.equal(posts[0].init.headers["Client-Id"], "cid");
  assert.equal(posts[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(posts[0].init.body), {
    type: "channel.follow",
    version: "2",
    condition: { broadcaster_user_id: "100", moderator_user_id: "200" },
    transport: { method: "websocket", session_id: "s1" },
  });
  assert.deepEqual(followSubscription("s1", "100", "200"), JSON.parse(posts[0].init.body));
});

test("forwards each notification once", async () => {
  const { latest, notes } = setup();
  latest().receive(welcome("s1"));
  latest().receive(follow("m1", "A"));
  latest().receive(follow("m1", "A"));
  latest().receive(follow("m2", "B"));
  assert.deepEqual(notes.map(n => n.event.user_name), ["A", "B"]);
});

test("silence past the keepalive window reconnects with backoff", () => {
  const { latest, live, fire, sockets } = setup();
  latest().receive(welcome("s1", 10));
  const silence = live().filter(t => t.ms === 15000);
  assert.equal(silence.length, 1);
  fire(silence[0]);
  assert.equal(sockets()[0].closed, true);
  assert.deepEqual(live().map(t => t.ms), [1000]);
  fire(live()[0]);
  assert.equal(sockets().length, 2);
});

test("keepalive messages re-arm the silence timer", () => {
  const { latest, live } = setup();
  latest().receive(welcome("s1", 10));
  latest().receive(keepaliveMsg());
  latest().receive(keepaliveMsg());
  assert.equal(live().filter(t => t.ms === 15000).length, 1);
});

test("session_reconnect swaps sockets after the new welcome without re-subscribing", async () => {
  const { latest, posts, notes, sockets } = setup();
  const old = latest();
  old.receive(welcome("s1"));
  await flush();
  old.receive(reconnectMsg("wss://reconnect.test/ws"));
  const next = latest();
  assert.equal(next.url, "wss://reconnect.test/ws");
  assert.equal(old.closed, false);
  next.receive(welcome("s1"));
  await flush();
  assert.equal(old.closed, true);
  assert.equal(posts.length, 1);
  next.receive(follow("m9", "C"));
  assert.deepEqual(notes.map(n => n.event.user_name), ["C"]);
  assert.equal(sockets().length, 2);
});

test("an unexpected close reconnects", () => {
  const { latest, live } = setup();
  latest().receive(welcome("s1"));
  latest().close();
  assert.deepEqual(live().map(t => t.ms), [1000]);
});

test("a refused subscription stops for good", async () => {
  const { latest, live, logs, sockets } = setup({ status: 403 });
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(latest().closed, true);
  assert.deepEqual(live(), []);
  assert.equal(logs.length, 1);
  assert.equal(sockets().length, 1);
});

test("a failed subscribe request reconnects to try again", async () => {
  const { latest, live } = setup({ fetchError: new Error("offline") });
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(latest().closed, true);
  assert.deepEqual(live().map(t => t.ms), [1000]);
});

test("close stops everything", () => {
  const { conn, latest, live } = setup();
  latest().receive(welcome("s1"));
  conn.close();
  assert.equal(latest().closed, true);
  assert.deepEqual(live(), []);
});

test("a stale socket's refusal is ignored once reconnecting has started", async () => {
  FakeSocket.instances = [];
  const logs = [];
  const timers = [];
  let nextId = 1;
  let resolvePost;
  const postPromise = new Promise(resolve => { resolvePost = resolve; });
  connectEventSub(
    {
      token: "tok", clientId: "cid", broadcasterId: "100", moderatorId: "200",
      onNotification: () => {}, apiBase: "https://api.test",
      log: { warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
    },
    {
      WebSocketImpl: FakeSocket,
      fetchImpl: async () => postPromise,
      setTimer: (fn, ms) => {
        const t = { id: nextId++, fn, ms, cleared: false, fired: false };
        timers.push(t);
        return t.id;
      },
      clearTimer: id => {
        const t = timers.find(x => x.id === id);
        if (t) t.cleared = true;
      },
    },
  );
  const live = () => timers.filter(t => !t.cleared && !t.fired);
  const sock = FakeSocket.instances[0];
  sock.receive(welcome("s1"));
  sock.close(); // unexpected close while the subscription POST is still in flight
  resolvePost({ ok: false, status: 400 });
  await flush();
  assert.equal(logs.length, 0);
  assert.deepEqual(live().map(t => t.ms), [1000]);
});

test("repeated subscription failures grow the backoff", async () => {
  const { latest, live, fire } = setup({ status: 500 });
  latest().receive(welcome("s1"));
  await flush();
  assert.deepEqual(live().map(t => t.ms), [1000]);
  fire(live()[0]);
  latest().receive(welcome("s1"));
  await flush();
  assert.deepEqual(live().map(t => t.ms), [2000]);
});
