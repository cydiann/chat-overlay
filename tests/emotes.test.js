import { test } from "node:test";
import assert from "node:assert/strict";
import { from7tv, fromBttv, fromFfz, mergeEmotes, loadEmotes } from "../js/emotes.js";

const seven = (name, id, flags = 0) => ({ name, flags, data: { host: { url: `//cdn.7tv.app/emote/${id}` } } });
const ffz = name => ({ name, urls: { "1": `https://cdn.frankerfacez.com/emote/${name}/1`, "2": `https://cdn.frankerfacez.com/emote/${name}/2` } });

test("from7tv maps names, 2x webp urls and zero-width flag", () => {
  const set = { emotes: [seven("catJAM", "A"), seven("PETPET", "B", 1), { name: "Gone", flags: 0, data: null }] };
  assert.deepEqual(from7tv(set), [
    { name: "catJAM", url: "https://cdn.7tv.app/emote/A/2x.webp", zeroWidth: false },
    { name: "PETPET", url: "https://cdn.7tv.app/emote/B/2x.webp", zeroWidth: true },
  ]);
  assert.deepEqual(from7tv(null), []);
});

test("fromBttv maps code and id", () => {
  assert.deepEqual(fromBttv([{ id: "X", code: "monkaS" }]), [
    { name: "monkaS", url: "https://cdn.betterttv.net/emote/X/2x", zeroWidth: false },
  ]);
  assert.deepEqual(fromBttv(undefined), []);
});

test("fromFfz reads selected sets and fixes protocol-relative urls", () => {
  const data = {
    sets: {
      "3": { emoticons: [ffz("ZrehplaR")] },
      "9": { emoticons: [{ name: "Old", urls: { "1": "//cdn.frankerfacez.com/emote/1/1" } }] },
    },
  };
  assert.deepEqual(fromFfz(data, ["3"]), [
    { name: "ZrehplaR", url: "https://cdn.frankerfacez.com/emote/ZrehplaR/2", zeroWidth: false },
  ]);
  assert.deepEqual(fromFfz(data).map(e => e.url), [
    "https://cdn.frankerfacez.com/emote/ZrehplaR/2",
    "https://cdn.frankerfacez.com/emote/1/1",
  ]);
  assert.deepEqual(fromFfz(null), []);
});

test("mergeEmotes keeps the first occurrence of a name", () => {
  const map = mergeEmotes(
    [{ name: "A", url: "first", zeroWidth: false }],
    [{ name: "A", url: "second", zeroWidth: true }, { name: "B", url: "b", zeroWidth: false }],
  );
  assert.deepEqual([...map.entries()], [
    ["A", { url: "first", zeroWidth: false }],
    ["B", { url: "b", zeroWidth: false }],
  ]);
});

test("loadEmotes merges providers in priority order and skips failures", async t => {
  t.mock.method(console, "warn", () => {});
  const responses = {
    "https://7tv.io/v3/users/twitch/42": { emote_set: { emotes: [seven("Shared", "CH")] } },
    "https://7tv.io/v3/emote-sets/global": { emotes: [seven("Global7", "GL")] },
    "https://api.betterttv.net/3/cached/users/twitch/42": {
      channelEmotes: [{ id: "B1", code: "Shared" }],
      sharedEmotes: [{ id: "B2", code: "SharedB" }],
    },
    "https://api.betterttv.net/3/cached/emotes/global": [{ id: "B3", code: "GlobalB" }],
    "https://api.frankerfacez.com/v1/set/global": {
      default_sets: [3],
      sets: { "3": { emoticons: [ffz("GlobalF")] }, "4": { emoticons: [ffz("NotDefault")] } },
    },
  };
  const getJson = async url => {
    if (url in responses) return responses[url];
    throw new Error(`404 ${url}`);
  };
  const map = await loadEmotes("42", getJson);
  assert.equal(map.get("Shared").url, "https://cdn.7tv.app/emote/CH/2x.webp");
  for (const name of ["Global7", "SharedB", "GlobalB", "GlobalF"]) assert.ok(map.has(name), name);
  assert.equal(map.has("NotDefault"), false);
});

test("loadEmotes resolves to an empty map when everything fails", async t => {
  t.mock.method(console, "warn", () => {});
  const map = await loadEmotes("42", async () => { throw new Error("offline"); });
  assert.equal(map.size, 0);
});
