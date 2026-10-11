import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, normalize, parseConfig, serializeConfig, cssVars } from "../js/config.js";

test("empty query gives defaults", () => {
  assert.deepEqual(parseConfig(""), defaults());
  assert.equal(defaults().channel, "lennelen");
  assert.equal(defaults().fade, 30);
});

test("parses typed values", () => {
  const c = parseConfig("?fade=10&namecolor=1&pill=FF0000&font=Poppins&channel=Someone&lh=1.2");
  assert.equal(c.fade, 10);
  assert.equal(c.namecolor, true);
  assert.equal(c.pill, "#ff0000");
  assert.equal(c.font, "Poppins");
  assert.equal(c.channel, "Someone");
  assert.equal(c.lh, 1.2);
});

test("invalid values fall back to defaults", () => {
  const c = parseConfig("?fade=abc&max=0&pill=zzz&font=Comic&stars=maybe&channel=&size=");
  const d = defaults();
  for (const key of ["fade", "max", "pill", "font", "stars", "channel", "size"]) {
    assert.equal(c[key], d[key], key);
  }
});

test("unknown params are ignored", () => {
  assert.deepEqual(parseConfig("?nope=1"), defaults());
});

test("normalize accepts typed values from postMessage", () => {
  const c = normalize({ fade: 5, stars: false, glass: "#000000" });
  assert.equal(c.fade, 5);
  assert.equal(c.stars, false);
  assert.equal(c.glass, "#000000");
  assert.equal(c.max, 8);
});

test("serialize omits defaults", () => {
  assert.equal(serializeConfig(defaults()), "");
});

test("serialize writes only changed values in schema order", () => {
  const values = { ...defaults(), namecolor: true, pill: "#ff0000", fade: 10 };
  assert.equal(serializeConfig(values), "fade=10&pill=ff0000&namecolor=1");
});

test("serialize and parse round trip", () => {
  const values = { ...defaults(), hide: "nightbot,lennbot", stars: false, font: "Cormorant Garamond", lh: 1.8 };
  assert.deepEqual(parseConfig("?" + serializeConfig(values)), values);
});

test("cssVars maps values to custom properties", () => {
  const vars = cssVars(defaults());
  assert.equal(vars["--glass-bg"], "rgba(18, 26, 56, 0.5)");
  assert.equal(vars["--pill-bg"], "rgba(195, 178, 245, 0.4)");
  assert.equal(vars["--size"], "14px");
  assert.equal(vars["--lh"], "1.5");
  assert.equal(vars["--font-msg"], '"Urbanist"');
  assert.equal(vars["--font-name"], '"Marcellus"');
  assert.equal(vars["--border-a"], "rgba(169, 183, 232, 0.55)");
  assert.equal(vars["--sheen"], "rgba(255, 255, 255, 0.12)");
});
