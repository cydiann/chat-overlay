import { test } from "node:test";
import assert from "node:assert/strict";
import { unescapeTag, parseLine, roleFromBadges, toEvent } from "../js/irc.js";

const PRIVMSG =
  "@badge-info=;badges=moderator/1,subscriber/12;color=#FF69B4;display-name=CometCass;emotes=25:0-4;id=abc-123;room-id=659811388;user-id=42 " +
  ":cometcass!cometcass@cometcass.tmi.twitch.tv PRIVMSG #lennelen :Kappa hi: there";

test("unescapeTag handles IRCv3 escapes", () => {
  assert.equal(unescapeTag("a\\sb\\:c\\\\d"), "a b;c\\d");
  assert.equal(unescapeTag("line\\r\\n"), "line\r\n");
  assert.equal(unescapeTag("trailing\\"), "trailing");
  assert.equal(unescapeTag("\\x"), "x");
});

test("parseLine splits tags, prefix, command and params", () => {
  const msg = parseLine(PRIVMSG);
  assert.equal(msg.tags["display-name"], "CometCass");
  assert.equal(msg.tags["badge-info"], "");
  assert.equal(msg.prefix, "cometcass!cometcass@cometcass.tmi.twitch.tv");
  assert.equal(msg.command, "PRIVMSG");
  assert.deepEqual(msg.params, ["#lennelen", "Kappa hi: there"]);
});

test("parseLine handles lines without tags or prefix", () => {
  assert.deepEqual(parseLine("PING :tmi.twitch.tv"), {
    tags: {}, prefix: null, command: "PING", params: ["tmi.twitch.tv"],
  });
});

test("roleFromBadges picks the highest role", () => {
  assert.equal(roleFromBadges("moderator/1,broadcaster/1"), "broadcaster");
  assert.equal(roleFromBadges("subscriber/3,moderator/1"), "moderator");
  assert.equal(roleFromBadges("vip/1"), "vip");
  assert.equal(roleFromBadges("subscriber/3"), null);
  assert.equal(roleFromBadges(""), null);
  assert.equal(roleFromBadges(undefined), null);
});

test("toEvent builds a message event from PRIVMSG", () => {
  assert.deepEqual(toEvent(parseLine(PRIVMSG)), {
    type: "message",
    id: "abc-123",
    userId: "42",
    login: "cometcass",
    displayName: "CometCass",
    color: "#FF69B4",
    role: "moderator",
    emotes: "25:0-4",
    text: "Kappa hi: there",
    action: false,
  });
});

test("toEvent unwraps /me ACTION messages", () => {
  const ev = toEvent(parseLine(":a!a@a.tmi.twitch.tv PRIVMSG #lennelen :\u0001ACTION waves\u0001"));
  assert.equal(ev.text, "waves");
  assert.equal(ev.action, true);
  assert.equal(ev.displayName, "a");
  assert.equal(ev.color, null);
  assert.equal(ev.emotes, "");
});

test("toEvent maps moderation and room commands", () => {
  assert.deepEqual(
    toEvent(parseLine("@login=foo;target-msg-id=abc-123 :tmi.twitch.tv CLEARMSG #lennelen :bad words")),
    { type: "clearmsg", targetId: "abc-123" },
  );
  assert.deepEqual(
    toEvent(parseLine("@room-id=1;target-user-id=42 :tmi.twitch.tv CLEARCHAT #lennelen :cometcass")),
    { type: "clearuser", userId: "42", login: "cometcass" },
  );
  assert.deepEqual(toEvent(parseLine("@room-id=1 :tmi.twitch.tv CLEARCHAT #lennelen")), { type: "clearall" });
  assert.deepEqual(
    toEvent(parseLine("@emote-only=0;room-id=659811388 :tmi.twitch.tv ROOMSTATE #lennelen")),
    { type: "roomstate", roomId: "659811388" },
  );
  assert.deepEqual(toEvent(parseLine("PING :tmi.twitch.tv")), { type: "ping", payload: "tmi.twitch.tv" });
  assert.deepEqual(toEvent(parseLine(":tmi.twitch.tv RECONNECT")), { type: "reconnect" });
});

test("toEvent ignores other commands", () => {
  assert.equal(toEvent(parseLine(":tmi.twitch.tv 001 justinfan123 :Welcome, GLHF!")), null);
});
