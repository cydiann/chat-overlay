# Celestial Chat Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, auth-free Twitch chat overlay for OBS that renders lennelen's chat as celestial frosted-glass bubbles with Twitch/7TV/BTTV/FFZ emotes, plus a settings page with live preview that produces the OBS URL.

**Architecture:** Plain HTML/CSS/ES modules served from GitHub Pages, no build step. Pure logic (IRC parsing, tokenizing, emote parsing, config, moon hashing, colors) lives in small modules tested with `node:test`; DOM modules (render, effects, main, settings) are verified visually with headless Chromium screenshots. One settings schema drives both URL parsing and the settings form.

**Tech Stack:** Vanilla JS (ES2022 modules), CSS custom properties, Twitch IRC over WebSocket (anonymous `justinfan`), 7TV v3 / BTTV v3 / FFZ v1 public APIs, Google Fonts, Node 24 `node:test` (no npm deps), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-celestial-chat-overlay-design.md`

## Global Constraints

- Repo root: `/home/cagatay/developer/personal/chat-overlay` (all paths below are relative to it). Use absolute paths or `cd` into it in every shell command; the shell cwd can reset.
- No build step, no runtime dependencies, no npm packages. Tests use only `node:test` and `node:assert/strict`.
- `package.json` has `"type": "module"`; every JS file is an ES module with relative `./x.js` imports (extension required).
- Chat content is only ever inserted with text nodes / `textContent`. Never `innerHTML` with chat data.
- Twitch connection is anonymous: `wss://irc-ws.chat.twitch.tv:443`, `NICK justinfan<digits>`, no PASS.
- Default channel `lennelen` (Twitch user ID `659811388`, has a 7TV set; BTTV and FFZ return 404 for it, which must be handled as "no emotes").
- Emote priority on name clash: 7TV channel > 7TV global > BTTV channel/shared > BTTV global > FFZ channel > FFZ global.
- ES modules do not load from `file://`. Local checks use `python3 -m http.server 8000` from the repo root.
- Commit messages: short, a sentence of why, no AI/Claude mention, no `Co-Authored-By` trailer, no em dashes.
- Run all tests with `node --test` from the repo root.

## File Map

| File | Responsibility |
|---|---|
| `package.json` | marks ES modules, `npm test` alias |
| `js/color.js` | `isHex`, `hexToRgba`, `mixWithWhite` |
| `js/schema.js` | `FONTS`, `SCHEMA` (every setting: key, group, type, default, label, limits) |
| `js/config.js` | `defaults`, `normalize`, `parseConfig`, `serializeConfig`, `cssVars` |
| `js/irc.js` | `unescapeTag`, `parseLine`, `roleFromBadges`, `toEvent` |
| `js/moon.js` | `fnv1a`, `moonPhase`, `moonPath` |
| `js/tokenize.js` | `parseTwitchEmotes`, `twitchEmoteUrl`, `tokenize`, `isEmoteOnly` |
| `js/emotes.js` | `from7tv`, `fromBttv`, `fromFfz`, `mergeEmotes`, `loadEmotes` |
| `js/twitch.js` | `backoffDelay`, `connectChat` |
| `js/demo.js` | `demoMessage`, `startDemo` |
| `js/render.js` | `createBubble` (DOM) |
| `js/effects.js` | `renderStarfield`, `startShootingStars`, `sparklePop`, `drawConstellation` (DOM) |
| `js/main.js` | overlay wiring |
| `js/settings.js` | settings page logic |
| `index.html`, `style.css` | overlay page + theme |
| `settings.html` | settings page (inline styles) |
| `tests/*.test.js` | unit tests for pure modules |
| `README.md`, `.nojekyll` | usage docs, Pages config |

## Shared Data Shapes

These are used across tasks. Every task must use exactly these field names.

```js
// Message event (from irc.js toEvent, and from demo.js demoMessage)
{ type: "message", id: string, userId: string, login: string, displayName: string,
  color: string | null, role: "broadcaster" | "moderator" | "vip" | null,
  emotes: string /* raw Twitch emotes tag, "" if none */, text: string, action: boolean }

// Other events from toEvent
{ type: "clearmsg", targetId: string }
{ type: "clearuser", userId: string, login: string }
{ type: "clearall" }
{ type: "roomstate", roomId: string }
{ type: "ping", payload: string }
{ type: "reconnect" }

// Emote map (from emotes.js): Map<name, { url: string, zeroWidth: boolean }>

// Tokens (from tokenize.js)
{ type: "text", text: string }
{ type: "emote", name: string, url: string, overlays: Array<{ name: string, url: string }> }

// Config values object: one key per SCHEMA entry, typed (number / boolean / string; colors are "#rrggbb" lowercase)
```

---

### Task 1: Project scaffold, colors, schema and config

**Files:**
- Create: `package.json`, `js/color.js`, `js/schema.js`, `js/config.js`
- Test: `tests/color.test.js`, `tests/config.test.js`

**Interfaces:**
- Produces: `isHex(value) -> boolean`, `hexToRgba(hex, opacityPct) -> "rgba(r, g, b, a)"`, `mixWithWhite(hex, pct) -> "#rrggbb"`; `FONTS` (object family -> weights string), `SCHEMA` (array of fields); `defaults() -> values`, `normalize(input) -> values`, `parseConfig(search) -> values`, `serializeConfig(values) -> query string without "?"`, `cssVars(values) -> { "--name": "value" }`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chat-overlay",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write failing color tests** in `tests/color.test.js`

```js
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
```

- [ ] **Step 3: Run it, expect failure**

Run: `cd /home/cagatay/developer/personal/chat-overlay && node --test tests/color.test.js`
Expected: FAIL, `Cannot find module '.../js/color.js'`

- [ ] **Step 4: Implement `js/color.js`**

```js
const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value) {
  return HEX.test(value);
}

function channels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex, opacityPct) {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${+(opacityPct / 100).toFixed(3)})`;
}

export function mixWithWhite(hex, pct) {
  const toHex = c => Math.round(c + ((255 - c) * pct) / 100).toString(16).padStart(2, "0");
  return "#" + channels(hex).map(toHex).join("");
}
```

- [ ] **Step 5: Run color tests, expect pass**

Run: `node --test tests/color.test.js`
Expected: 3 passing.

- [ ] **Step 6: Create `js/schema.js`** (no test of its own; config tests cover it)

```js
// Google Fonts families offered in the settings dropdowns, with the weights to request.
// Marcellus only ships 400; requesting a missing weight makes Google Fonts return an error.
export const FONTS = {
  Urbanist: "400;600;700",
  Quicksand: "400;600;700",
  Nunito: "400;600;700",
  Poppins: "400;600;700",
  Marcellus: "400",
  Cinzel: "400;600;700",
  "Cormorant Garamond": "400;600;700",
};

const fontOptions = Object.keys(FONTS);

// Order matters: settings form groups and serialized query order follow it.
export const SCHEMA = [
  { key: "channel", group: "Behavior", type: "text", default: "lennelen", required: true, label: "Twitch channel" },
  { key: "fade", group: "Behavior", type: "number", default: 30, min: 0, max: 600, label: "Fade after (seconds, 0 = never)" },
  { key: "max", group: "Behavior", type: "number", default: 8, min: 1, max: 50, label: "Max messages on screen" },
  { key: "hide", group: "Behavior", type: "text", default: "", label: "Hidden users (comma separated)" },
  { key: "hidecmd", group: "Behavior", type: "bool", default: false, label: "Hide !commands" },

  { key: "font", group: "Text", type: "select", options: fontOptions, default: "Urbanist", label: "Message font" },
  { key: "namefont", group: "Text", type: "select", options: fontOptions, default: "Marcellus", label: "Username font" },
  { key: "size", group: "Text", type: "number", default: 14, min: 8, max: 64, label: "Text size (px)" },
  { key: "lh", group: "Text", type: "number", default: 1.5, min: 1, max: 3, step: 0.1, label: "Line spacing" },
  { key: "textcolor", group: "Text", type: "color", default: "#e9edff", label: "Message text color" },

  { key: "pill", group: "Pill", type: "color", default: "#c3b2f5", label: "Username pill color" },
  { key: "pillop", group: "Pill", type: "number", default: 40, min: 0, max: 100, label: "Pill opacity (0-100)" },
  { key: "nametext", group: "Pill", type: "color", default: "#fefefe", label: "Username text color" },
  { key: "namecolor", group: "Pill", type: "bool", default: false, label: "Tint pill with Twitch name color" },

  { key: "glass", group: "Glass", type: "color", default: "#121a38", label: "Glass tint" },
  { key: "glassop", group: "Glass", type: "number", default: 50, min: 0, max: 100, label: "Glass opacity (0-100)" },
  { key: "blur", group: "Glass", type: "number", default: 12, min: 0, max: 40, label: "Glass blur (px)" },
  { key: "bordera", group: "Glass", type: "color", default: "#a9b7e8", label: "Border color A (moonlight silver)" },
  { key: "borderb", group: "Glass", type: "color", default: "#b78cff", label: "Border color B (aurora violet)" },
  { key: "borderop", group: "Glass", type: "number", default: 55, min: 0, max: 100, label: "Border strength (0-100)" },
  { key: "sheen", group: "Glass", type: "number", default: 12, min: 0, max: 100, label: "Moonlight sheen (0-100)" },

  { key: "radius", group: "Shape", type: "number", default: 16, min: 0, max: 40, label: "Corner roundness (px)" },
  { key: "shadow", group: "Shape", type: "number", default: 25, min: 0, max: 80, label: "Shadow softness (px)" },
  { key: "gap", group: "Shape", type: "number", default: 20, min: 0, max: 60, label: "Message spacing (px)" },
  { key: "padx", group: "Shape", type: "number", default: 16, min: 0, max: 48, label: "Horizontal padding (px)" },
  { key: "pady", group: "Shape", type: "number", default: 10, min: 0, max: 32, label: "Vertical padding (px)" },

  { key: "ornament", group: "Ornaments", type: "color", default: "#c9b6ff", label: "Constellation and ornament color" },
  { key: "mooncolor", group: "Ornaments", type: "color", default: "#f4eddc", label: "Username moon icon color" },

  { key: "moons", group: "Effects", type: "bool", default: true, label: "Personal moon phases" },
  { key: "sparkles", group: "Effects", type: "bool", default: true, label: "Sparkle pops and particles" },
  { key: "constellation", group: "Effects", type: "bool", default: true, label: "Constellation lines between messages" },
  { key: "stars", group: "Effects", type: "bool", default: true, label: "Ambient starfield" },
  { key: "starcount", group: "Effects", type: "number", default: 70, min: 0, max: 200, label: "Star count (0-200)" },
  { key: "starcolor", group: "Effects", type: "color", default: "#ffffff", label: "Star color" },
  { key: "shooting", group: "Effects", type: "bool", default: true, label: "Random shooting stars" },

  { key: "demo", group: "Demo", type: "bool", default: false, label: "Demo mode (turn off before going live)" },
  { key: "bg", group: "Demo", type: "bool", default: false, label: "Night sky preview background" },
];
```

- [ ] **Step 7: Write failing config tests** in `tests/config.test.js`

```js
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
```

- [ ] **Step 8: Run, expect failure**

Run: `node --test tests/config.test.js`
Expected: FAIL, cannot find `js/config.js`.

- [ ] **Step 9: Implement `js/config.js`**

```js
import { SCHEMA } from "./schema.js";
import { isHex, hexToRgba } from "./color.js";

export function defaults() {
  return Object.fromEntries(SCHEMA.map(field => [field.key, field.default]));
}

function coerce(field, raw) {
  const s = String(raw).trim();
  switch (field.type) {
    case "number": {
      const n = Number(s);
      if (s === "" || !Number.isFinite(n) || n < field.min || n > field.max) return field.default;
      return n;
    }
    case "bool":
      if (s === "1" || s === "true") return true;
      if (s === "0" || s === "false") return false;
      return field.default;
    case "color": {
      const c = s.startsWith("#") ? s : `#${s}`;
      return isHex(c) ? c.toLowerCase() : field.default;
    }
    case "select":
      return field.options.includes(s) ? s : field.default;
    default:
      return s === "" && field.required ? field.default : s;
  }
}

export function normalize(input) {
  const values = defaults();
  for (const field of SCHEMA) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null) values[field.key] = coerce(field, raw);
  }
  return values;
}

export function parseConfig(search) {
  return normalize(Object.fromEntries(new URLSearchParams(search)));
}

export function serializeConfig(values) {
  const params = new URLSearchParams();
  for (const field of SCHEMA) {
    const v = values[field.key];
    if (v === undefined || v === field.default) continue;
    if (field.type === "bool") params.set(field.key, v ? "1" : "0");
    else if (field.type === "color") params.set(field.key, v.replace("#", ""));
    else params.set(field.key, String(v));
  }
  return params.toString();
}

export function cssVars(v) {
  return {
    "--font-msg": `"${v.font}"`,
    "--font-name": `"${v.namefont}"`,
    "--size": `${v.size}px`,
    "--lh": String(v.lh),
    "--text": v.textcolor,
    "--pill-bg": hexToRgba(v.pill, v.pillop),
    "--name-text": v.nametext,
    "--glass-bg": hexToRgba(v.glass, v.glassop),
    "--blur": `${v.blur}px`,
    "--border-a": hexToRgba(v.bordera, v.borderop),
    "--border-b": hexToRgba(v.borderb, v.borderop),
    "--glow": hexToRgba(v.borderb, Math.round(v.borderop * 0.6)),
    "--sheen": hexToRgba("#ffffff", v.sheen),
    "--radius": `${v.radius}px`,
    "--shadow": `${v.shadow}px`,
    "--gap": `${v.gap}px`,
    "--padx": `${v.padx}px`,
    "--pady": `${v.pady}px`,
    "--ornament": v.ornament,
    "--moon": v.mooncolor,
    "--star": v.starcolor,
  };
}
```

Note: `"Cormorant Garamond"` serializes as `font=Cormorant+Garamond`; `URLSearchParams` decodes `+` back to a space, so the round trip test holds.

- [ ] **Step 10: Run all tests, expect pass**

Run: `node --test`
Expected: all color + config tests pass (12 tests).

- [ ] **Step 11: Commit**

```bash
cd /home/cagatay/developer/personal/chat-overlay
git add package.json js/color.js js/schema.js js/config.js tests/color.test.js tests/config.test.js
git commit -m "Add settings schema and URL config parsing

One schema drives both the overlay's URL params and the future settings form, so settings are defined once."
```

---

### Task 2: IRC parser

**Files:**
- Create: `js/irc.js`
- Test: `tests/irc.test.js`

**Interfaces:**
- Produces: `unescapeTag(value) -> string`, `parseLine(line) -> { tags, prefix, command, params }`, `roleFromBadges(badgesTag) -> role | null`, `toEvent(parsed) -> event | null` (event shapes in "Shared Data Shapes").

- [ ] **Step 1: Write failing tests** in `tests/irc.test.js`

```js
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
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/irc.test.js`
Expected: FAIL, cannot find `js/irc.js`.

- [ ] **Step 3: Implement `js/irc.js`**

```js
const TAG_ESCAPES = { ":": ";", s: " ", "\\": "\\", r: "\r", n: "\n" };

export function unescapeTag(value) {
  return value.replace(/\\(.?)/g, (_, c) => (c in TAG_ESCAPES ? TAG_ESCAPES[c] : c));
}

export function parseLine(line) {
  const msg = { tags: {}, prefix: null, command: "", params: [] };
  let rest = line;

  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ");
    for (const pair of rest.slice(1, space).split(";")) {
      const eq = pair.indexOf("=");
      if (eq === -1) msg.tags[pair] = "";
      else msg.tags[pair.slice(0, eq)] = unescapeTag(pair.slice(eq + 1));
    }
    rest = rest.slice(space + 1);
  }

  if (rest.startsWith(":")) {
    const space = rest.indexOf(" ");
    msg.prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  let trailing = null;
  const trailingAt = rest.indexOf(" :");
  if (trailingAt !== -1) {
    trailing = rest.slice(trailingAt + 2);
    rest = rest.slice(0, trailingAt);
  }

  const parts = rest.split(" ").filter(Boolean);
  msg.command = parts.shift() ?? "";
  msg.params = parts;
  if (trailing !== null) msg.params.push(trailing);
  return msg;
}

const ROLES = ["broadcaster", "moderator", "vip"];

export function roleFromBadges(badges = "") {
  const names = new Set(badges.split(",").map(b => b.split("/")[0]).filter(Boolean));
  return ROLES.find(role => names.has(role)) ?? null;
}

const ACTION = /^\u0001ACTION (.*)\u0001$/;

export function toEvent(msg) {
  const { tags, command, params } = msg;
  switch (command) {
    case "PRIVMSG": {
      const raw = params[1] ?? "";
      const action = ACTION.exec(raw);
      const login = (msg.prefix ?? "").split("!")[0];
      return {
        type: "message",
        id: tags.id ?? "",
        userId: tags["user-id"] ?? "",
        login,
        displayName: tags["display-name"] || login,
        color: tags.color || null,
        role: roleFromBadges(tags.badges),
        emotes: tags.emotes ?? "",
        text: action ? action[1] : raw,
        action: Boolean(action),
      };
    }
    case "CLEARMSG":
      return { type: "clearmsg", targetId: tags["target-msg-id"] ?? "" };
    case "CLEARCHAT":
      return params[1]
        ? { type: "clearuser", userId: tags["target-user-id"] ?? "", login: params[1] }
        : { type: "clearall" };
    case "ROOMSTATE":
      return { type: "roomstate", roomId: tags["room-id"] ?? "" };
    case "PING":
      return { type: "ping", payload: params[0] ?? "" };
    case "RECONNECT":
      return { type: "reconnect" };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test tests/irc.test.js`
Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add js/irc.js tests/irc.test.js
git commit -m "Parse Twitch IRC lines into chat and moderation events"
```

---

### Task 3: Personal moon phases

**Files:**
- Create: `js/moon.js`
- Test: `tests/moon.test.js`

**Interfaces:**
- Produces: `fnv1a(str) -> uint32`, `moonPhase(userId) -> 0..7` (0 new, 1 waxing crescent, 2 first quarter, 3 waxing gibbous, 4 full, 5 waning gibbous, 6 last quarter, 7 waning crescent), `moonPath(phase, r = 10, cx = 12, cy = 12) -> SVG path d string` for a 24x24 viewBox.

- [ ] **Step 1: Write failing tests** in `tests/moon.test.js`

```js
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
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/moon.test.js`
Expected: FAIL, cannot find `js/moon.js`.

- [ ] **Step 3: Implement `js/moon.js`**

```js
export const PHASES = 8;

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function moonPhase(userId) {
  return fnv1a(String(userId)) % PHASES;
}

// Lit region = semicircle limb on the lit side + elliptical terminator back to the top.
// SVG y points down, so sweep=1 from top to bottom traces the right side.
export function moonPath(phase, r = 10, cx = 12, cy = 12) {
  const angle = (phase / PHASES) * 2 * Math.PI;
  const waxing = phase <= PHASES / 2;
  const gibbous = Math.cos(angle) < 0;
  const rx = +(Math.abs(Math.cos(angle)) * r).toFixed(2);
  const limbSweep = waxing ? 1 : 0;
  const termSweep = gibbous ? limbSweep : 1 - limbSweep;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test tests/moon.test.js`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add js/moon.js tests/moon.test.js
git commit -m "Give each chatter a stable moon phase from their user ID"
```

---

### Task 4: Message tokenizer

**Files:**
- Create: `js/tokenize.js`
- Test: `tests/tokenize.test.js`

**Interfaces:**
- Consumes: emote map shape `Map<name, { url, zeroWidth }>` (produced in Task 5, but tests build their own).
- Produces: `parseTwitchEmotes(tag) -> [{ id, start, end }]` sorted by start, `twitchEmoteUrl(id) -> string`, `tokenize(text, emotesTag, emoteMap) -> tokens`, `isEmoteOnly(tokens) -> boolean`.

- [ ] **Step 1: Write failing tests** in `tests/tokenize.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTwitchEmotes, twitchEmoteUrl, tokenize, isEmoteOnly } from "../js/tokenize.js";

const KAPPA = twitchEmoteUrl("25");
const map = new Map([
  ["catJAM", { url: "https://cdn.7tv.app/emote/A/2x.webp", zeroWidth: false }],
  ["PETPET", { url: "https://cdn.7tv.app/emote/B/2x.webp", zeroWidth: true }],
]);
const emote = (name, url, overlays = []) => ({ type: "emote", name, url, overlays });

test("twitchEmoteUrl uses the v2 CDN", () => {
  assert.equal(KAPPA, "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0");
});

test("parseTwitchEmotes reads ids and ranges sorted by start", () => {
  assert.deepEqual(parseTwitchEmotes("25:12-16,0-4/1902:6-10"), [
    { id: "25", start: 0, end: 4 },
    { id: "1902", start: 6, end: 10 },
    { id: "25", start: 12, end: 16 },
  ]);
  assert.deepEqual(parseTwitchEmotes(""), []);
});

test("plain text is one text token", () => {
  assert.deepEqual(tokenize("hello there", "", map), [{ type: "text", text: "hello there" }]);
});

test("Twitch emote ranges become emote tokens", () => {
  assert.deepEqual(tokenize("Kappa hello Kappa", "25:0-4,12-16", map), [
    emote("Kappa", KAPPA),
    { type: "text", text: " hello " },
    emote("Kappa", KAPPA),
  ]);
});

test("emoji before an emote do not shift positions", () => {
  assert.deepEqual(tokenize("😀 Kappa", "25:2-6", map), [
    { type: "text", text: "😀 " },
    emote("Kappa", KAPPA),
  ]);
});

test("third-party emotes match whole words", () => {
  assert.deepEqual(tokenize("hi catJAM catJAMs", "", map), [
    { type: "text", text: "hi " },
    emote("catJAM", "https://cdn.7tv.app/emote/A/2x.webp"),
    { type: "text", text: " catJAMs" },
  ]);
});

test("zero-width emotes stack on the previous emote", () => {
  assert.deepEqual(tokenize("catJAM PETPET yay", "", map), [
    emote("catJAM", "https://cdn.7tv.app/emote/A/2x.webp", [
      { name: "PETPET", url: "https://cdn.7tv.app/emote/B/2x.webp" },
    ]),
    { type: "text", text: " yay" },
  ]);
});

test("zero-width emote with nothing to stack on renders normally", () => {
  assert.deepEqual(tokenize("PETPET hi", "", map), [
    emote("PETPET", "https://cdn.7tv.app/emote/B/2x.webp"),
    { type: "text", text: " hi" },
  ]);
});

test("out-of-range Twitch emote ranges are ignored", () => {
  assert.deepEqual(tokenize("hi", "25:0-10", map), [{ type: "text", text: "hi" }]);
});

test("isEmoteOnly ignores whitespace", () => {
  assert.equal(isEmoteOnly(tokenize("Kappa Kappa", "25:0-4,6-10", map)), true);
  assert.equal(isEmoteOnly(tokenize("Kappa hi", "25:0-4", map)), false);
  assert.equal(isEmoteOnly(tokenize("   ", "", map)), false);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/tokenize.test.js`
Expected: FAIL, cannot find `js/tokenize.js`.

- [ ] **Step 3: Implement `js/tokenize.js`**

```js
export function twitchEmoteUrl(id) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
}

export function parseTwitchEmotes(tag) {
  if (!tag) return [];
  const out = [];
  for (const group of tag.split("/")) {
    const [id, ranges] = group.split(":");
    if (!ranges) continue;
    for (const range of ranges.split(",")) {
      const [start, end] = range.split("-").map(Number);
      out.push({ id, start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function appendText(tokens, text) {
  const last = tokens[tokens.length - 1];
  if (last?.type === "text") last.text += text;
  else tokens.push({ type: "text", text });
}

function attachZeroWidth(tokens, name, url) {
  let i = tokens.length - 1;
  if (tokens[i]?.type === "text" && tokens[i].text.trim() === "") i--;
  const base = tokens[i];
  if (base?.type !== "emote") return false;
  tokens.length = i + 1;
  base.overlays.push({ name, url });
  return true;
}

function pushWords(tokens, segment, emoteMap) {
  for (const part of segment.split(/(\s+)/)) {
    if (part === "") continue;
    const found = emoteMap.get(part);
    if (!found) appendText(tokens, part);
    else if (!(found.zeroWidth && attachZeroWidth(tokens, part, found.url))) {
      tokens.push({ type: "emote", name: part, url: found.url, overlays: [] });
    }
  }
}

// Twitch emote ranges index Unicode code points, so slice an Array.from() copy, not the string.
export function tokenize(text, emotesTag, emoteMap) {
  const chars = Array.from(text);
  const tokens = [];
  let cursor = 0;
  for (const e of parseTwitchEmotes(emotesTag)) {
    if (e.start < cursor || e.end >= chars.length) continue;
    pushWords(tokens, chars.slice(cursor, e.start).join(""), emoteMap);
    tokens.push({ type: "emote", name: chars.slice(e.start, e.end + 1).join(""), url: twitchEmoteUrl(e.id), overlays: [] });
    cursor = e.end + 1;
  }
  pushWords(tokens, chars.slice(cursor).join(""), emoteMap);
  return tokens;
}

export function isEmoteOnly(tokens) {
  return tokens.some(t => t.type === "emote") && tokens.every(t => t.type === "emote" || t.text.trim() === "");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test tests/tokenize.test.js`
Expected: 10 passing.

- [ ] **Step 5: Commit**

```bash
git add js/tokenize.js tests/tokenize.test.js
git commit -m "Tokenize chat text into text and emote runs

Twitch emote ranges count code points, so emoji earlier in a message would otherwise misplace emotes."
```

---

### Task 5: Third-party emote loading

**Files:**
- Create: `js/emotes.js`
- Test: `tests/emotes.test.js`

**Interfaces:**
- Produces: `from7tv(set) -> [{ name, url, zeroWidth }]`, `fromBttv(list) -> [...]`, `fromFfz(data, onlySetIds?) -> [...]`, `mergeEmotes(...lists) -> Map<name, { url, zeroWidth }>` (first list wins), `loadEmotes(roomId, getJson = fetchJson) -> Promise<Map>` (never rejects).

API shapes (verified 2026-10-11):
- 7TV `GET https://7tv.io/v3/users/twitch/<id>` -> `{ emote_set: { emotes: [...] } }`; `GET https://7tv.io/v3/emote-sets/global` -> `{ emotes: [...] }`. Each emote: `{ name, flags, data: { host: { url: "//cdn.7tv.app/emote/<id>" } } }`; `flags & 1` is zero-width. `data` can be null for deleted emotes.
- BTTV `GET https://api.betterttv.net/3/cached/users/twitch/<id>` -> `{ channelEmotes: [...], sharedEmotes: [...] }` or 404; global -> array. Each `{ id, code }`. Image `https://cdn.betterttv.net/emote/<id>/2x`.
- FFZ `GET https://api.frankerfacez.com/v1/room/id/<id>` -> `{ sets: { "<setId>": { emoticons: [...] } } }` or 404; `GET https://api.frankerfacez.com/v1/set/global` -> `{ default_sets: [3, ...], sets: {...} }`. Each `{ name, urls: { "1": url, "2": url, "4": url } }`; urls may be protocol-relative.

- [ ] **Step 1: Write failing tests** in `tests/emotes.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { from7tv, fromBttv, fromFfz, mergeEmotes, loadEmotes } from "../js/emotes.js";

const seven = (name, id, flags = 0) => ({ name, flags, data: { host: { url: `//cdn.7tv.app/emote/${id}` } } });
const ffz = name => ({ name, urls: { "1": `https://cdn.frankerfacez.com/emote/${name}/1`, "2": `https://cdn.frankerfacez.com/emote/${name}/2` } });

test("from7tv maps names, 2x webp urls and zero-width flag", () => {
  const set = { emotes: [seven("catJAM", "A"), seven("PETPET", "B", 1), { name: "Gone", flags: 0, data: null }] };
  assert.deepEqual(from7tv(set), [
    { name: "catJAM", url: "https://cdn.7tv.app/emote/A/2x.webp", zeroWidth: false },
    { name: "PETPET", url: "https://cdn.7tv.app/emote/B/2x.webp", zeroWidth: true },
  ]);
  assert.deepEqual(from7tv(null), []);
});

test("fromBttv maps code and id", () => {
  assert.deepEqual(fromBttv([{ id: "X", code: "monkaS" }]), [
    { name: "monkaS", url: "https://cdn.betterttv.net/emote/X/2x", zeroWidth: false },
  ]);
  assert.deepEqual(fromBttv(undefined), []);
});

test("fromFfz reads selected sets and fixes protocol-relative urls", () => {
  const data = {
    sets: {
      "3": { emoticons: [ffz("ZrehplaR")] },
      "9": { emoticons: [{ name: "Old", urls: { "1": "//cdn.frankerfacez.com/emote/1/1" } }] },
    },
  };
  assert.deepEqual(fromFfz(data, ["3"]), [
    { name: "ZrehplaR", url: "https://cdn.frankerfacez.com/emote/ZrehplaR/2", zeroWidth: false },
  ]);
  assert.deepEqual(fromFfz(data).map(e => e.url), [
    "https://cdn.frankerfacez.com/emote/ZrehplaR/2",
    "https://cdn.frankerfacez.com/emote/1/1",
  ]);
  assert.deepEqual(fromFfz(null), []);
});

test("mergeEmotes keeps the first occurrence of a name", () => {
  const map = mergeEmotes(
    [{ name: "A", url: "first", zeroWidth: false }],
    [{ name: "A", url: "second", zeroWidth: true }, { name: "B", url: "b", zeroWidth: false }],
  );
  assert.deepEqual([...map.entries()], [
    ["A", { url: "first", zeroWidth: false }],
    ["B", { url: "b", zeroWidth: false }],
  ]);
});

test("loadEmotes merges providers in priority order and skips failures", async t => {
  t.mock.method(console, "warn", () => {});
  const responses = {
    "https://7tv.io/v3/users/twitch/42": { emote_set: { emotes: [seven("Shared", "CH")] } },
    "https://7tv.io/v3/emote-sets/global": { emotes: [seven("Global7", "GL")] },
    "https://api.betterttv.net/3/cached/users/twitch/42": {
      channelEmotes: [{ id: "B1", code: "Shared" }],
      sharedEmotes: [{ id: "B2", code: "SharedB" }],
    },
    "https://api.betterttv.net/3/cached/emotes/global": [{ id: "B3", code: "GlobalB" }],
    "https://api.frankerfacez.com/v1/set/global": {
      default_sets: [3],
      sets: { "3": { emoticons: [ffz("GlobalF")] }, "4": { emoticons: [ffz("NotDefault")] } },
    },
  };
  const getJson = async url => {
    if (url in responses) return responses[url];
    throw new Error(`404 ${url}`);
  };
  const map = await loadEmotes("42", getJson);
  assert.equal(map.get("Shared").url, "https://cdn.7tv.app/emote/CH/2x.webp");
  for (const name of ["Global7", "SharedB", "GlobalB", "GlobalF"]) assert.ok(map.has(name), name);
  assert.equal(map.has("NotDefault"), false);
});

test("loadEmotes resolves to an empty map when everything fails", async t => {
  t.mock.method(console, "warn", () => {});
  const map = await loadEmotes("42", async () => { throw new Error("offline"); });
  assert.equal(map.size, 0);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/emotes.test.js`
Expected: FAIL, cannot find `js/emotes.js`.

- [ ] **Step 3: Implement `js/emotes.js`** (no imports)

```js
const https = url => (url.startsWith("//") ? `https:${url}` : url);

export function from7tv(set) {
  return (set?.emotes ?? [])
    .filter(e => e.data?.host?.url)
    .map(e => ({ name: e.name, url: `${https(e.data.host.url)}/2x.webp`, zeroWidth: Boolean(e.flags & 1) }));
}

export function fromBttv(list) {
  return (list ?? []).map(e => ({ name: e.code, url: `https://cdn.betterttv.net/emote/${e.id}/2x`, zeroWidth: false }));
}

export function fromFfz(data, onlySetIds) {
  if (!data?.sets) return [];
  const ids = onlySetIds ?? Object.keys(data.sets);
  return ids
    .flatMap(id => data.sets[id]?.emoticons ?? [])
    .map(e => ({ name: e.name, url: https(e.urls["2"] ?? e.urls["1"]), zeroWidth: false }));
}

export function mergeEmotes(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const e of list) if (!map.has(e.name)) map.set(e.name, { url: e.url, zeroWidth: e.zeroWidth });
  }
  return map;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function loadEmotes(roomId, getJson = fetchJson) {
  const safe = (url, parse) =>
    getJson(url)
      .then(parse)
      .catch(err => {
        console.warn("[emotes] skipped:", err.message);
        return [];
      });

  const lists = await Promise.all([
    safe(`https://7tv.io/v3/users/twitch/${roomId}`, d => from7tv(d.emote_set)),
    safe("https://7tv.io/v3/emote-sets/global", from7tv),
    safe(`https://api.betterttv.net/3/cached/users/twitch/${roomId}`, d =>
      fromBttv([...(d.channelEmotes ?? []), ...(d.sharedEmotes ?? [])]),
    ),
    safe("https://api.betterttv.net/3/cached/emotes/global", fromBttv),
    safe(`https://api.frankerfacez.com/v1/room/id/${roomId}`, d => fromFfz(d)),
    safe("https://api.frankerfacez.com/v1/set/global", d => fromFfz(d, d.default_sets.map(String))),
  ]);
  return mergeEmotes(...lists);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `node --test tests/emotes.test.js`
Expected: 6 passing.

- [ ] **Step 5: Smoke-test against the live APIs** (network; informational)

Run:
```bash
cd /home/cagatay/developer/personal/chat-overlay && node -e '
import("./js/emotes.js").then(async m => { const map = await m.loadEmotes("659811388"); console.log(map.size, [...map.keys()].slice(0, 5)); })'
```
Expected: a size in the hundreds or more, first names from lennelen's 7TV set (e.g. `RAGEY`, `ratJAM`), and two `[emotes] skipped: 404 ...` warnings for BTTV/FFZ channel endpoints.

- [ ] **Step 6: Commit**

```bash
git add js/emotes.js tests/emotes.test.js
git commit -m "Load 7TV, BTTV and FFZ emotes into one lookup

Each provider fails independently so a 404 or outage never blocks chat."
```

---

### Task 6: Anonymous Twitch chat client

**Files:**
- Create: `js/twitch.js`
- Test: `tests/twitch.test.js`

**Interfaces:**
- Consumes: `parseLine`, `toEvent` from `js/irc.js`.
- Produces: `backoffDelay(attempt) -> ms`, `connectChat(channel, onEvent, { WebSocketImpl, setTimer }?) -> { close() }`. `onEvent` receives every event from `toEvent` except `ping` and `reconnect`, which the client handles itself.

- [ ] **Step 1: Write failing tests** in `tests/twitch.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectChat, backoffDelay } from "../js/twitch.js";

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeSocket.instances.push(this);
  }
  send(line) { this.sent.push(line); }
  close() { this.onclose?.(); }
  open() { this.onopen?.(); }
  receive(data) { this.onmessage?.({ data }); }
}

function setup(channel = "Lennelen") {
  FakeSocket.instances = [];
  const events = [];
  const timers = [];
  const conn = connectChat(channel, ev => events.push(ev), {
    WebSocketImpl: FakeSocket,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
  });
  return { conn, events, timers, latest: () => FakeSocket.instances.at(-1) };
}

const ROOMSTATE = "@room-id=659811388 :tmi.twitch.tv ROOMSTATE #lennelen";
const PRIVMSG = "@display-name=A;id=1;user-id=2 :a!a@a.tmi.twitch.tv PRIVMSG #lennelen :hi";

test("backoffDelay doubles from 1s and caps at 30s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 10].map(backoffDelay), [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
});

test("joins anonymously on open", () => {
  const { latest } = setup();
  const s = latest();
  assert.equal(s.url, "wss://irc-ws.chat.twitch.tv:443");
  s.open();
  assert.equal(s.sent[0], "CAP REQ :twitch.tv/tags twitch.tv/commands");
  assert.match(s.sent[1], /^NICK justinfan\d+$/);
  assert.equal(s.sent[2], "JOIN #lennelen");
});

test("answers PING without forwarding it", () => {
  const { latest, events } = setup();
  latest().receive("PING :tmi.twitch.tv\r\n");
  assert.deepEqual(latest().sent, ["PONG :tmi.twitch.tv"]);
  assert.deepEqual(events, []);
});

test("forwards every line of a frame", () => {
  const { latest, events } = setup();
  latest().receive(`${ROOMSTATE}\r\n${PRIVMSG}\r\n`);
  assert.deepEqual(events.map(e => e.type), ["roomstate", "message"]);
});

test("reconnects with backoff and resets after a join", () => {
  const { latest, timers } = setup();
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000]);
  timers[0].fn();
  assert.equal(FakeSocket.instances.length, 2);
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000, 2000]);
  timers[1].fn();
  latest().receive(ROOMSTATE);
  latest().close();
  assert.deepEqual(timers.map(t => t.ms), [1000, 2000, 1000]);
});

test("RECONNECT from Twitch triggers a reconnect", () => {
  const { latest, timers } = setup();
  latest().receive(":tmi.twitch.tv RECONNECT\r\n");
  assert.equal(timers.length, 1);
});

test("close() stops reconnecting", () => {
  const { conn, timers } = setup();
  conn.close();
  assert.equal(timers.length, 0);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/twitch.test.js`
Expected: FAIL, cannot find `js/twitch.js`.

- [ ] **Step 3: Implement `js/twitch.js`**

```js
import { parseLine, toEvent } from "./irc.js";

const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

export function backoffDelay(attempt) {
  return Math.min(1000 * 2 ** attempt, 30000);
}

export function connectChat(channel, onEvent, { WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout } = {}) {
  let attempt = 0;
  let stopped = false;
  let current = null;

  function open() {
    const ws = new WebSocketImpl(IRC_URL);
    current = ws;

    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${channel.toLowerCase()}`);
    };

    ws.onmessage = ({ data }) => {
      for (const line of String(data).split("\r\n")) {
        if (!line) continue;
        const event = toEvent(parseLine(line));
        if (!event) continue;
        if (event.type === "ping") ws.send(`PONG :${event.payload}`);
        else if (event.type === "reconnect") ws.close();
        else {
          if (event.type === "roomstate") attempt = 0;
          onEvent(event);
        }
      }
    };

    ws.onclose = () => {
      if (stopped || ws !== current) return;
      setTimer(open, backoffDelay(attempt++));
    };
  }

  open();
  return {
    close() {
      stopped = true;
      current.close();
    },
  };
}
```

- [ ] **Step 4: Run all tests, expect pass**

Run: `node --test`
Expected: every suite passes.

- [ ] **Step 5: Commit**

```bash
git add js/twitch.js tests/twitch.test.js
git commit -m "Connect to Twitch chat anonymously with reconnect backoff"
```

---

### Task 7: Overlay page (render, demo, theme, wiring)

**Files:**
- Create: `js/demo.js`, `js/render.js`, `js/main.js`, `index.html`, `style.css`
- Test: `tests/demo.test.js` (render/main are DOM; verified by screenshot)

**Interfaces:**
- Consumes: everything from Tasks 1 to 6. `moonPhase`, `moonPath` (Task 3); `tokenize`, `isEmoteOnly` (Task 4); `loadEmotes` (Task 5); `connectChat` (Task 6); `parseConfig`, `normalize`, `cssVars` (Task 1); `FONTS` (Task 1); `hexToRgba`, `mixWithWhite`, `isHex` (Task 1).
- Produces: `demoMessage(n, emoteNames) -> message event`, `startDemo(onMessage, getEmoteNames, intervalMs = 2200) -> { stop() }`; `createBubble(event, tokens, config) -> HTMLDivElement` with `.bubble` root, `data-msg-id`, `data-user-id`, children `.pill`, `.body`, `svg.sparkle`, `svg.crescent`. Overlay DOM: `#stars`, `#chat`, `svg#lines`. Overlay accepts `postMessage({ type: "config", values })` from same origin.

- [ ] **Step 1: Write failing demo tests** in `tests/demo.test.js`

```js
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
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/demo.test.js`
Expected: FAIL, cannot find `js/demo.js`.

- [ ] **Step 3: Implement `js/demo.js`**

```js
const USERS = [
  { name: "CometCass", color: "#8fc0ff", role: null },
  { name: "NyxNightly", color: "#ff8ad8", role: "vip" },
  { name: "MoonMoth", color: "#b78cff", role: "moderator" },
  { name: "Lennelen", color: "#f4c97a", role: "broadcaster" },
  { name: "SolsticeSam", color: "#7dd3c0", role: null },
  { name: "OrionByte", color: "#ffb36b", role: null },
];

const LINES = [
  "W streamer W night sky",
  "did anyone catch that shooting star",
  "lol I am moonstruck",
  "the stars are twinkling omg",
  "that riven combo was so clean",
  "gg",
  "how many hours of riven today?",
  "this overlay is so pretty",
];

export function demoMessage(n, emoteNames = []) {
  const user = USERS[n % USERS.length];
  const pick = k => emoteNames[(n * 7 + k) % emoteNames.length];
  let text = LINES[n % LINES.length];
  let emotes = "";
  if (n % 7 === 6 && emoteNames.length) text = [pick(0), pick(1), pick(2)].join(" ");
  else if (n % 3 === 2 && emoteNames.length) text = `${text} ${pick(0)}`;
  else if (n % 4 === 1) {
    text = `Kappa ${text}`;
    emotes = "25:0-4";
  }
  const login = user.name.toLowerCase();
  return {
    type: "message",
    id: `demo-${n}`,
    userId: `demo-${login}`,
    login,
    displayName: user.name,
    color: user.color,
    role: user.role,
    emotes,
    text,
    action: false,
  };
}

export function startDemo(onMessage, getEmoteNames, intervalMs = 2200) {
  let n = 0;
  const tick = () => onMessage(demoMessage(n++, getEmoteNames()));
  tick();
  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer) };
}
```

- [ ] **Step 4: Run demo tests, expect pass**

Run: `node --test tests/demo.test.js`
Expected: 3 passing.

- [ ] **Step 5: Implement `js/render.js`**

```js
import { moonPhase, moonPath } from "./moon.js";
import { isEmoteOnly } from "./tokenize.js";
import { isHex, hexToRgba, mixWithWhite } from "./color.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SPARKLE = "M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z";
const ROLE_MARKS = { broadcaster: "☀︎", moderator: "✦", vip: "◆" };

function svg(className, paths) {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("class", className);
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("aria-hidden", "true");
  for (const [d, cls] of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    if (cls) path.setAttribute("class", cls);
    el.append(path);
  }
  return el;
}

function emoteImg(name, url, className = "emote") {
  const img = document.createElement("img");
  img.className = className;
  img.alt = name;
  img.src = url;
  img.decoding = "async";
  img.addEventListener("error", () => img.replaceWith(document.createTextNode(name)), { once: true });
  return img;
}

function renderToken(token) {
  if (token.type === "text") return document.createTextNode(token.text);
  const base = emoteImg(token.name, token.url);
  if (!token.overlays.length) return base;
  const stack = document.createElement("span");
  stack.className = "emote-stack";
  stack.append(base, ...token.overlays.map(o => emoteImg(o.name, o.url, "emote overlay")));
  return stack;
}

function createPill(ev, config) {
  const pill = document.createElement("div");
  pill.className = "pill";
  const phase = config.moons ? moonPhase(ev.userId) : 1;
  pill.append(svg("moon", [[moonPath(4), "dark"], [moonPath(phase), "lit"]]));
  if (ev.role) {
    const mark = document.createElement("span");
    mark.className = `role role-${ev.role}`;
    mark.textContent = ROLE_MARKS[ev.role];
    pill.append(mark);
  }
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = ev.displayName;
  pill.append(name);
  if (config.namecolor && ev.color && isHex(ev.color)) {
    pill.style.setProperty("--pill-bg", hexToRgba(mixWithWhite(ev.color, 35), config.pillop));
  }
  return pill;
}

export function createBubble(ev, tokens, config) {
  const bubble = document.createElement("div");
  bubble.className = "bubble enter";
  bubble.dataset.msgId = ev.id;
  bubble.dataset.userId = ev.userId;
  if (isEmoteOnly(tokens)) bubble.classList.add("big-emotes");

  const body = document.createElement("div");
  body.className = ev.action ? "body action" : "body";
  body.append(...tokens.map(renderToken));

  bubble.append(
    createPill(ev, config),
    body,
    svg("orn sparkle", [[SPARKLE]]),
    svg("orn crescent", [[moonPath(7)]]),
  );
  return bubble;
}
```

- [ ] **Step 6: Create `style.css`**

```css
:root {
  --font-msg: "Urbanist";
  --font-name: "Marcellus";
  --size: 14px;
  --lh: 1.5;
  --text: #e9edff;
  --pill-bg: rgba(195, 178, 245, 0.4);
  --name-text: #fefefe;
  --glass-bg: rgba(18, 26, 56, 0.5);
  --blur: 12px;
  --border-a: rgba(169, 183, 232, 0.55);
  --border-b: rgba(183, 140, 255, 0.55);
  --glow: rgba(183, 140, 255, 0.33);
  --sheen: rgba(255, 255, 255, 0.12);
  --radius: 16px;
  --shadow: 25px;
  --gap: 20px;
  --padx: 16px;
  --pady: 10px;
  --ornament: #c9b6ff;
  --moon: #f4eddc;
  --star: #ffffff;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

body.preview {
  background: radial-gradient(ellipse at 30% 15%, #2a2463 0%, #141433 45%, #07071a 100%);
}

#stars {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

#chat {
  position: absolute;
  inset: 0;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: var(--gap);
  padding: 28px 30px 24px 22px;
}

#lines {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

/* Bubble */

.bubble {
  position: relative;
  flex-shrink: 0;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: calc(var(--size) * 0.9);
  padding: calc(var(--pady) + var(--size) * 0.55) var(--padx) var(--pady);
  border-radius: var(--radius);
  background-color: var(--glass-bg);
  background-image: linear-gradient(180deg, var(--sheen), transparent 45%);
  -webkit-backdrop-filter: blur(var(--blur));
  backdrop-filter: blur(var(--blur));
  box-shadow: 0 0 var(--shadow) var(--glow), inset 0 1px 0 var(--sheen);
  color: var(--text);
  font: 600 var(--size) / var(--lh) var(--font-msg), sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  overflow-wrap: anywhere;
}

/* Gradient border drawn as a masked ring so it follows border-radius. */
.bubble::before {
  content: "";
  position: absolute;
  inset: 0;
  padding: 1.5px;
  border-radius: inherit;
  background: linear-gradient(135deg, var(--border-a), var(--border-b));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.body.action {
  font-style: italic;
}

/* Name pill */

.pill {
  position: absolute;
  top: 0;
  left: calc(var(--padx) - 4px);
  transform: translateY(-55%);
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.25em 0.85em 0.25em 0.5em;
  border-radius: 999px;
  background: var(--pill-bg);
  border: 1px solid rgba(255, 255, 255, 0.22);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  color: var(--name-text);
  font: 400 calc(var(--size) * 0.92) / 1 var(--font-name), serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.35);
}

.pill .moon {
  width: 1.15em;
  height: 1.15em;
  flex-shrink: 0;
}

.moon .dark {
  fill: var(--moon);
  opacity: 0.22;
}

.moon .lit {
  fill: var(--moon);
  filter: drop-shadow(0 0 2px var(--moon));
}

.role {
  font-size: 0.85em;
  color: var(--moon);
}

/* Ornaments */

.orn {
  position: absolute;
  fill: var(--ornament);
  filter: drop-shadow(0 0 4px var(--ornament));
  pointer-events: none;
}

.sparkle {
  top: 0;
  right: 0;
  width: calc(var(--size) * 1.1);
  height: calc(var(--size) * 1.1);
  transform: translate(40%, -40%);
}

.crescent {
  bottom: 0;
  left: 0;
  width: calc(var(--size) * 0.8);
  height: calc(var(--size) * 0.8);
  transform: translate(-45%, 35%);
}

/* Emotes */

.emote {
  height: calc(var(--size) * 1.75);
  vertical-align: middle;
  margin: -0.3em 0;
}

.big-emotes .emote {
  height: calc(var(--size) * 3);
}

.emote-stack {
  position: relative;
  display: inline-block;
  vertical-align: middle;
}

.emote-stack .overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  transform: translate(-50%, -50%);
}

/* Motion */

.bubble.enter {
  animation: bubble-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.bubble.enter .sparkle {
  animation: sparkle-in 0.9s ease-out 0.15s both;
}

.bubble.leave {
  animation: bubble-out 0.5s ease-in forwards;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }
}

@keyframes sparkle-in {
  0% {
    transform: translate(40%, -40%) scale(0) rotate(-90deg);
  }
  60% {
    transform: translate(40%, -40%) scale(1.4) rotate(15deg);
  }
  100% {
    transform: translate(40%, -40%) scale(1) rotate(0deg);
  }
}

@keyframes bubble-out {
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Celestial Chat</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="style.css" />
    <script type="module" src="js/main.js"></script>
  </head>
  <body>
    <div id="stars"></div>
    <main id="chat"></main>
    <svg id="lines" aria-hidden="true"></svg>
  </body>
</html>
```

- [ ] **Step 8: Implement `js/main.js`**

```js
import { parseConfig, normalize, cssVars } from "./config.js";
import { FONTS } from "./schema.js";
import { connectChat } from "./twitch.js";
import { loadEmotes } from "./emotes.js";
import { tokenize } from "./tokenize.js";
import { createBubble } from "./render.js";
import { startDemo } from "./demo.js";

const chat = document.getElementById("chat");

const LEAVE_MS = 500; // matches .bubble.leave animation in style.css
const loadedFonts = new Set();

let config = null;
let emoteMap = new Map();
let roomId = null;
let connection = null;
let demo = null;

function loadFont(family) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${FONTS[family]}&display=swap`;
  document.head.append(link);
}

function applyConfig(next) {
  const prev = config;
  config = next;
  for (const [name, value] of Object.entries(cssVars(config))) {
    document.documentElement.style.setProperty(name, value);
  }
  loadFont(config.font);
  loadFont(config.namefont);
  document.body.classList.toggle("preview", config.bg);
  if (!prev || prev.channel !== config.channel) connect();
  if (!prev || prev.demo !== config.demo) toggleDemo();
}

// Demo mode stays connected so the preview can use the channel's real emotes.
function connect() {
  connection?.close();
  roomId = null;
  emoteMap = new Map();
  connection = connectChat(config.channel, onEvent);
}

function toggleDemo() {
  demo?.stop();
  demo = config.demo ? startDemo(showMessage, () => [...emoteMap.keys()].slice(0, 40)) : null;
}

function onEvent(ev) {
  switch (ev.type) {
    case "roomstate":
      if (ev.roomId && ev.roomId !== roomId) {
        const id = (roomId = ev.roomId);
        loadEmotes(id).then(map => {
          if (roomId === id) emoteMap = map;
        });
      }
      break;
    case "message":
      if (!config.demo) showMessage(ev);
      break;
    case "clearmsg":
      removeWhere(b => b.dataset.msgId === ev.targetId);
      break;
    case "clearuser":
      removeWhere(b => b.dataset.userId === ev.userId);
      break;
    case "clearall":
      removeWhere(() => true);
      break;
  }
}

function isHidden(ev) {
  const users = config.hide.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  return users.includes(ev.login) || (config.hidecmd && ev.text.startsWith("!"));
}

function liveBubbles() {
  return [...chat.children].filter(b => !b.dataset.leaving);
}

function showMessage(ev) {
  if (isHidden(ev)) return;
  const bubble = createBubble(ev, tokenize(ev.text, ev.emotes, emoteMap), config);
  chat.append(bubble);
  const live = liveBubbles();
  while (live.length > config.max) fadeOut(live.shift());
  if (config.fade > 0) bubble.fadeTimer = setTimeout(() => fadeOut(bubble), config.fade * 1000);
}

function fadeOut(bubble) {
  if (bubble.dataset.leaving) return;
  bubble.dataset.leaving = "1";
  clearTimeout(bubble.fadeTimer);
  bubble.classList.add("leave");
  setTimeout(() => bubble.remove(), LEAVE_MS);
}

function removeWhere(match) {
  for (const bubble of [...chat.children]) {
    if (!match(bubble)) continue;
    clearTimeout(bubble.fadeTimer);
    bubble.remove();
  }
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values));
});

applyConfig(parseConfig(location.search));
```

- [ ] **Step 9: Start a local server** (leave running for later tasks)

Run (background): `python3 -m http.server 8000 --directory /home/cagatay/developer/personal/chat-overlay`

- [ ] **Step 10: Screenshot demo mode and inspect it**

Run:
```bash
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=460,800 \
  --virtual-time-budget=12000 \
  --screenshot=/tmp/claude-1000/-home-cagatay-developer-personal/53c0d913-8ad9-40ca-b7ea-438be0ff8966/scratchpad/overlay-demo.png "http://localhost:8000/?demo=1&bg=1"
```
Then open `/tmp/claude-1000/-home-cagatay-developer-personal/53c0d913-8ad9-40ca-b7ea-438be0ff8966/scratchpad/overlay-demo.png` with the Read tool.
Expected: night-sky background; 4 to 6 frosted bubbles stacked at the bottom-left; each with an uppercase serif name pill containing a moon icon (different phases per user), role marks for NyxNightly/MoonMoth/Lennelen; Kappa rendered as an image in messages that start with it; 7TV emotes (e.g. from lennelen's set) in some messages if emotes loaded within the budget; sparkle top-right and crescent bottom-left on each bubble. If fonts or emotes are missing in the headless shot but the layout is right, note it and continue; Step 11 checks in a real browser.

- [ ] **Step 11: Check the live path in a desktop browser** (manual, by the user if no browser is available to the agent)

Open `http://localhost:8000/?channel=<a currently live, active channel>` and confirm real messages appear with Twitch and 7TV emotes, and that the browser console shows only `[emotes] skipped` warnings (no errors). Then open `http://localhost:8000/?demo=1&bg=1&fade=5&max=3` and confirm bubbles fade after about 5 s and never exceed 3.

- [ ] **Step 12: Run all tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add index.html style.css js/demo.js js/render.js js/main.js tests/demo.test.js
git commit -m "Render chat as celestial glass bubbles with demo mode

Demo mode keeps the chat connection so previews show the channel's real 7TV emotes."
```

---

### Task 8: Ambient effects

**Files:**
- Create: `js/effects.js`
- Modify: `js/main.js` (imports, element refs, `applyConfig`, `showMessage`, startup), `style.css` (append effect styles)

**Interfaces:**
- Consumes: overlay DOM (`#stars`, `svg#lines`, `.bubble`, `.pill`) and config keys `stars`, `starcount`, `shooting`, `sparkles`, `constellation` from Task 7.
- Produces: `renderStarfield(layer, config)`, `startShootingStars(layer, getConfig) -> { stop() }`, `sparklePop(bubble)`, `drawConstellation(svgLayer, fromBubble, toBubble)`.

- [ ] **Step 1: Implement `js/effects.js`**

```js
const SVG_NS = "http://www.w3.org/2000/svg";

export function renderStarfield(layer, config) {
  layer.replaceChildren();
  if (!config.stars) return;
  for (let i = 0; i < config.starcount; i++) {
    const star = document.createElement("span");
    star.className = "star";
    const size = (1 + Math.random() * 2).toFixed(1);
    star.style.cssText =
      `left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;` +
      `width:${size}px;height:${size}px;` +
      `animation-duration:${(2 + Math.random() * 4).toFixed(2)}s;animation-delay:-${(Math.random() * 6).toFixed(2)}s`;
    layer.append(star);
  }
}

function shoot(layer) {
  const star = document.createElement("span");
  star.className = "shooting";
  star.style.left = `${20 + Math.random() * 70}%`;
  star.style.top = `${Math.random() * 40}%`;
  layer.append(star);
  setTimeout(() => star.remove(), 1400);
}

export function startShootingStars(layer, getConfig) {
  let timer;
  const schedule = () => {
    timer = setTimeout(() => {
      const config = getConfig();
      if (config.stars && config.shooting) shoot(layer);
      schedule();
    }, 8000 + Math.random() * 12000);
  };
  schedule();
  return { stop: () => clearTimeout(timer) };
}

export function sparklePop(bubble) {
  for (let i = 0; i < 6; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 18;
    p.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(1)}px`);
    p.style.setProperty("--dy", `${(Math.sin(angle) * dist - 12).toFixed(1)}px`);
    p.style.animationDelay = `${Math.round(Math.random() * 120)}ms`;
    bubble.append(p);
    setTimeout(() => p.remove(), 1300);
  }
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function drawConstellation(svgLayer, fromBubble, toBubble) {
  const base = svgLayer.getBoundingClientRect();
  const point = bubble => {
    const r = bubble.querySelector(".pill").getBoundingClientRect();
    return { x: (r.left - base.left + 10).toFixed(1), y: (r.top - base.top + r.height / 2).toFixed(1) };
  };
  const a = point(fromBubble);
  const b = point(toBubble);
  const group = svgEl("g", { class: "constellation" });
  group.append(
    svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
    svgEl("circle", { cx: a.x, cy: a.y, r: 2 }),
    svgEl("circle", { cx: b.x, cy: b.y, r: 2 }),
  );
  svgLayer.append(group);
  setTimeout(() => group.remove(), 2600);
}
```

- [ ] **Step 2: Append effect styles to `style.css`**

```css
/* Effects */

.star {
  position: absolute;
  border-radius: 50%;
  background: var(--star);
  box-shadow: 0 0 4px var(--star);
  animation: star-twinkle ease-in-out infinite alternate;
}

@keyframes star-twinkle {
  from {
    opacity: 0.15;
  }
  to {
    opacity: 0.9;
  }
}

.shooting {
  position: absolute;
  width: 120px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--star), transparent);
  filter: drop-shadow(0 0 4px var(--star));
  animation: shooting-star 1.2s ease-out forwards;
}

@keyframes shooting-star {
  from {
    opacity: 0;
    transform: rotate(-25deg) translateX(0);
  }
  15% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: rotate(-25deg) translateX(-260px);
  }
}

.particle {
  position: absolute;
  top: 0;
  right: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ornament);
  box-shadow: 0 0 6px var(--ornament);
  pointer-events: none;
  animation: particle-drift 1.1s ease-out both;
}

@keyframes particle-drift {
  from {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(var(--dx), var(--dy)) scale(0.3);
  }
}

.constellation {
  stroke: var(--ornament);
  stroke-width: 1.5;
  stroke-dasharray: 1 6;
  stroke-linecap: round;
  fill: var(--ornament);
  animation: constellation-link 2.6s ease forwards;
}

.constellation circle {
  stroke: none;
}

@keyframes constellation-link {
  0% {
    opacity: 0;
  }
  15%,
  70% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}
```

- [ ] **Step 3: Wire effects into `js/main.js`**

Add to the imports:
```js
import { renderStarfield, startShootingStars, sparklePop, drawConstellation } from "./effects.js";
```

Replace
```js
const chat = document.getElementById("chat");
```
with
```js
const chat = document.getElementById("chat");
const stars = document.getElementById("stars");
const lines = document.getElementById("lines");
```

In `applyConfig`, after `document.body.classList.toggle("preview", config.bg);` add:
```js
  if (!prev || prev.stars !== config.stars || prev.starcount !== config.starcount) renderStarfield(stars, config);
```

Replace the body of `showMessage` with:
```js
function showMessage(ev) {
  if (isHidden(ev)) return;
  const previous = liveBubbles().at(-1);
  const bubble = createBubble(ev, tokenize(ev.text, ev.emotes, emoteMap), config);
  chat.append(bubble);
  if (config.sparkles) sparklePop(bubble);
  if (config.constellation && previous) requestAnimationFrame(() => drawConstellation(lines, previous, bubble));
  const live = liveBubbles();
  while (live.length > config.max) fadeOut(live.shift());
  if (config.fade > 0) bubble.fadeTimer = setTimeout(() => fadeOut(bubble), config.fade * 1000);
}
```

Replace the last line `applyConfig(parseConfig(location.search));` with:
```js
applyConfig(parseConfig(location.search));
startShootingStars(stars, () => config);
```

- [ ] **Step 4: Screenshot and inspect**

Run:
```bash
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=460,800 \
  --virtual-time-budget=12000 \
  --screenshot=/tmp/claude-1000/-home-cagatay-developer-personal/53c0d913-8ad9-40ca-b7ea-438be0ff8966/scratchpad/overlay-effects.png "http://localhost:8000/?demo=1&bg=1"
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=460,800 \
  --virtual-time-budget=12000 \
  --screenshot=/tmp/claude-1000/-home-cagatay-developer-personal/53c0d913-8ad9-40ca-b7ea-438be0ff8966/scratchpad/overlay-noeffects.png "http://localhost:8000/?demo=1&bg=1&stars=0&sparkles=0&constellation=0"
```
Read both PNGs. Expected: the first shows small twinkling stars across the background (and possibly a dotted line or particles, depending on capture timing); the second shows no stars, no particles, no dotted lines. Bubbles are otherwise identical.

- [ ] **Step 5: Run all tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add js/effects.js js/main.js style.css
git commit -m "Add starfield, shooting stars, sparkle pops and constellation lines"
```

---

### Task 9: Settings page with live preview

**Files:**
- Create: `settings.html`, `js/settings.js`

**Interfaces:**
- Consumes: `SCHEMA` (Task 1), `parseConfig`, `serializeConfig` (Task 1), overlay `postMessage({ type: "config", values })` contract (Task 7).
- Produces: `settings.html` page; the OBS URL format `<base>/?<serializeConfig(values with demo=false, bg=false)>`.

- [ ] **Step 1: Create `settings.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Celestial Chat Settings</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0b1d;
        --panel: #15152e;
        --line: #2b2b52;
        --text: #e9edff;
        --muted: #9a9cc4;
        --accent: #b78cff;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.4 system-ui, sans-serif;
      }
      header {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
      }
      h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .url {
        display: flex;
        gap: 8px;
        flex: 1 1 420px;
        max-width: 720px;
      }
      .url input {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        color: var(--muted);
        font: 12px ui-monospace, monospace;
      }
      button {
        padding: 8px 14px;
        border: 0;
        border-radius: 8px;
        background: var(--accent);
        color: #140c26;
        font-weight: 600;
        cursor: pointer;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(280px, 380px) 1fr;
        gap: 20px;
        padding: 20px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-height: calc(100vh - 110px);
        overflow-y: auto;
        padding-right: 6px;
      }
      fieldset {
        margin: 0;
        padding: 10px 14px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
      }
      legend {
        padding: 0 6px;
        color: var(--accent);
        font-weight: 600;
      }
      .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        color: var(--muted);
      }
      .field input[type="text"],
      .field input[type="number"],
      .field select {
        width: 150px;
        padding: 5px 8px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
      }
      .field input[type="color"] {
        width: 44px;
        height: 28px;
        padding: 0;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: none;
      }
      .stage {
        position: sticky;
        top: 20px;
        align-self: start;
        width: 440px;
        height: 760px;
        max-width: 100%;
        resize: both;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }
      @media (max-width: 820px) {
        .layout {
          grid-template-columns: 1fr;
        }
        form {
          max-height: none;
        }
        .stage {
          position: static;
          width: 100%;
          height: 600px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Celestial Chat settings</h1>
      <div class="url">
        <input id="obs-url" readonly aria-label="OBS browser source URL" />
        <button id="copy" type="button">Copy OBS URL</button>
      </div>
    </header>
    <div class="layout">
      <form id="form" onsubmit="return false"></form>
      <div class="stage"><iframe id="preview" title="Overlay preview"></iframe></div>
    </div>
    <script type="module" src="js/settings.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Implement `js/settings.js`**

```js
import { SCHEMA } from "./schema.js";
import { parseConfig, serializeConfig } from "./config.js";

const form = document.getElementById("form");
const preview = document.getElementById("preview");
const output = document.getElementById("obs-url");
const copyButton = document.getElementById("copy");

const values = parseConfig(location.search);
const PREVIEW = { demo: true, bg: true };
const LIVE = { demo: false, bg: false };

function obsUrl() {
  const query = serializeConfig({ ...values, ...LIVE });
  const base = new URL("./", location.href).href;
  return query ? `${base}?${query}` : base;
}

function createInput(field) {
  const value = values[field.key];
  if (field.type === "select") {
    const select = document.createElement("select");
    for (const option of field.options) select.append(new Option(option, option, false, option === value));
    return select;
  }
  const input = document.createElement("input");
  if (field.type === "bool") {
    input.type = "checkbox";
    input.checked = value;
  } else if (field.type === "number") {
    input.type = "number";
    input.min = field.min;
    input.max = field.max;
    input.step = field.step ?? 1;
    input.value = value;
  } else {
    input.type = field.type === "color" ? "color" : "text";
    input.value = value;
  }
  return input;
}

function readInput(field, input) {
  if (field.type === "bool") return input.checked;
  if (field.type === "number") {
    const n = input.valueAsNumber;
    return Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.default;
  }
  return input.value;
}

function update() {
  output.value = obsUrl();
  const query = serializeConfig({ ...values, ...LIVE });
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
  preview.contentWindow?.postMessage({ type: "config", values: { ...values, ...PREVIEW } }, location.origin);
}

function buildForm() {
  let fieldset = null;
  for (const field of SCHEMA) {
    if (field.group === "Demo") continue;
    if (fieldset?.dataset.group !== field.group) {
      fieldset = document.createElement("fieldset");
      fieldset.dataset.group = field.group;
      const legend = document.createElement("legend");
      legend.textContent = field.group;
      fieldset.append(legend);
      form.append(fieldset);
    }
    const label = document.createElement("label");
    label.className = "field";
    const text = document.createElement("span");
    text.textContent = field.label;
    const input = createInput(field);
    input.addEventListener(field.type === "text" ? "change" : "input", () => {
      values[field.key] = readInput(field, input);
      update();
    });
    label.append(text, input);
    fieldset.append(label);
  }
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(obsUrl());
    copyButton.textContent = "Copied!";
  } catch {
    output.select();
    copyButton.textContent = "Press Ctrl+C";
  }
  setTimeout(() => (copyButton.textContent = "Copy OBS URL"), 1500);
});

buildForm();
preview.src = `index.html?${serializeConfig({ ...values, ...PREVIEW })}`;
output.value = obsUrl();
```

- [ ] **Step 3: Screenshot the settings page**

Run:
```bash
chromium --headless=new --disable-gpu --hide-scrollbars --window-size=1100,900 \
  --virtual-time-budget=10000 \
  --screenshot=/tmp/claude-1000/-home-cagatay-developer-personal/53c0d913-8ad9-40ca-b7ea-438be0ff8966/scratchpad/settings.png "http://localhost:8000/settings.html?fade=12&pill=ffdf8e"
```
Read the PNG. Expected: header with the OBS URL field showing `http://localhost:8000/?fade=12&pill=ffdf8e` and a Copy button; left column of grouped fieldsets (Behavior, Text, Pill, Glass, Shape, Ornaments, Effects; no Demo group) with Fade = 12 and the pill color swatch gold; right column preview with demo bubbles whose name pills are gold-tinted.

- [ ] **Step 4: Check live updates in a desktop browser** (manual, by the user if the agent has no interactive browser)

Open `http://localhost:8000/settings.html`, change Glass tint, Text size and turn off Ambient starfield. Expected: the preview updates instantly without reloading (existing bubbles restyle in place), and the URL field and the address bar query update. Click "Copy OBS URL" and paste somewhere: it must not contain `demo` or `bg`.

- [ ] **Step 5: Commit**

```bash
git add settings.html js/settings.js
git commit -m "Add settings page with live preview and OBS URL copy

Tweaking ~35 options by hand-editing a URL is error-prone; the form is generated from the same schema the overlay parses."
```

---

### Task 10: README and GitHub Pages deploy

**Files:**
- Create: `README.md`, `.nojekyll`

**Interfaces:**
- Consumes: final URLs `https://cydiann.github.io/chat-overlay/` and `https://cydiann.github.io/chat-overlay/settings.html`.

- [ ] **Step 1: Create `.nojekyll`** (empty file; serves files as-is without a Jekyll build)

Run: `touch /home/cagatay/developer/personal/chat-overlay/.nojekyll`

- [ ] **Step 2: Create `README.md`**

````markdown
# Celestial Chat Overlay

Twitch chat as celestial frosted-glass bubbles, for an OBS browser source. Shows Twitch, 7TV, BTTV and FFZ emotes. No login, no server: it reads chat anonymously.

- Overlay: https://cydiann.github.io/chat-overlay/
- Settings with live preview: https://cydiann.github.io/chat-overlay/settings.html

## OBS setup

1. Open the settings page, tweak the look, click **Copy OBS URL**.
2. In OBS: Sources > + > Browser. Paste the URL. Width 440, Height 760 (or whatever fits your layout).
3. Leave "Shutdown source when not visible" off so chat keeps flowing.
4. To change settings later, open `settings.html?<the query part of your OBS URL>`, adjust, copy again.

New 7TV emotes added mid-stream show up after you refresh the browser source.

## Development

```bash
python3 -m http.server 8000   # ES modules don't load from file://
node --test                   # unit tests, no dependencies
```

- Overlay: http://localhost:8000/?demo=1&bg=1
- Settings: http://localhost:8000/settings.html

Every setting is defined once in `js/schema.js`; the overlay's URL parsing and the settings form are both generated from it.
````

- [ ] **Step 3: Run all tests one last time**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add README.md .nojekyll
git commit -m "Document OBS setup and local development"
```

- [ ] **Step 5: STOP and ask the user before publishing.** Creating a public GitHub repo and enabling Pages makes the code public. Proceed only after an explicit yes.

- [ ] **Step 6: Create the repo, push, enable Pages**

```bash
cd /home/cagatay/developer/personal/chat-overlay
gh repo create cydiann/chat-overlay --public --source . --push
gh api -X POST repos/cydiann/chat-overlay/pages -f "source[branch]=main" -f "source[path]=/"
```

- [ ] **Step 7: Verify the deployment**

Pages takes about a minute. Poll:
```bash
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" https://cydiann.github.io/chat-overlay/)
  echo "$code"; [ "$code" = 200 ] && break; sleep 15
done
curl -s -o /dev/null -w "%{http_code}\n" https://cydiann.github.io/chat-overlay/settings.html
curl -s -o /dev/null -w "%{http_code}\n" https://cydiann.github.io/chat-overlay/js/main.js
```
Expected: `200` for all three. Then screenshot `https://cydiann.github.io/chat-overlay/?demo=1&bg=1` as in Task 7 Step 10 and confirm it matches the local render.
