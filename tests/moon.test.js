import { test } from "node:test";
import assert from "node:assert/strict";
import { fnv1a, moonPhase, moonPath } from "../js/moon.js";

test("fnv1a matches reference values", () => {
  assert.equal(fnv1a(""), 0x811c9dc5);
  assert.equal(fnv1a("a"), 0xe40c292c);
});

test("moonPhase is deterministic and in range", () => {
  assert.equal(moonPhase("659811388"), moonPhase("659811388"));
  for (const id of ["", "1", "42", "659811388", "demo-cometcass"]) {
    const p = moonPhase(id);
    assert.ok(Number.isInteger(p) && p >= 0 && p < 8, `${id} -> ${p}`);
  }
});

test("moonPhase spreads ids across all phases", () => {
  const counts = Array(8).fill(0);
  for (let i = 0; i < 2000; i++) counts[moonPhase(String(100000000 + i * 7919))]++;
  for (const c of counts) assert.ok(c > 150, `uneven spread: ${counts}`);
});

test("moonPath draws limb then terminator", () => {
  assert.equal(moonPath(4), "M 12 2 A 10 10 0 0 1 12 22 A 10 10 0 0 1 12 2 Z"); // full: terminator bulges left
  assert.equal(moonPath(0), "M 12 2 A 10 10 0 0 1 12 22 A 10 10 0 0 0 12 2 Z"); // new: zero area
  assert.equal(moonPath(2), "M 12 2 A 10 10 0 0 1 12 22 A 0 10 0 0 0 12 2 Z"); // first quarter: right half
  assert.equal(moonPath(1), "M 12 2 A 10 10 0 0 1 12 22 A 7.07 10 0 0 0 12 2 Z"); // waxing crescent
  assert.equal(moonPath(7), "M 12 2 A 10 10 0 0 0 12 22 A 7.07 10 0 0 1 12 2 Z"); // waning crescent: lit left
});
