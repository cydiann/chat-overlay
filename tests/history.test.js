import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeHistory, fetchHistory, createWarnOnce } from "../js/history.js";

const T = "2026-10-12T18:04:11.123456+00:00";
const T_MS = Date.parse(T);

test("remote entries newer than the cache win", () => {
  const cached = { subscriber: { name: "old", at: T_MS - 1 }, gifter: null, resub: { name: "legacy", at: 0 } };
  const remote = {
    subscriber: { name: "pixelmount", updated_at: T },
    gifter: { name: "YukinoStfu", updated_at: T },
    resub: { name: "Wiki_HYPERS", updated_at: T },
  };
  assert.deepEqual(mergeHistory(cached, remote), [
    { box: "subscriber", name: "pixelmount", at: T_MS },
    { box: "gifter", name: "YukinoStfu", at: T_MS },
    { box: "resub", name: "Wiki_HYPERS", at: T_MS },
  ]);
});

test("the cache wins when it is newer or the same age", () => {
  const cached = { subscriber: { name: "live", at: T_MS + 1 }, resub: { name: "same", at: T_MS } };
  const remote = { subscriber: { name: "older", updated_at: T }, resub: { name: "same", updated_at: T } };
  assert.deepEqual(mergeHistory(cached, remote), []);
});

test("missing boxes, bad dates and empty names are skipped", () => {
  const remote = {
    subscriber: { name: "x", updated_at: "not a date" },
    gifter: { name: "", updated_at: T },
    resub: { updated_at: T },
  };
  assert.deepEqual(mergeHistory({}, remote), []);
  assert.deepEqual(mergeHistory({}, {}), []);
  assert.deepEqual(mergeHistory({}, null), []);
});

test("follower is merged like the other boxes", () => {
  const remote = { follower: { name: "beronelol", updated_at: T } };
  assert.deepEqual(mergeHistory({ follower: { name: "old", at: 0 } }, remote), [
    { box: "follower", name: "beronelol", at: T_MS },
  ]);
});

test("unknown boxes are ignored", () => {
  assert.deepEqual(mergeHistory({}, { raider: { name: "r", updated_at: T } }), []);
});

test("fetchHistory returns the parsed body and sets a timeout signal", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ resub: { name: "a", updated_at: T } }) };
  };
  const body = await fetchHistory("https://example.test/event-boxes", { fetchImpl });
  assert.deepEqual(body, { resub: { name: "a", updated_at: T } });
  assert.equal(seen.url, "https://example.test/event-boxes");
  assert.ok(seen.init.signal instanceof AbortSignal);
});

test("fetchHistory rejects on a non-2xx status", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(fetchHistory("https://example.test/event-boxes", { fetchImpl }), /500/);
});

test("createWarnOnce warns on the first failure and again only after a success", () => {
  const seen = [];
  const warn = createWarnOnce(err => seen.push(err));
  warn.fail("a");
  warn.fail("b");
  warn.ok();
  warn.ok();
  warn.fail("c");
  warn.fail("d");
  assert.deepEqual(seen, ["a", "c"]);
});
