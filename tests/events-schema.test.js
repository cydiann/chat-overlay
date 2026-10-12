import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, parseConfig, serializeConfig } from "../js/config.js";
import { EVENTS_SCHEMA, titleFor, eventsCssVars } from "../js/events-schema.js";

const d = () => defaults(EVENTS_SCHEMA);

test("events defaults match the design", () => {
  const v = d();
  assert.equal(v.channel, "lennelen");
  assert.equal(v.namefont, "Quicksand");
  assert.equal(v.namesize, 22);
  assert.equal(v.boxw, 306);
  assert.equal(v.boxh, 60);
  assert.equal(v.demo, false);
});

test("titleFor returns each box's title", () => {
  const v = d();
  assert.equal(titleFor(v, "follower"), "New Follower");
  assert.equal(titleFor(v, "subscriber"), "New Subscriber");
  assert.equal(titleFor(v, "gifter"), "Recent Gifter");
  assert.equal(titleFor(v, "resub"), "Recent Resub");
});

test("titles with spaces survive a URL round trip", () => {
  const values = { ...d(), tfollow: "Newest Follower", tresub: "Welcome Back" };
  assert.deepEqual(parseConfig("?" + serializeConfig(values, EVENTS_SCHEMA), EVENTS_SCHEMA), values);
});

test("channel is cleaned like the chat overlay's", () => {
  assert.equal(parseConfig("?channel=%40LenneLen", EVENTS_SCHEMA).channel, "lennelen");
});

test("eventsCssVars maps values to custom properties", () => {
  const vars = eventsCssVars(d());
  assert.equal(vars["--box-w"], "306px");
  assert.equal(vars["--box-h"], "60px");
  assert.equal(vars["--name-font"], '"Quicksand"');
  assert.equal(vars["--name-size"], "22px");
  assert.equal(vars["--title-size"], "44px");
  assert.equal(vars["--fill-a"], "rgba(171, 151, 178, 1)");
  assert.equal(vars["--fill-b"], "rgba(162, 147, 204, 1)");
  assert.equal(vars["--shadow"], "rgba(60, 40, 90, 0.16)");
});

test("schema keys are unique", () => {
  const keys = EVENTS_SCHEMA.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("history defaults to LennBot and can be turned off", () => {
  assert.equal(d().history, "https://lennbot-production.up.railway.app/event-boxes");
  const off = { ...d(), history: "" };
  assert.equal(parseConfig("?" + serializeConfig(off, EVENTS_SCHEMA), EVENTS_SCHEMA).history, "");
});

test("fill opacity fades both fill colors and survives a URL round trip", () => {
  const values = { ...d(), fillopacity: 50 };
  const vars = eventsCssVars(values);
  assert.equal(vars["--fill-a"], "rgba(171, 151, 178, 0.5)");
  assert.equal(vars["--fill-b"], "rgba(162, 147, 204, 0.5)");
  assert.deepEqual(parseConfig("?" + serializeConfig(values, EVENTS_SCHEMA), EVENTS_SCHEMA), values);
  assert.equal(parseConfig("?fillopacity=150", EVENTS_SCHEMA).fillopacity, 100);
});
