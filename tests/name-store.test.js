import { test } from "node:test";
import assert from "node:assert/strict";
import { createNameStore } from "../js/name-store.js";

function fakeStorage() {
  const map = new Map();
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test("saves and loads names per box", () => {
  const storage = fakeStorage();
  const store = createNameStore("lennelen", storage);
  assert.equal(store.load("follower"), null);
  store.save("follower", "MoonlitMara");
  store.save("gifter", "Nova");
  assert.equal(store.load("follower"), "MoonlitMara");
  assert.equal(store.load("gifter"), "Nova");
  assert.equal(storage.map.get("event-boxes:lennelen:follower"), "MoonlitMara");
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
