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
  assert.equal(c.channel, "someone");
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

test("channel accepts pasted forms and normalizes them", () => {
  for (const raw of ["#lennelen", "@lennelen", "twitch.tv/lennelen", "https://www.twitch.tv/lennelen", "  LenneLen  ", "https://www.twitch.tv/lennelen/"]) {
    assert.equal(normalize({ channel: raw }).channel, "lennelen", raw);
  }
  assert.equal(normalize({ channel: "#Some_One42" }).channel, "some_one42");
});

test("invalid channels fall back to the default", () => {
  for (const raw of ["", "   ", "two words", "lennelen\r\nJOIN #other", "a".repeat(26), "bad-name"]) {
    assert.equal(normalize({ channel: raw }).channel, "lennelen", JSON.stringify(raw));
  }
  assert.equal(parseConfig("?channel=x%0D%0APRIVMSG").channel, "lennelen");
});

test("plain text fields are left as typed", () => {
  assert.equal(normalize({ hide: "NightBot, LennBot" }).hide, "NightBot, LennBot");
});

test("config functions accept another schema", () => {
  const schema = [
    { key: "a", group: "G", type: "number", default: 1, min: 0, max: 10, label: "A" },
    { key: "b", group: "G", type: "text", default: "x", label: "B" },
  ];
  assert.deepEqual(defaults(schema), { a: 1, b: "x" });
  assert.deepEqual(parseConfig("?a=5&fade=10", schema), { a: 5, b: "x" });
  assert.deepEqual(normalize({ a: 99 }, schema), { a: 1, b: "x" });
  assert.equal(serializeConfig({ a: 5, b: "x" }, schema), "a=5");
});
