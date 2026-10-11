import { test } from "node:test";
import assert from "node:assert/strict";
import { demoMessage } from "../js/demo.js";

test("demo messages have the message event shape", () => {
  const ev = demoMessage(0, []);
  assert.deepEqual(Object.keys(ev).sort(), [
    "action", "color", "displayName", "emotes", "id", "login", "role", "text", "type", "userId",
  ]);
  assert.equal(ev.type, "message");
  assert.equal(ev.id, "demo-0");
  assert.equal(ev.login, ev.displayName.toLowerCase());
});

test("every fourth-plus-one message starts with a Twitch Kappa", () => {
  const ev = demoMessage(1, []);
  assert.ok(ev.text.startsWith("Kappa "));
  assert.equal(ev.emotes, "25:0-4");
});

test("some messages use loaded emote names", () => {
  assert.ok(demoMessage(2, ["catJAM"]).text.endsWith(" catJAM"));
  const only = demoMessage(6, ["a", "b", "c"]);
  assert.ok(only.text.split(" ").every(w => ["a", "b", "c"].includes(w)));
  assert.equal(demoMessage(2, []).text.includes("catJAM"), false);
});
