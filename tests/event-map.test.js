import { test } from "node:test";
import assert from "node:assert/strict";
import { BOXES, mapFollow, mapUsernotice } from "../js/event-map.js";

const notice = (msgId, extra = {}) => ({
  type: "usernotice", msgId, login: "cometcass", displayName: "CometCass", communityGiftId: "", ...extra,
});
const anon = { login: "ananonymousgifter", displayName: "AnAnonymousGifter" };

test("boxes are in display order", () => {
  assert.deepEqual(BOXES, ["follower", "subscriber", "gifter", "resub"]);
});

test("mapFollow reads channel.follow notifications", () => {
  const payload = { subscription: { type: "channel.follow" }, event: { user_name: "MoonlitMara", user_login: "moonlitmara" } };
  assert.deepEqual(mapFollow(payload), { box: "follower", name: "MoonlitMara" });
  assert.equal(mapFollow({ subscription: { type: "channel.raid" }, event: { user_name: "x" } }), null);
  assert.equal(mapFollow(undefined), null);
});

test("sub and resub go to their boxes", () => {
  assert.deepEqual(mapUsernotice(notice("sub")), { box: "subscriber", name: "CometCass" });
  assert.deepEqual(mapUsernotice(notice("resub")), { box: "resub", name: "CometCass" });
});

test("a mystery gift credits the gifter", () => {
  assert.deepEqual(mapUsernotice(notice("submysterygift")), { box: "gifter", name: "CometCass" });
  assert.deepEqual(mapUsernotice(notice("submysterygift", anon)), { box: "gifter", name: "Anonymous" });
});

test("subgifts that belong to a mystery gift are ignored", () => {
  assert.equal(mapUsernotice(notice("subgift", { communityGiftId: "2939021" })), null);
});

test("a single subgift credits the gifter", () => {
  assert.deepEqual(mapUsernotice(notice("subgift")), { box: "gifter", name: "CometCass" });
  assert.deepEqual(mapUsernotice(notice("subgift", anon)), { box: "gifter", name: "Anonymous" });
});

test("legacy anonymous gift ids credit Anonymous", () => {
  assert.deepEqual(mapUsernotice(notice("anonsubgift")), { box: "gifter", name: "Anonymous" });
  assert.deepEqual(mapUsernotice(notice("anonsubmysterygift")), { box: "gifter", name: "Anonymous" });
  assert.equal(mapUsernotice(notice("anonsubgift", { communityGiftId: "9" })), null);
});

test("other notices and events are ignored", () => {
  for (const id of ["raid", "giftpaidupgrade", "primepaidupgrade", "announcement", ""]) {
    assert.equal(mapUsernotice(notice(id)), null, id);
  }
  assert.equal(mapUsernotice({ type: "message", text: "hi" }), null);
});
