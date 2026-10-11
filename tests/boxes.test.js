import { test } from "node:test";
import assert from "node:assert/strict";
import { scrollDistance } from "../js/boxes.js";

test("scrollDistance is zero when the name fits", () => {
  assert.equal(scrollDistance(100, 278), 0);
  assert.equal(scrollDistance(278, 278), 0);
});

test("scrollDistance rounds the overflow up to whole pixels", () => {
  assert.equal(scrollDistance(329.2, 278), 52);
});
