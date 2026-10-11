import { test } from "node:test";
import assert from "node:assert/strict";
import { createNameStore } from "../js/name-store.js";

function fakeStorage() {
  const map = new Map();
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test("saves and loads names per box with their time", () => {
  const storage = fakeStorage();
  const store = createNameStore("lennelen", storage);
  assert.equal(store.load("follower"), null);
  store.save("follower", "MoonlitMara", 1000);
  store.save("gifter", "Nova", 2000);
  assert.deepEqual(store.load("follower"), { name: "MoonlitMara", at: 1000 });
  assert.deepEqual(store.load("gifter"), { name: "Nova", at: 2000 });
  assert.equal(storage.map.get("event-boxes:lennelen:follower"), '{"name":"MoonlitMara","at":1000}');
});

test("save defaults the time to now", () => {
  const store = createNameStore("lennelen", fakeStorage());
  const before = Date.now();
  store.save("resub", "Wiki_HYPERS");
  const { at } = store.load("resub");
  assert.ok(at >= before && at <= Date.now());
});

test("names saved before timestamps load with time 0", () => {
  const storage = fakeStorage();
  const store = createNameStore("lennelen", storage);
  for (const legacy of ["pixelmount", "123", "null", '{"name":"x"}']) {
    storage.map.set("event-boxes:lennelen:subscriber", legacy);
    assert.deepEqual(store.load("subscriber"), { name: legacy, at: 0 });
  }
});

test("channels do not share names", () => {
  const storage = fakeStorage();
  createNameStore("lennelen", storage).save("resub", "A");
  assert.equal(createNameStore("other", storage).load("resub"), null);
});

test("throwing or missing storage is tolerated", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  const store = createNameStore("lennelen", broken);
  assert.equal(store.load("follower"), null);
  assert.doesNotThrow(() => store.save("follower", "x"));
  const none = createNameStore("lennelen", null);
  assert.equal(none.load("follower"), null);
  assert.doesNotThrow(() => none.save("follower", "x"));
});
