import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTwitchEmotes, twitchEmoteUrl, tokenize, isEmoteOnly } from "../js/tokenize.js";

const KAPPA = twitchEmoteUrl("25");
const map = new Map([
  ["catJAM", { url: "https://cdn.7tv.app/emote/A/2x.webp", zeroWidth: false }],
  ["PETPET", { url: "https://cdn.7tv.app/emote/B/2x.webp", zeroWidth: true }],
]);
const emote = (name, url, overlays = []) => ({ type: "emote", name, url, overlays });

test("twitchEmoteUrl uses the v2 CDN", () => {
  assert.equal(KAPPA, "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0");
});

test("parseTwitchEmotes reads ids and ranges sorted by start", () => {
  assert.deepEqual(parseTwitchEmotes("25:12-16,0-4/1902:6-10"), [
    { id: "25", start: 0, end: 4 },
    { id: "1902", start: 6, end: 10 },
    { id: "25", start: 12, end: 16 },
  ]);
  assert.deepEqual(parseTwitchEmotes(""), []);
});

test("plain text is one text token", () => {
  assert.deepEqual(tokenize("hello there", "", map), [{ type: "text", text: "hello there" }]);
});

test("Twitch emote ranges become emote tokens", () => {
  assert.deepEqual(tokenize("Kappa hello Kappa", "25:0-4,12-16", map), [
    emote("Kappa", KAPPA),
    { type: "text", text: " hello " },
    emote("Kappa", KAPPA),
  ]);
});

test("emoji before an emote do not shift positions", () => {
  assert.deepEqual(tokenize("😀 Kappa", "25:2-6", map), [
    { type: "text", text: "😀 " },
    emote("Kappa", KAPPA),
  ]);
});

test("third-party emotes match whole words", () => {
  assert.deepEqual(tokenize("hi catJAM catJAMs", "", map), [
    { type: "text", text: "hi " },
    emote("catJAM", "https://cdn.7tv.app/emote/A/2x.webp"),
    { type: "text", text: " catJAMs" },
  ]);
});

test("zero-width emotes stack on the previous emote", () => {
  assert.deepEqual(tokenize("catJAM PETPET yay", "", map), [
    emote("catJAM", "https://cdn.7tv.app/emote/A/2x.webp", [
      { name: "PETPET", url: "https://cdn.7tv.app/emote/B/2x.webp" },
    ]),
    { type: "text", text: " yay" },
  ]);
});

test("zero-width emote with nothing to stack on renders normally", () => {
  assert.deepEqual(tokenize("PETPET hi", "", map), [
    emote("PETPET", "https://cdn.7tv.app/emote/B/2x.webp"),
    { type: "text", text: " hi" },
  ]);
});

test("out-of-range Twitch emote ranges are ignored", () => {
  assert.deepEqual(tokenize("hi", "25:0-10", map), [{ type: "text", text: "hi" }]);
});

test("isEmoteOnly ignores whitespace", () => {
  assert.equal(isEmoteOnly(tokenize("Kappa Kappa", "25:0-4,6-10", map)), true);
  assert.equal(isEmoteOnly(tokenize("Kappa hi", "25:0-4", map)), false);
  assert.equal(isEmoteOnly(tokenize("   ", "", map)), false);
});

test("duplicate-message bypass characters are dropped", () => {
  const twitch = tokenize("Kappa \u{E0000}", "25:0-4", map);
  assert.equal(isEmoteOnly(twitch), true);
  assert.deepEqual(twitch, [emote("Kappa", KAPPA), { type: "text", text: " " }]);
  assert.equal(isEmoteOnly(tokenize("catJAM \u{E0000}", "", map)), true);
  assert.equal(isEmoteOnly(tokenize("catJAM ͏", "", map)), true);
});

test("bypass characters before an emote do not shift its range", () => {
  assert.deepEqual(tokenize("\u{E0000} Kappa", "25:2-6", map), [
    { type: "text", text: " " },
    emote("Kappa", KAPPA),
  ]);
});
