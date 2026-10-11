import { test } from "node:test";
import assert from "node:assert/strict";
import { isHex, hexToRgba, mixWithWhite } from "../js/color.js";

test("isHex accepts only #rrggbb", () => {
  assert.equal(isHex("#a9B7e8"), true);
  assert.equal(isHex("a9b7e8"), false);
  assert.equal(isHex("#abc"), false);
  assert.equal(isHex("#zzzzzz"), false);
});

test("hexToRgba converts with percent opacity", () => {
  assert.equal(hexToRgba("#121a38", 50), "rgba(18, 26, 56, 0.5)");
  assert.equal(hexToRgba("#ffffff", 12), "rgba(255, 255, 255, 0.12)");
  assert.equal(hexToRgba("#000000", 0), "rgba(0, 0, 0, 0)");
});

test("mixWithWhite moves each channel toward 255", () => {
  assert.equal(mixWithWhite("#000000", 50), "#808080");
  assert.equal(mixWithWhite("#ff0000", 0), "#ff0000");
  assert.equal(mixWithWhite("#123456", 100), "#ffffff");
});
