import { test } from "node:test";
import assert from "node:assert/strict";
import { demoUpdate } from "../js/events-demo.js";
import { BOXES } from "../js/event-map.js";

test("the first four demo updates fill every box", () => {
  assert.deepEqual([0, 1, 2, 3].map(n => demoUpdate(n).box), BOXES);
});

test("demo names include a 25-character name early and none longer", () => {
  const names = Array.from({ length: 8 }, (_, n) => demoUpdate(n).name);
  assert.ok(names.some(name => name.length === 25));
  assert.ok(names.every(name => name.length <= 25));
});
