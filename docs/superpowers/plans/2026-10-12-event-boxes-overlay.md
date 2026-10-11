# Event Boxes Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second OBS browser source (`events.html`) showing the latest follower, new subscriber, sub gifter and resubscriber in four neon-titled boxes, with usernames always centered, plus its own settings page with Twitch login.

**Architecture:** Follows come from Twitch EventSub over WebSocket using a channel moderator's implicit-grant token kept in the URL fragment. Subs, gifts and resubs come from anonymous Twitch IRC `USERNOTICE` lines through the existing `connectChat`. Pure logic (event mapping, EventSub client, auth helpers, name store, config) is unit tested with `node --test`; DOM code is thin and verified in a browser.

**Tech Stack:** Plain HTML, CSS, ES modules. No build step, no runtime dependencies. Tests use `node:test` and `node:assert/strict` (Node 24). Local server: `python3 -m http.server 8000`.

**Spec:** `docs/superpowers/specs/2026-10-12-event-boxes-overlay-design.md`

## Global Constraints

- No dependencies, no build step, no server. Everything is static files on GitHub Pages.
- The token never appears in a query string. It lives only in the URL fragment as `#token=<token>`.
- Both new pages include `<meta name="referrer" content="no-referrer" />`.
- `CLIENT_ID` is `7cc4880z454947qrnfi3z0w493ta4s`. The only OAuth scope is `moderator:read:followers`.
- The MoonTime font file is never committed. CSS asks for the system font: `"MoonTime", "Neonderthaw", cursive`.
- Usernames are always set with `textContent`, never HTML.
- The overlay never shows errors on screen; it logs to `console`.
- The chat overlay (`index.html`, `settings.html`) must behave exactly as before.
- Commit messages: short imperative subject plus a sentence or two of why, matching `git log`. No `feat:` prefixes. No mention of Claude or AI, no `Co-Authored-By` trailer.
- Code style: match the existing files (2-space indent, double quotes, semicolons, arrow functions, sparse comments that explain why).

## File Map

| File | Status | Responsibility |
|---|---|---|
| `js/config.js` | modify | `defaults`/`normalize`/`parseConfig`/`serializeConfig` take an optional schema (defaults to the chat `SCHEMA`) |
| `js/schema.js` | modify | export `CHANNEL_FIELD` so the events schema reuses it |
| `js/fonts.js` | create | `loadFont(family)` extracted from `main.js` |
| `js/main.js` | modify | import `loadFont` from `fonts.js` |
| `js/events-schema.js` | create | `EVENTS_SCHEMA`, `titleFor`, `eventsCssVars` |
| `js/settings-form.js` | create | `mountSettings(...)`, the schema-driven form extracted from `settings.js` |
| `js/settings.js` | modify | thin call to `mountSettings` with the chat schema |
| `settings.css` | create | the `<style>` block moved out of `settings.html`, shared by both settings pages |
| `settings.html` | modify | link `settings.css` instead of the inline style |
| `js/irc.js` | modify | `USERNOTICE` case in `toEvent` |
| `js/event-map.js` | create | `BOXES`, `mapFollow`, `mapUsernotice` |
| `js/name-store.js` | create | `createNameStore(channel, storage)` |
| `js/helix.js` | create | `API_BASE`, `getUserId`, `getFollowers` |
| `js/auth.js` | create | `CLIENT_ID`, `SCOPES`, `authorizeUrl`, `readHash`, `tokenFromHash`, `tokenHash`, `validateToken`, `missingScopes` |
| `js/eventsub.js` | create | `EVENTSUB_URL`, `followSubscription`, `connectEventSub` |
| `js/boxes.js` | create | `scrollDistance`, `createBox`, `setTitle`, `setName`, `fitName` |
| `js/events-demo.js` | create | `demoUpdate`, `startEventsDemo` |
| `js/events-main.js` | create | overlay startup and wiring |
| `events.html`, `events.css` | create | overlay page and styles |
| `events-settings.html`, `js/events-settings.js` | create | settings page with login and status |
| `README.md` | modify | setup and dev docs |
| `tests/*.test.js` | create/modify | one test file per pure module |

Deviation from the spec, on purpose: `config.js` functions take the schema as an optional last parameter defaulting to the chat `SCHEMA`, so the chat overlay's call sites and existing tests stay untouched. Twitch API calls other than validate live in `js/helix.js` rather than `js/auth.js`, since they are not auth.

---

### Task 1: Schema-agnostic config and shared font loader

**Files:**
- Modify: `js/config.js`
- Modify: `js/schema.js:16-20`
- Create: `js/fonts.js`
- Modify: `js/main.js` (imports and the `loadFont` block near the top)
- Test: `tests/config.test.js`

**Interfaces:**
- Produces: `defaults(schema = SCHEMA)`, `normalize(input, schema = SCHEMA)`, `parseConfig(search, schema = SCHEMA)`, `serializeConfig(values, schema = SCHEMA)`; `CHANNEL_FIELD` (schema field object) from `js/schema.js`; `loadFont(family: string): void` from `js/fonts.js`.

- [ ] **Step 1: Write the failing test**

Append to `tests/config.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/config.test.js`
Expected: FAIL in "config functions accept another schema" (defaults returns the chat defaults).

- [ ] **Step 3: Implement**

In `js/config.js`, change the four functions to take the schema:

```js
export function defaults(schema = SCHEMA) {
  return Object.fromEntries(schema.map(field => [field.key, field.default]));
}
```

```js
export function normalize(input, schema = SCHEMA) {
  const values = defaults(schema);
  for (const field of schema) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null) values[field.key] = coerce(field, raw);
  }
  return values;
}

export function parseConfig(search, schema = SCHEMA) {
  return normalize(Object.fromEntries(new URLSearchParams(search)), schema);
}

export function serializeConfig(values, schema = SCHEMA) {
  const params = new URLSearchParams();
  for (const field of schema) {
    const v = values[field.key];
    if (v === undefined || v === field.default) continue;
    if (field.type === "bool") params.set(field.key, v ? "1" : "0");
    else if (field.type === "color") params.set(field.key, v.replace("#", ""));
    else params.set(field.key, String(v));
  }
  return params.toString();
}
```

In `js/schema.js`, replace the channel entry inside `SCHEMA` with a shared export. Add above `export const SCHEMA`:

```js
export const CHANNEL_FIELD = { key: "channel", group: "Behavior", type: "text", default: "lennelen", clean: channelName, pattern: /^[a-z0-9_]{1,25}$/, label: "Twitch channel" };
```

and make the first `SCHEMA` entry `CHANNEL_FIELD,`.

Create `js/fonts.js`:

```js
import { FONTS } from "./schema.js";

const loaded = new Set();

export function loadFont(family) {
  if (loaded.has(family) || !FONTS[family]) return;
  loaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${FONTS[family]}&display=swap`;
  document.head.append(link);
}
```

In `js/main.js`: delete the `const loadedFonts = new Set();` line and the whole `function loadFont(family) { ... }` block, change `import { FONTS } from "./schema.js";` to `import { loadFont } from "./fonts.js";`. The two `loadFont(config.font)` / `loadFont(config.namefont)` calls stay.

- [ ] **Step 4: Run all tests**

Run: `node --test`
Expected: all pass, including every pre-existing config test.

- [ ] **Step 5: Commit**

```bash
git add js/config.js js/schema.js js/fonts.js js/main.js tests/config.test.js
git commit -m "Let config and font loading serve more than one overlay

The events overlay needs its own settings schema and the same Google
Fonts loader."
```

---

### Task 2: Events settings schema

**Files:**
- Create: `js/events-schema.js`
- Test: `tests/events-schema.test.js`

**Interfaces:**
- Consumes: `CHANNEL_FIELD`, `FONTS` from `js/schema.js`; `hexToRgba(hex, pct)` from `js/color.js`; `defaults/parseConfig/serializeConfig(…, schema)` from Task 1.
- Produces: `EVENTS_SCHEMA` (array), `titleFor(values, box: "follower"|"subscriber"|"gifter"|"resub"): string`, `eventsCssVars(values): Record<string,string>`.

- [ ] **Step 1: Write the failing test**

Create `tests/events-schema.test.js`:

```js
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
  assert.equal(vars["--fill-a"], "#ab97b2");
  assert.equal(vars["--shadow"], "rgba(60, 40, 90, 0.16)");
});

test("schema keys are unique", () => {
  const keys = EVENTS_SCHEMA.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/events-schema.test.js`
Expected: FAIL with "Cannot find module ... events-schema.js".

- [ ] **Step 3: Implement**

Create `js/events-schema.js`:

```js
import { CHANNEL_FIELD, FONTS } from "./schema.js";
import { hexToRgba } from "./color.js";

// Order matters: settings form groups and serialized query order follow it.
export const EVENTS_SCHEMA = [
  CHANNEL_FIELD,

  { key: "tfollow", group: "Titles", type: "text", default: "New Follower", label: "Follower box title" },
  { key: "tsub", group: "Titles", type: "text", default: "New Subscriber", label: "Subscriber box title" },
  { key: "tgift", group: "Titles", type: "text", default: "Recent Gifter", label: "Gifter box title" },
  { key: "tresub", group: "Titles", type: "text", default: "Recent Resub", label: "Resub box title" },
  { key: "titlesize", group: "Titles", type: "number", default: 44, min: 16, max: 96, label: "Title size (px)" },
  { key: "titlecolor", group: "Titles", type: "color", default: "#eef3ff", label: "Title color" },
  { key: "glow", group: "Titles", type: "color", default: "#4f6dff", label: "Neon glow color" },

  { key: "namefont", group: "Names", type: "select", options: Object.keys(FONTS), default: "Quicksand", label: "Username font" },
  { key: "namesize", group: "Names", type: "number", default: 22, min: 10, max: 48, label: "Username size (px)" },
  { key: "namecolor", group: "Names", type: "color", default: "#ffffff", label: "Username color" },

  { key: "boxw", group: "Boxes", type: "number", default: 306, min: 120, max: 600, label: "Box width (px)" },
  { key: "boxh", group: "Boxes", type: "number", default: 60, min: 30, max: 200, label: "Box height (px)" },
  { key: "gap", group: "Boxes", type: "number", default: 66, min: 0, max: 300, label: "Space between boxes (px)" },
  { key: "filla", group: "Boxes", type: "color", default: "#ab97b2", label: "Fill color (left)" },
  { key: "fillb", group: "Boxes", type: "color", default: "#a293cc", label: "Fill color (right)" },
  { key: "bordera", group: "Boxes", type: "color", default: "#a9d3e3", label: "Border color (left)" },
  { key: "borderb", group: "Boxes", type: "color", default: "#efeaf6", label: "Border color (right)" },
  { key: "shadow", group: "Boxes", type: "number", default: 16, min: 0, max: 100, label: "Shadow strength (0-100)" },

  { key: "demo", group: "Demo", type: "bool", default: false, label: "Demo mode (turn off before going live)" },
  { key: "bg", group: "Demo", type: "bool", default: false, label: "Light preview background" },
];

const TITLE_KEYS = { follower: "tfollow", subscriber: "tsub", gifter: "tgift", resub: "tresub" };

export function titleFor(values, box) {
  return values[TITLE_KEYS[box]];
}

export function eventsCssVars(v) {
  return {
    "--title-size": `${v.titlesize}px`,
    "--title-color": v.titlecolor,
    "--glow": v.glow,
    "--name-font": `"${v.namefont}"`,
    "--name-size": `${v.namesize}px`,
    "--name-color": v.namecolor,
    "--box-w": `${v.boxw}px`,
    "--box-h": `${v.boxh}px`,
    "--gap": `${v.gap}px`,
    "--fill-a": v.filla,
    "--fill-b": v.fillb,
    "--border-a": v.bordera,
    "--border-b": v.borderb,
    "--shadow": hexToRgba("#3c285a", v.shadow),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add js/events-schema.js tests/events-schema.test.js
git commit -m "Add the events overlay settings schema"
```

---

### Task 3: Shared settings form and stylesheet

**Files:**
- Create: `js/settings-form.js`
- Modify: `js/settings.js` (replace whole file)
- Create: `settings.css`
- Modify: `settings.html` (inline `<style>` becomes a `<link>`)

**Interfaces:**
- Consumes: `parseConfig`, `serializeConfig` with schema (Task 1).
- Produces: `mountSettings({ schema, overlay, preview, fragment = () => "", onChange = () => {} }): { values, update }`. Expects elements `#form`, `#preview` (iframe), `#obs-url`, `#copy` in the page. `overlay` is the OBS URL path relative to the page (`"./"` or `"events.html"`), `preview` the iframe page (`"index.html"` or `"events.html"`). `fragment()` returns a string like `"#token=abc"` or `""`, appended to the OBS URL and the page's own address. `onChange(values)` is called after every edit. `update()` re-renders the URL and preview.

This task is a DOM refactor with no unit test; it is verified in the browser.

- [ ] **Step 1: Create `js/settings-form.js`**

```js
import { parseConfig, serializeConfig } from "./config.js";

const PREVIEW = { demo: true, bg: true };
const LIVE = { demo: false, bg: false };

function createInput(field, value) {
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

// `fragment()` returns a "#..." suffix that must never go into the query string (the events overlay's token).
export function mountSettings({ schema, overlay, preview: previewPage, fragment = () => "", onChange = () => {} }) {
  const form = document.getElementById("form");
  const preview = document.getElementById("preview");
  const output = document.getElementById("obs-url");
  const copyButton = document.getElementById("copy");
  const values = parseConfig(location.search, schema);

  function liveQuery() {
    return serializeConfig({ ...values, ...LIVE }, schema);
  }

  function obsUrl() {
    const query = liveQuery();
    const base = new URL(overlay, location.href).href;
    return (query ? `${base}?${query}` : base) + fragment();
  }

  function updatePreview() {
    preview.contentWindow?.postMessage({ type: "config", values: { ...values, ...PREVIEW } }, location.origin);
  }

  function update() {
    output.value = obsUrl();
    const query = liveQuery();
    history.replaceState(null, "", (query ? `?${query}` : location.pathname) + fragment());
    updatePreview();
    onChange(values);
  }

  let fieldset = null;
  for (const field of schema) {
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
    const input = createInput(field, values[field.key]);
    input.addEventListener(field.type === "text" ? "change" : "input", () => {
      values[field.key] = readInput(field, input);
      update();
    });
    label.append(text, input);
    fieldset.append(label);
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

  // Edits made while the preview was still loading would otherwise be lost.
  preview.addEventListener("load", updatePreview);
  preview.src = `${previewPage}?${serializeConfig({ ...values, ...PREVIEW }, schema)}`;
  output.value = obsUrl();
  return { values, update };
}
```

- [ ] **Step 2: Replace `js/settings.js`**

```js
import { SCHEMA } from "./schema.js";
import { mountSettings } from "./settings-form.js";

mountSettings({ schema: SCHEMA, overlay: "./", preview: "index.html" });
```

- [ ] **Step 3: Move the settings stylesheet out of `settings.html`**

Run (moves the contents of the single `<style>` block into `settings.css`, dedented, and links it):

```bash
python3 - <<'EOF'
import re, textwrap
html = open("settings.html").read()
m = re.search(r"\n(\s*)<style>\n(.*?)\n\s*</style>", html, re.S)
open("settings.css", "w").write(textwrap.dedent(m.group(2)).strip() + "\n")
html = html[:m.start()] + f'\n{m.group(1)}<link rel="stylesheet" href="settings.css" />' + html[m.end():]
open("settings.html", "w").write(html)
EOF
grep -n "settings.css\|<style" settings.html
```

Expected: one `<link rel="stylesheet" href="settings.css" />` line, no `<style`.

- [ ] **Step 4: Verify the chat settings page still works**

Run: `node --test` (all pass), then `python3 -m http.server 8000` in the background and open `http://localhost:8000/settings.html?fade=10` in Chromium.

Check: the form renders with the same groups as before and Fade shows 10; changing a color updates the preview; the URL field shows `http://localhost:8000/?fade=10&…`; the address bar updates; Copy OBS URL works. To check without a GUI:

```bash
chromium --headless --disable-gpu --window-size=1280,900 --virtual-time-budget=4000 \
  --screenshot=/tmp/claude-1000/settings-check.png "http://localhost:8000/settings.html?fade=10"
```

and look at the screenshot: it must look the same as before the refactor (dark page, form left, preview right).

- [ ] **Step 5: Commit**

```bash
git add js/settings-form.js js/settings.js settings.css settings.html
git commit -m "Extract the settings form so a second overlay can reuse it"
```

---

### Task 4: USERNOTICE parsing and event mapping

**Files:**
- Modify: `js/irc.js` (`toEvent` switch)
- Create: `js/event-map.js`
- Test: `tests/irc.test.js` (append), `tests/event-map.test.js`

**Interfaces:**
- Produces: `toEvent` returns `{ type: "usernotice", msgId: string, login: string, displayName: string, communityGiftId: string }` for `USERNOTICE`. From `js/event-map.js`: `BOXES = ["follower", "subscriber", "gifter", "resub"]`, `ANON_LOGIN = "ananonymousgifter"`, `mapFollow(payload) -> { box, name } | null`, `mapUsernotice(event) -> { box, name } | null`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/irc.test.js`:

```js
const RESUB =
  "@badge-info=subscriber/6;badges=subscriber/6;color=#008000;display-name=Ronni;emotes=;id=db25007f;login=ronni;mod=0;" +
  "msg-id=resub;msg-param-cumulative-months=6;room-id=12345678;system-msg=ronni\\shas\\ssubscribed\\sfor\\s6\\smonths!;user-id=87654321 " +
  ":tmi.twitch.tv USERNOTICE #lennelen :Great stream -- keep it up!";
const BULK_SUBGIFT =
  "@display-name=TWW2;id=e9176cd8;login=tww2;msg-id=subgift;msg-param-community-gift-id=2939021;" +
  "msg-param-recipient-display-name=Mr_Woodchuck;msg-param-recipient-name=mr_woodchuck;room-id=1;user-id=2 " +
  ":tmi.twitch.tv USERNOTICE #lennelen";

test("toEvent builds a usernotice event", () => {
  assert.deepEqual(toEvent(parseLine(RESUB)), {
    type: "usernotice", msgId: "resub", login: "ronni", displayName: "Ronni", communityGiftId: "",
  });
});

test("usernotice keeps the community gift id and falls back to login", () => {
  const ev = toEvent(parseLine(BULK_SUBGIFT.replace("display-name=TWW2;", "display-name=;")));
  assert.equal(ev.displayName, "tww2");
  assert.equal(ev.communityGiftId, "2939021");
  assert.equal(ev.msgId, "subgift");
});
```

Create `tests/event-map.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/irc.test.js tests/event-map.test.js`
Expected: FAIL (`toEvent` returns null for USERNOTICE; `event-map.js` missing).

- [ ] **Step 3: Implement**

In `js/irc.js`, add this case to the `toEvent` switch, after `case "ROOMSTATE":`:

```js
    case "USERNOTICE": {
      const login = tags.login ?? "";
      return {
        type: "usernotice",
        msgId: tags["msg-id"] ?? "",
        login,
        displayName: tags["display-name"] || login,
        communityGiftId: tags["msg-param-community-gift-id"] ?? "",
      };
    }
```

Create `js/event-map.js`:

```js
export const BOXES = ["follower", "subscriber", "gifter", "resub"];
export const ANON_LOGIN = "ananonymousgifter";

export function mapFollow(payload) {
  const name = payload?.event?.user_name;
  return payload?.subscription?.type === "channel.follow" && name ? { box: "follower", name } : null;
}

function gifter(ev) {
  // A mystery gift sends one submysterygift and then a subgift per recipient tagged with the same
  // community gift id; only the submysterygift should credit the gifter.
  if (ev.communityGiftId) return null;
  return { box: "gifter", name: ev.login === ANON_LOGIN ? "Anonymous" : ev.displayName };
}

export function mapUsernotice(ev) {
  if (ev?.type !== "usernotice") return null;
  switch (ev.msgId) {
    case "sub":
      return { box: "subscriber", name: ev.displayName };
    case "resub":
      return { box: "resub", name: ev.displayName };
    case "submysterygift":
      return { box: "gifter", name: ev.login === ANON_LOGIN ? "Anonymous" : ev.displayName };
    case "subgift":
      return gifter(ev);
    case "anonsubgift":
    case "anonsubmysterygift":
      return ev.communityGiftId ? null : { box: "gifter", name: "Anonymous" };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all pass (the chat overlay's `onEvent` switch has no `usernotice` case, so it ignores the new event).

- [ ] **Step 5: Commit**

```bash
git add js/irc.js js/event-map.js tests/irc.test.js tests/event-map.test.js
git commit -m "Parse sub notices from chat and map them to event boxes

Subs, gifts and resubs arrive in anonymous IRC, so the events overlay
needs no broadcaster token for them."
```

---

### Task 5: Name store

**Files:**
- Create: `js/name-store.js`
- Test: `tests/name-store.test.js`

**Interfaces:**
- Produces: `createNameStore(channel: string, storage = localStorage or null): { load(box): string | null, save(box, name): void }`. Keys are `event-boxes:<channel>:<box>`.

- [ ] **Step 1: Write the failing test**

Create `tests/name-store.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNameStore } from "../js/name-store.js";

function fakeStorage() {
  const map = new Map();
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test("saves and loads names per box", () => {
  const storage = fakeStorage();
  const store = createNameStore("lennelen", storage);
  assert.equal(store.load("follower"), null);
  store.save("follower", "MoonlitMara");
  store.save("gifter", "Nova");
  assert.equal(store.load("follower"), "MoonlitMara");
  assert.equal(store.load("gifter"), "Nova");
  assert.equal(storage.map.get("event-boxes:lennelen:follower"), "MoonlitMara");
});

test("channels do not share names", () => {
  const storage = fakeStorage();
  createNameStore("lennelen", storage).save("resub", "A");
  assert.equal(createNameStore("other", storage).load("resub"), null);
});

test("throwing or missing storage is tolerated", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  const store = createNameStore("lennelen", broken);
  assert.equal(store.load("follower"), null);
  assert.doesNotThrow(() => store.save("follower", "x"));
  const none = createNameStore("lennelen", null);
  assert.equal(none.load("follower"), null);
  assert.doesNotThrow(() => none.save("follower", "x"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/name-store.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `js/name-store.js`:

```js
// Reading localStorage itself throws in some sandboxed contexts, not just its methods.
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createNameStore(channel, storage = defaultStorage()) {
  const key = box => `event-boxes:${channel}:${box}`;
  return {
    load(box) {
      try {
        return storage?.getItem(key(box)) ?? null;
      } catch {
        return null;
      }
    },
    save(box, name) {
      try {
        storage?.setItem(key(box), name);
      } catch {
        // Persistence is a nicety; the box still shows the name.
      }
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add js/name-store.js tests/name-store.test.js
git commit -m "Remember the last name in each event box across reloads"
```

---

### Task 6: Twitch auth and Helix helpers

**Files:**
- Create: `js/helix.js`, `js/auth.js`
- Test: `tests/helix.test.js`, `tests/auth.test.js`

**Interfaces:**
- Produces from `js/helix.js`: `API_BASE = "https://api.twitch.tv/helix"`; `getUserId(login, { token, clientId, fetchImpl }) -> Promise<string>` (throws if not found or non-2xx, error has `.status`); `getFollowers(broadcasterId, opts) -> Promise<{ total: number, name: string | null }>` (newest follower's display name).
- Produces from `js/auth.js`: `CLIENT_ID`, `SCOPES`, `authorizeUrl(redirectUri, state) -> string`, `readHash(hash) -> object`, `tokenFromHash(hash) -> string | null`, `tokenHash(token) -> string`, `validateToken(token, fetchImpl) -> Promise<{ login, userId, scopes, expiresIn } | null>` (null on 401, throws on other failures), `missingScopes(scopes) -> string[]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/helix.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserId, getFollowers } from "../js/helix.js";

function fakeFetch(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, opts: { token: "tok", clientId: "cid", fetchImpl } };
}

test("getUserId resolves a login with auth headers", async () => {
  const { calls, opts } = fakeFetch(200, { data: [{ id: "659811388", login: "lennelen" }] });
  assert.equal(await getUserId("lennelen", opts), "659811388");
  assert.equal(calls[0].url, "https://api.twitch.tv/helix/users?login=lennelen");
  assert.deepEqual(calls[0].init.headers, { "Client-Id": "cid", Authorization: "Bearer tok" });
});

test("getUserId throws for unknown users and HTTP errors", async () => {
  await assert.rejects(getUserId("nobody", fakeFetch(200, { data: [] }).opts));
  await assert.rejects(getUserId("lennelen", fakeFetch(401, {}).opts), err => err.status === 401);
});

test("getFollowers returns the total and newest follower", async () => {
  const { calls, opts } = fakeFetch(200, { total: 120, data: [{ user_name: "MoonlitMara" }] });
  assert.deepEqual(await getFollowers("659811388", opts), { total: 120, name: "MoonlitMara" });
  assert.equal(calls[0].url, "https://api.twitch.tv/helix/channels/followers?broadcaster_id=659811388&first=1");
});

test("getFollowers without moderator access reports no name", async () => {
  assert.deepEqual(await getFollowers("1", fakeFetch(200, { total: 120, data: [] }).opts), { total: 120, name: null });
});
```

Create `tests/auth.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_ID, SCOPES, authorizeUrl, readHash, tokenFromHash, tokenHash, validateToken, missingScopes,
} from "../js/auth.js";

test("client id and scope", () => {
  assert.equal(CLIENT_ID, "7cc4880z454947qrnfi3z0w493ta4s");
  assert.deepEqual(SCOPES, ["moderator:read:followers"]);
});

test("authorizeUrl asks for an implicit-grant token", () => {
  const url = new URL(authorizeUrl("https://cydiann.github.io/chat-overlay/events-settings.html", "xyz"));
  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "token");
  assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), "https://cydiann.github.io/chat-overlay/events-settings.html");
  assert.equal(url.searchParams.get("scope"), "moderator:read:followers");
  assert.equal(url.searchParams.get("state"), "xyz");
});

test("readHash parses the Twitch login callback", () => {
  assert.deepEqual(readHash("#access_token=abc123&scope=moderator%3Aread%3Afollowers&state=xyz&token_type=bearer"), {
    access_token: "abc123", scope: "moderator:read:followers", state: "xyz", token_type: "bearer",
  });
  assert.deepEqual(readHash(""), {});
});

test("tokenFromHash only accepts plain tokens", () => {
  assert.equal(tokenFromHash("#token=abc123"), "abc123");
  assert.equal(tokenFromHash(""), null);
  assert.equal(tokenFromHash("#other=1"), null);
  assert.equal(tokenFromHash("#token=bad%20token"), null);
});

test("tokenHash builds the fragment", () => {
  assert.equal(tokenHash("abc123"), "#token=abc123");
  assert.equal(tokenHash(null), "");
});

test("validateToken returns the token owner", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ login: "cydiann", user_id: "42", scopes: ["moderator:read:followers"], expires_in: 5184000 }) };
  };
  assert.deepEqual(await validateToken("tok", fetchImpl), {
    login: "cydiann", userId: "42", scopes: ["moderator:read:followers"], expiresIn: 5184000,
  });
  assert.equal(seen.url, "https://id.twitch.tv/oauth2/validate");
  assert.equal(seen.init.headers.Authorization, "OAuth tok");
});

test("validateToken returns null for a dead token and throws otherwise", async () => {
  assert.equal(await validateToken("tok", async () => ({ ok: false, status: 401 })), null);
  await assert.rejects(validateToken("tok", async () => ({ ok: false, status: 500 })));
});

test("missingScopes lists what the token lacks", () => {
  assert.deepEqual(missingScopes([]), ["moderator:read:followers"]);
  assert.deepEqual(missingScopes(["moderator:read:followers", "chat:read"]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/helix.test.js tests/auth.test.js`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement**

Create `js/helix.js`:

```js
export const API_BASE = "https://api.twitch.tv/helix";

async function get(path, { token, clientId, fetchImpl = (...args) => globalThis.fetch(...args) }) {
  const res = await fetchImpl(`${API_BASE}${path}`, { headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = new Error(`Twitch API ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function getUserId(login, opts) {
  const { data } = await get(`/users?login=${encodeURIComponent(login)}`, opts);
  if (!data?.length) throw new Error(`Twitch user ${login} not found`);
  return data[0].id;
}

// Without moderator access Twitch still answers 200 with the total but an empty list.
export async function getFollowers(broadcasterId, opts) {
  const { total = 0, data = [] } = await get(`/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=1`, opts);
  return { total, name: data[0]?.user_name ?? null };
}
```

Create `js/auth.js`:

```js
export const CLIENT_ID = "7cc4880z454947qrnfi3z0w493ta4s";
export const SCOPES = ["moderator:read:followers"];

export function authorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export function readHash(hash) {
  return Object.fromEntries(new URLSearchParams(hash.replace(/^#/, "")));
}

export function tokenFromHash(hash) {
  const token = readHash(hash).token;
  return token && /^[a-z0-9]+$/i.test(token) ? token : null;
}

// The token lives in the fragment because browsers never send fragments to the server.
export function tokenHash(token) {
  return token ? `#token=${token}` : "";
}

export async function validateToken(token, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const res = await fetchImpl("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Token validation failed: ${res.status}`);
  const body = await res.json();
  return { login: body.login, userId: body.user_id, scopes: body.scopes ?? [], expiresIn: body.expires_in };
}

export function missingScopes(scopes) {
  return SCOPES.filter(scope => !scopes.includes(scope));
}
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add js/helix.js js/auth.js tests/helix.test.js tests/auth.test.js
git commit -m "Add Twitch login and API helpers for the events overlay

The token is kept in the URL fragment so GitHub Pages never receives it."
```

---

### Task 7: EventSub client

**Files:**
- Create: `js/eventsub.js`
- Test: `tests/eventsub.test.js`

**Interfaces:**
- Consumes: `backoffDelay(attempt)` from `js/twitch.js`; `API_BASE` from `js/helix.js`.
- Produces: `EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws"`; `followSubscription(sessionId, broadcasterId, moderatorId) -> object`; `connectEventSub({ token, clientId, broadcasterId, moderatorId, onNotification, url, apiBase, log }, { WebSocketImpl, fetchImpl, setTimer, clearTimer }) -> { close() }`. `onNotification(payload)` gets the raw notification payload (`{ subscription, event }`). The subscription POST goes to `${apiBase}/eventsub/subscriptions`.

Behavior summary (from the spec): POST the follow subscription after the first welcome of a fresh connection; any message from the active socket re-arms a silence timer of `keepalive_timeout_seconds * 1000 + 5000`; silence or an unexpected close reconnects with `backoffDelay`; `session_reconnect` opens the new URL and swaps sockets on its welcome without re-posting; duplicate `message_id`s are dropped (last 500 kept); a 4xx subscription response other than 409/429 logs and stops for good; network errors, 429 and 5xx reconnect.

- [ ] **Step 1: Write the failing test**

Create `tests/eventsub.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectEventSub, followSubscription, EVENTSUB_URL } from "../js/eventsub.js";

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    FakeSocket.instances.push(this);
  }
  close() { this.closed = true; this.onclose?.(); }
  receive(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

const welcome = (id, keepalive = 10) => ({
  metadata: { message_type: "session_welcome" },
  payload: { session: { id, keepalive_timeout_seconds: keepalive } },
});
const keepaliveMsg = () => ({ metadata: { message_type: "session_keepalive" }, payload: {} });
const reconnectMsg = url => ({ metadata: { message_type: "session_reconnect" }, payload: { session: { reconnect_url: url } } });
const follow = (messageId, user = "MoonlitMara") => ({
  metadata: { message_id: messageId, message_type: "notification" },
  payload: { subscription: { type: "channel.follow" }, event: { user_name: user } },
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ status = 202, fetchError = null } = {}) {
  FakeSocket.instances = [];
  const posts = [];
  const notes = [];
  const logs = [];
  const timers = [];
  let nextId = 1;
  const conn = connectEventSub(
    {
      token: "tok", clientId: "cid", broadcasterId: "100", moderatorId: "200",
      onNotification: p => notes.push(p), apiBase: "https://api.test",
      log: { warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
    },
    {
      WebSocketImpl: FakeSocket,
      fetchImpl: async (url, init) => {
        posts.push({ url, init });
        if (fetchError) throw fetchError;
        return { ok: status >= 200 && status < 300, status };
      },
      setTimer: (fn, ms) => {
        const t = { id: nextId++, fn, ms, cleared: false, fired: false };
        timers.push(t);
        return t.id;
      },
      clearTimer: id => {
        const t = timers.find(x => x.id === id);
        if (t) t.cleared = true;
      },
    },
  );
  const live = () => timers.filter(t => !t.cleared && !t.fired);
  const fire = t => { t.fired = true; t.fn(); };
  return { conn, posts, notes, logs, live, fire, sockets: () => FakeSocket.instances, latest: () => FakeSocket.instances.at(-1) };
}

test("connects to the EventSub endpoint by default", () => {
  const { sockets } = setup();
  assert.equal(sockets()[0].url, EVENTSUB_URL);
  assert.equal(EVENTSUB_URL, "wss://eventsub.wss.twitch.tv/ws");
});

test("welcome subscribes to follows as the moderator", async () => {
  const { latest, posts } = setup();
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "https://api.test/eventsub/subscriptions");
  assert.equal(posts[0].init.method, "POST");
  assert.equal(posts[0].init.headers["Client-Id"], "cid");
  assert.equal(posts[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(posts[0].init.body), {
    type: "channel.follow",
    version: "2",
    condition: { broadcaster_user_id: "100", moderator_user_id: "200" },
    transport: { method: "websocket", session_id: "s1" },
  });
  assert.deepEqual(followSubscription("s1", "100", "200"), JSON.parse(posts[0].init.body));
});

test("forwards each notification once", async () => {
  const { latest, notes } = setup();
  latest().receive(welcome("s1"));
  latest().receive(follow("m1", "A"));
  latest().receive(follow("m1", "A"));
  latest().receive(follow("m2", "B"));
  assert.deepEqual(notes.map(n => n.event.user_name), ["A", "B"]);
});

test("silence past the keepalive window reconnects with backoff", () => {
  const { latest, live, fire, sockets } = setup();
  latest().receive(welcome("s1", 10));
  const silence = live().filter(t => t.ms === 15000);
  assert.equal(silence.length, 1);
  fire(silence[0]);
  assert.equal(sockets()[0].closed, true);
  assert.deepEqual(live().map(t => t.ms), [1000]);
  fire(live()[0]);
  assert.equal(sockets().length, 2);
});

test("keepalive messages re-arm the silence timer", () => {
  const { latest, live } = setup();
  latest().receive(welcome("s1", 10));
  latest().receive(keepaliveMsg());
  latest().receive(keepaliveMsg());
  assert.equal(live().filter(t => t.ms === 15000).length, 1);
});

test("session_reconnect swaps sockets after the new welcome without re-subscribing", async () => {
  const { latest, posts, notes, sockets } = setup();
  const old = latest();
  old.receive(welcome("s1"));
  await flush();
  old.receive(reconnectMsg("wss://reconnect.test/ws"));
  const next = latest();
  assert.equal(next.url, "wss://reconnect.test/ws");
  assert.equal(old.closed, false);
  next.receive(welcome("s1"));
  await flush();
  assert.equal(old.closed, true);
  assert.equal(posts.length, 1);
  next.receive(follow("m9", "C"));
  assert.deepEqual(notes.map(n => n.event.user_name), ["C"]);
  assert.equal(sockets().length, 2);
});

test("an unexpected close reconnects", () => {
  const { latest, live } = setup();
  latest().receive(welcome("s1"));
  latest().close();
  assert.deepEqual(live().map(t => t.ms), [1000]);
});

test("a refused subscription stops for good", async () => {
  const { latest, live, logs, sockets } = setup({ status: 403 });
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(latest().closed, true);
  assert.deepEqual(live(), []);
  assert.equal(logs.length, 1);
  assert.equal(sockets().length, 1);
});

test("a failed subscribe request reconnects to try again", async () => {
  const { latest, live } = setup({ fetchError: new Error("offline") });
  latest().receive(welcome("s1"));
  await flush();
  assert.equal(latest().closed, true);
  assert.deepEqual(live().map(t => t.ms), [1000]);
});

test("close stops everything", () => {
  const { conn, latest, live } = setup();
  latest().receive(welcome("s1"));
  conn.close();
  assert.equal(latest().closed, true);
  assert.deepEqual(live(), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/eventsub.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `js/eventsub.js`:

```js
import { backoffDelay } from "./twitch.js";
import { API_BASE } from "./helix.js";

export const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const DEFAULT_KEEPALIVE_S = 10;
const GRACE_MS = 5000;
const SEEN_MAX = 500;

export function followSubscription(sessionId, broadcasterId, moderatorId) {
  return {
    type: "channel.follow",
    version: "2",
    condition: { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorId },
    transport: { method: "websocket", session_id: sessionId },
  };
}

export function connectEventSub(
  { token, clientId, broadcasterId, moderatorId, onNotification, url = EVENTSUB_URL, apiBase = API_BASE, log = console },
  {
    WebSocketImpl = globalThis.WebSocket,
    fetchImpl = (...args) => globalThis.fetch(...args),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {},
) {
  let attempt = 0;
  let stopped = false;
  let current = null;
  // Socket opened from a session_reconnect, waiting for its welcome before replacing `current`.
  let pending = null;
  let reconnectTimer = null;
  let silenceTimer = null;
  let silenceMs = DEFAULT_KEEPALIVE_S * 1000 + GRACE_MS;
  const seen = new Set();

  function open(target, isReconnect = false) {
    const ws = new WebSocketImpl(target);
    ws.isReconnect = isReconnect;
    ws.onmessage = ({ data }) => handle(ws, data);
    ws.onclose = () => closed(ws);
    return ws;
  }

  function detach(ws) {
    ws.onmessage = ws.onclose = null;
    ws.close();
  }

  function connect() {
    reconnectTimer = null;
    if (stopped) return;
    current = open(url);
    armSilence();
  }

  function armSilence() {
    clearTimer(silenceTimer);
    silenceTimer = setTimer(drop, silenceMs);
  }

  function scheduleReconnect() {
    clearTimer(silenceTimer);
    if (stopped || reconnectTimer !== null) return;
    reconnectTimer = setTimer(connect, backoffDelay(attempt++));
  }

  // A half-open socket never fires onclose, so silence or a failed subscribe drops it ourselves.
  function drop() {
    if (current) detach(current);
    if (pending) detach(pending);
    current = pending = null;
    scheduleReconnect();
  }

  function closed(ws) {
    if (stopped) return;
    if (ws === pending) {
      pending = null;
      return;
    }
    if (ws !== current) return;
    if (pending) {
      current = pending;
      pending = null;
      armSilence();
      return;
    }
    current = null;
    scheduleReconnect();
  }

  function welcome(ws, session) {
    silenceMs = (session.keepalive_timeout_seconds ?? DEFAULT_KEEPALIVE_S) * 1000 + GRACE_MS;
    attempt = 0;
    if (ws === pending) {
      const old = current;
      current = ws;
      pending = null;
      if (old) detach(old);
    }
    armSilence();
    // Subscriptions carry over to a reconnect URL; posting again would duplicate them.
    if (!ws.isReconnect) subscribe(ws, session.id);
  }

  async function subscribe(ws, sessionId) {
    let res;
    try {
      res = await fetchImpl(`${apiBase}/eventsub/subscriptions`, {
        method: "POST",
        headers: { "Client-Id": clientId, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(followSubscription(sessionId, broadcasterId, moderatorId)),
      });
    } catch (err) {
      log.warn("EventSub follow subscription failed, retrying", err);
      if (ws === current) drop();
      return;
    }
    if (stopped || res.ok || res.status === 409) return;
    if (res.status === 429 || res.status >= 500) {
      log.warn(`EventSub follow subscription failed (${res.status}), retrying`);
      if (ws === current) drop();
      return;
    }
    log.error(`EventSub follow subscription refused (${res.status}); the follower box will not update`);
    close();
  }

  function notification(metadata, payload) {
    const id = metadata.message_id;
    if (seen.has(id)) return;
    seen.add(id);
    if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value);
    onNotification(payload);
  }

  function handle(ws, data) {
    if (ws !== current && ws !== pending) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (ws === current) armSilence();
    const { metadata = {}, payload = {} } = msg;
    switch (metadata.message_type) {
      case "session_welcome":
        welcome(ws, payload.session ?? {});
        break;
      case "session_reconnect":
        if (ws === current && !pending) pending = open(payload.session.reconnect_url, true);
        break;
      case "notification":
        notification(metadata, payload);
        break;
      case "revocation":
        log.warn(`EventSub ${payload.subscription?.type} revoked: ${payload.subscription?.status}`);
        break;
    }
  }

  function close() {
    stopped = true;
    clearTimer(reconnectTimer);
    clearTimer(silenceTimer);
    if (current) detach(current);
    if (pending) detach(pending);
    current = pending = null;
  }

  connect();
  return { close };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: all pass. If "a refused subscription stops for good" fails on `logs.length`, check that nothing else logs on that path.

- [ ] **Step 5: Commit**

```bash
git add js/eventsub.js tests/eventsub.test.js
git commit -m "Add an EventSub client for follow notifications

Handles keepalive silence, Twitch's reconnect handover and duplicate
deliveries, and stops for good when Twitch refuses the subscription."
```

---

### Task 8: Overlay page

**Files:**
- Create: `js/boxes.js`, `js/events-demo.js`, `js/events-main.js`, `events.html`, `events.css`
- Test: `tests/boxes.test.js`, `tests/events-demo.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1, 2, 4, 5, 6, 7; `connectChat(channel, onEvent)` from `js/twitch.js`; `loadFont` from `js/fonts.js`.
- Produces from `js/boxes.js`: `scrollDistance(textWidth, boxWidth) -> number` (whole px, ≥ 0), `createBox(key) -> HTMLElement`, `setTitle(slot, text)`, `setName(slot, name, animate = true)` (no-op when `name` equals what the slot shows), `fitName(slot)`.
- Produces from `js/events-demo.js`: `demoUpdate(n) -> { box, name }`, `startEventsDemo(onUpdate, intervalMs = 1500) -> { stop() }`.
- `events.html` reads `?eventsub=<ws url>&api=<base url>` (dev only) and `#token=<token>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/boxes.test.js`:

```js
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
```

Create `tests/events-demo.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/boxes.test.js tests/events-demo.test.js`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement the modules**

Create `js/boxes.js`:

```js
const SLIDE_OUT_MS = 400; // matches .slide.out in events.css
const SCROLL_BASE_MS = 2500;
const SCROLL_MS_PER_PX = 40;

export function scrollDistance(textWidth, boxWidth) {
  return Math.max(0, Math.ceil(textWidth - boxWidth));
}

export function createBox(key) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.dataset.box = key;
  for (const part of ["box", "title", "name"]) {
    const el = document.createElement("div");
    el.className = part;
    slot.append(el);
  }
  return slot;
}

export function setTitle(slot, text) {
  slot.querySelector(".title").textContent = text;
}

export function setName(slot, name, animate = true) {
  if (slot.dataset.name === name) return;
  slot.dataset.name = name;
  const holder = slot.querySelector(".name");
  for (const old of holder.querySelectorAll(".slide:not(.out)")) {
    if (!animate) {
      old.remove();
      continue;
    }
    old.classList.add("out");
    setTimeout(() => old.remove(), SLIDE_OUT_MS);
  }
  const slide = document.createElement("span");
  slide.className = animate ? "slide in" : "slide";
  const text = document.createElement("span");
  text.className = "text";
  text.textContent = name;
  slide.append(text);
  holder.append(slide);
  fitName(slot);
}

// Long names glide back and forth instead of shrinking or being cut off.
export function fitName(slot) {
  const holder = slot.querySelector(".name");
  const slide = holder.querySelector(".slide:not(.out)");
  if (!slide) return;
  const text = slide.firstElementChild;
  const distance = scrollDistance(text.offsetWidth, holder.clientWidth);
  slide.classList.toggle("scrolling", distance > 0);
  text.style.setProperty("--scroll", `-${distance}px`);
  text.style.setProperty("--scroll-ms", `${SCROLL_BASE_MS + distance * SCROLL_MS_PER_PX}ms`);
}
```

Create `js/events-demo.js`:

```js
import { BOXES } from "./event-map.js";

const NAMES = [
  "moonlitmara",
  "xX_StarGazer_Xx",
  "nova",
  "celestialcat42",
  "TheVeryLongestNameOnTwitc",
  "CometCass",
  "xX_StarGazerSupreme_2009X",
  "NyxNightly",
];

export function demoUpdate(n) {
  return { box: BOXES[n % BOXES.length], name: NAMES[(n * 3) % NAMES.length] };
}

export function startEventsDemo(onUpdate, intervalMs = 1500) {
  let n = 0;
  for (; n < BOXES.length; n++) onUpdate(demoUpdate(n));
  const timer = setInterval(() => onUpdate(demoUpdate(n++)), intervalMs);
  return { stop: () => clearInterval(timer) };
}
```

Create `js/events-main.js`:

```js
import { parseConfig, normalize } from "./config.js";
import { EVENTS_SCHEMA, eventsCssVars, titleFor } from "./events-schema.js";
import { loadFont } from "./fonts.js";
import { BOXES, mapFollow, mapUsernotice } from "./event-map.js";
import { createBox, setTitle, setName, fitName } from "./boxes.js";
import { createNameStore } from "./name-store.js";
import { connectChat } from "./twitch.js";
import { connectEventSub } from "./eventsub.js";
import { CLIENT_ID, tokenFromHash, validateToken } from "./auth.js";
import { getUserId, getFollowers } from "./helix.js";
import { startEventsDemo } from "./events-demo.js";

const VALIDATE_MS = 3600000; // Twitch requires validating a token at least hourly

const row = document.getElementById("row");
const slots = new Map(BOXES.map(key => [key, createBox(key)]));
row.append(...slots.values());

// Dev only: point EventSub at the Twitch CLI mock server.
const dev = new URLSearchParams(location.search);
const eventsubUrl = dev.get("eventsub") || undefined;
const eventsubApi = dev.get("api") || undefined;
const token = tokenFromHash(location.hash);

let config = null;
let store = null;
let chat = null;
let eventsub = null;
let demo = null;
let validateTimer = null;
let session = 0;

function applyConfig(next) {
  const prev = config;
  config = next;
  for (const [name, value] of Object.entries(eventsCssVars(config))) {
    document.documentElement.style.setProperty(name, value);
  }
  loadFont(config.namefont);
  document.body.classList.toggle("preview", config.bg);
  for (const key of BOXES) setTitle(slots.get(key), titleFor(config, key));
  if (!prev || prev.channel !== config.channel || prev.demo !== config.demo) start();
  else refit();
}

function refit() {
  requestAnimationFrame(() => slots.forEach(fitName));
}

function show(update, animate = true) {
  if (!update) return;
  setName(slots.get(update.box), update.name, animate);
  if (!config.demo) store.save(update.box, update.name);
}

function stop() {
  session++;
  chat?.close();
  eventsub?.close();
  demo?.stop();
  clearInterval(validateTimer);
  chat = eventsub = demo = validateTimer = null;
}

function start() {
  stop();
  store = createNameStore(config.channel);
  for (const key of BOXES) setName(slots.get(key), config.demo ? "" : store.load(key) ?? "", false);
  if (config.demo) {
    demo = startEventsDemo(update => show(update));
    return;
  }
  chat = connectChat(config.channel, ev => show(mapUsernotice(ev)));
  if (!token) {
    console.warn("Event boxes: no Twitch login, the follower box will not update");
    return;
  }
  startFollows(session);
}

async function startFollows(mine) {
  try {
    const me = await validateToken(token);
    if (mine !== session) return;
    if (!me) {
      console.warn("Event boxes: Twitch login expired or revoked, log in again on the settings page");
      return;
    }
    const api = { token, clientId: CLIENT_ID };
    const broadcasterId = await getUserId(config.channel, api);
    if (mine !== session) return;
    try {
      const { name } = await getFollowers(broadcasterId, api);
      if (mine !== session) return;
      if (name) show({ box: "follower", name }, false);
    } catch (err) {
      console.warn("Event boxes: could not load the latest follower", err);
    }
    eventsub = connectEventSub({
      token,
      clientId: CLIENT_ID,
      broadcasterId,
      moderatorId: me.userId,
      onNotification: payload => show(mapFollow(payload)),
      url: eventsubUrl,
      apiBase: eventsubApi,
    });
    validateTimer = setInterval(async () => {
      try {
        if (await validateToken(token)) return;
        console.warn("Event boxes: Twitch login expired, follower updates stopped");
        eventsub?.close();
        eventsub = null;
        clearInterval(validateTimer);
      } catch {
        // Network blip; try again next hour.
      }
    }, VALIDATE_MS);
  } catch (err) {
    console.warn("Event boxes: follower setup failed", err);
  }
}

window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.data?.type !== "config") return;
  applyConfig(normalize(e.data.values, EVENTS_SCHEMA));
});

// Names are measured for scrolling, so measure again once web fonts arrive.
document.fonts?.addEventListener("loadingdone", refit);
applyConfig(parseConfig(location.search, EVENTS_SCHEMA));
```

Note: passing `url: undefined` and `apiBase: undefined` to `connectEventSub` makes its destructuring defaults apply, so the real Twitch endpoints are used outside dev.

- [ ] **Step 4: Create the page and styles**

Create `events.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Event Boxes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Neonderthaw&display=swap" />
    <link rel="stylesheet" href="events.css" />
    <script type="module" src="js/events-main.js"></script>
  </head>
  <body>
    <main id="row"></main>
  </body>
</html>
```

Create `events.css`:

```css
/* Defaults; js/events-main.js overwrites these from the settings. */
:root {
  --title-size: 44px;
  --title-color: #eef3ff;
  --glow: #4f6dff;
  --name-font: "Quicksand";
  --name-size: 22px;
  --name-color: #ffffff;
  --box-w: 306px;
  --box-h: 60px;
  --gap: 66px;
  --fill-a: #ab97b2;
  --fill-b: #a293cc;
  --border-a: #a9d3e3;
  --border-b: #efeaf6;
  --shadow: rgba(60, 40, 90, 0.16);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

body.preview {
  background: #f4f2f8;
}

#row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap);
  height: 100%;
  /* The titles overhang the boxes' top edge; keep the whole strip visually centered. */
  padding-top: calc(var(--title-size) * 0.4);
}

.slot {
  position: relative;
  flex: none;
  width: var(--box-w);
  height: var(--box-h);
  filter: drop-shadow(0 10px 28px var(--shadow));
}

.box {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, var(--fill-a), var(--fill-b));
  border: 3px solid;
  border-image: linear-gradient(90deg, var(--border-a), var(--border-b)) 1;
}

.title {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -73%);
  white-space: nowrap;
  font: var(--title-size) / 1 "MoonTime", "Neonderthaw", cursive;
  color: var(--title-color);
  text-shadow: 0 0 2px #fff, 0 0 6px var(--glow), 0 0 14px var(--glow), 0 0 26px var(--glow);
  pointer-events: none;
}

.name {
  position: absolute;
  inset: 3px 14px;
  overflow: hidden;
}

.slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 6px;
}

.slide.scrolling {
  justify-content: flex-start;
}

.slide.in {
  animation: slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.slide.out {
  animation: slide-out 0.4s ease-in both;
}

.text {
  display: inline-block;
  white-space: nowrap;
  font: 600 var(--name-size) / 1.2 var(--name-font), sans-serif;
  color: var(--name-color);
  text-shadow: 0 1px 3px rgba(40, 20, 70, 0.45);
}

.slide.scrolling .text {
  animation: name-scroll var(--scroll-ms) ease-in-out infinite alternate;
}

@keyframes slide-in {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
}

@keyframes slide-out {
  to {
    transform: translateY(-100%);
    opacity: 0;
  }
}

@keyframes name-scroll {
  0%,
  15% {
    transform: none;
  }
  85%,
  100% {
    transform: translateX(var(--scroll));
  }
}
```

- [ ] **Step 5: Run tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 6: Verify in the browser**

With `python3 -m http.server 8000` running:

```bash
chromium --headless --disable-gpu --window-size=1700,330 --virtual-time-budget=6000 \
  --screenshot=/tmp/claude-1000/events-demo.png "http://localhost:8000/events.html?demo=1&bg=1"
```

Look at the screenshot and check against the approved mockups: four lavender boxes in a centered row, neon titles on the top edges ("New Follower", "New Subscriber", "Recent Gifter", "Recent Resub", in Neonderthaw unless MoonTime is installed), each name centered in its box, long names left-aligned (they are mid-scroll). Then open the same URL in a normal Chromium window for ~10 seconds and watch: names slide up when replaced, 25-character names glide back and forth with pauses, short names stay still and centered.

Also check `http://localhost:8000/events.html` with no token in a normal window: DevTools console shows "Event boxes: no Twitch login, the follower box will not update" and no errors; the page is transparent.

- [ ] **Step 7: Commit**

```bash
git add js/boxes.js js/events-demo.js js/events-main.js events.html events.css tests/boxes.test.js tests/events-demo.test.js
git commit -m "Add the event boxes overlay

Shows the latest follower, sub, gifter and resub with names centered in
each box, sliding in when they change and scrolling when too long."
```

---

### Task 9: Events settings page with Twitch login

**Files:**
- Create: `events-settings.html`, `js/events-settings.js`

**Interfaces:**
- Consumes: `mountSettings` (Task 3), `EVENTS_SCHEMA` (Task 2), everything in `js/auth.js` and `js/helix.js` (Task 6).
- Produces: nothing used by other code.

Login round trip: the Connect button saves a random `state` and the current query in `sessionStorage`, then sends the browser to Twitch. Twitch redirects back to `events-settings.html` with `#access_token=…&state=…` (or `?error=…&error_description=…&state=…` when denied). The page checks `state`, restores the saved query, and puts the token in the fragment as `#token=…`.

This task is DOM only; it is verified in the browser.

- [ ] **Step 1: Create `events-settings.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Event Boxes Settings</title>
    <link rel="stylesheet" href="settings.css" />
    <style>
      .auth {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--line);
        color: var(--muted);
      }
      .auth p {
        margin: 0;
      }
      #auth-status {
        flex: 1 1 320px;
        color: var(--text);
      }
      .warn {
        color: #ffb36b;
        font-size: 12px;
      }
      .layout.wide {
        grid-template-columns: minmax(0, 1fr);
      }
      .layout.wide form {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        align-items: start;
        max-height: none;
        overflow: visible;
      }
      .stage.wide {
        position: static;
        width: 100%;
        height: auto;
        aspect-ratio: 1700 / 330;
        resize: none;
      }
      .stage.wide iframe {
        width: 1700px;
        height: 330px;
        transform-origin: 0 0;
        transform: scale(var(--scale, 0.5));
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Event boxes settings</h1>
      <div class="url">
        <input id="obs-url" readonly aria-label="OBS browser source URL" />
        <button id="copy" type="button">Copy OBS URL</button>
      </div>
    </header>
    <section class="auth">
      <button id="connect" type="button">Connect Twitch</button>
      <p id="auth-status">Checking login…</p>
      <p class="warn">After you connect, the OBS URL contains your login token after the #. Don't show it on stream.</p>
    </section>
    <div class="layout wide">
      <div class="stage wide"><iframe id="preview" title="Overlay preview"></iframe></div>
      <form id="form" onsubmit="return false"></form>
    </div>
    <script type="module" src="js/events-settings.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `js/events-settings.js`**

```js
import { mountSettings } from "./settings-form.js";
import { EVENTS_SCHEMA } from "./events-schema.js";
import { CLIENT_ID, authorizeUrl, readHash, tokenFromHash, tokenHash, validateToken, missingScopes } from "./auth.js";
import { getUserId, getFollowers } from "./helix.js";

const STATE_KEY = "event-boxes:auth-state";
const QUERY_KEY = "event-boxes:auth-query";
const OVERLAY_WIDTH = 1700;

const status = document.getElementById("auth-status");
const connect = document.getElementById("connect");
const stage = document.querySelector(".stage");

function session(action) {
  try {
    return action(sessionStorage);
  } catch {
    return null;
  }
}

let token = tokenFromHash(location.hash);
let loginError = null;

// Coming back from Twitch: check state, restore the settings query the redirect dropped.
const callback = readHash(location.hash);
const query = new URLSearchParams(location.search);
if (callback.access_token || query.has("error")) {
  const expected = session(s => s.getItem(STATE_KEY));
  const saved = session(s => s.getItem(QUERY_KEY)) ?? "";
  session(s => (s.removeItem(STATE_KEY), s.removeItem(QUERY_KEY)));
  const state = callback.state ?? query.get("state");
  if (query.has("error")) loginError = `Twitch login failed: ${query.get("error_description") || query.get("error")}`;
  else if (!expected || state !== expected) loginError = "Login rejected because it did not come from this page. Try again.";
  else token = callback.access_token;
  history.replaceState(null, "", saved ? `?${saved}` : location.pathname);
}

let check = 0;
async function checkStatus(channel) {
  const mine = ++check;
  const say = text => {
    if (mine === check) status.textContent = text;
  };
  if (!token) {
    say(loginError ?? "Not connected. Subs, gifts and resubs work without a login; the follower box needs a moderator login.");
    return;
  }
  try {
    const me = await validateToken(token);
    if (!me) return say("Login expired or revoked. Connect again.");
    const missing = missingScopes(me.scopes);
    if (missing.length) return say(`Login is missing ${missing.join(", ")}. Connect again.`);
    const days = Math.floor(me.expiresIn / 86400);
    const expiry = me.expiresIn > 0 ? `expires in ${days} day${days === 1 ? "" : "s"}` : "no expiry reported";
    const api = { token, clientId: CLIENT_ID };
    const { total, name } = await getFollowers(await getUserId(channel, api), api);
    const access = total > 0 && !name ? `${me.login} is not a moderator of ${channel}, so the follower box will not update` : `can read ${channel}'s followers`;
    say(`Connected as ${me.login} · ${expiry} · ${access}`);
  } catch (err) {
    say(`Could not check the login: ${err.message}`);
  }
}

const settings = mountSettings({
  schema: EVENTS_SCHEMA,
  overlay: "events.html",
  preview: "events.html",
  fragment: () => tokenHash(token),
  onChange: values => checkStatus(values.channel),
});
settings.update();

connect.addEventListener("click", () => {
  const state = crypto.randomUUID();
  session(s => (s.setItem(STATE_KEY, state), s.setItem(QUERY_KEY, location.search.slice(1))));
  location.href = authorizeUrl(location.origin + location.pathname, state);
});

// The preview renders at the real 1700x330 OBS size and is scaled down to fit.
new ResizeObserver(() => stage.style.setProperty("--scale", stage.clientWidth / OVERLAY_WIDTH)).observe(stage);
```

`settings.update()` runs `onChange`, so the first status check happens on load. The `channel` field is a text field, so `onChange` (and the status check) fires only when it is committed, not on every keystroke; other edits also re-run the check, which is cheap.

- [ ] **Step 3: Verify in the browser**

With `python3 -m http.server 8000` running, open `http://localhost:8000/events-settings.html` in Chromium.

Check:
1. Preview shows the four demo boxes at full width, scaled, with no horizontal page scroll. Resize the window: the preview scales with it.
2. Status reads "Not connected. …". The OBS URL is `http://localhost:8000/events.html` with no `#`.
3. Change Box width to 350: preview updates, the URL gains `boxw=350`, the address bar shows `?boxw=350`.
4. Open `http://localhost:8000/events-settings.html?boxw=350#token=fake123`: the URL field ends with `#token=fake123` and has no `token=` in the query; status reads "Login expired or revoked. Connect again." (Twitch answers 401 for a fake token).
5. Open `http://localhost:8000/events-settings.html#access_token=abc&state=wrong`: status reads "Login rejected because it did not come from this page. Try again." and the address bar no longer contains `access_token`.
6. Open `http://localhost:8000/settings.html` again: the chat settings page still works (Task 3 regression check).

- [ ] **Step 4: Commit**

```bash
git add events-settings.html js/events-settings.js
git commit -m "Add the event boxes settings page with Twitch login

Shows whether the login can read the channel's followers so a missing
moderator role is caught before going live."
```

---

### Task 10: README and live verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the README section**

Insert after the "OBS setup" section of `README.md`:

```markdown
## Event boxes overlay

Four boxes showing the latest follower, new subscriber, sub gifter and resub.

- Overlay: https://cydiann.github.io/chat-overlay/events.html
- Settings with live preview: https://cydiann.github.io/chat-overlay/events-settings.html

### Setup

1. Install the MoonTime font on the streaming PC (the font file is not in this repo; it is a licensed font). Without it the titles fall back to Neonderthaw.
2. Open the settings page and click **Connect Twitch**. Log in with an account that moderates the channel. The status line confirms it can read the channel's followers.
3. Click **Copy OBS URL**. In OBS: Sources > + > Browser, paste the URL, Width 1700, Height 330.
4. Subs, gifts and resubs work without a login. Only the follower box needs it.

The OBS URL carries the login token after the `#`. Browsers never send that part to the server, so GitHub Pages never sees it, but don't show the URL on stream. Twitch logins from this page expire after a while; when the status line says so, connect again and paste the new URL into OBS.

Resubs only show up when the viewer shares the resub message in chat. That is how Twitch reports them.

The Twitch app behind the login is `chat-overlay` in the Twitch developer console. Its OAuth redirect URLs must include `https://cydiann.github.io/chat-overlay/events-settings.html` and `http://localhost:8000/events-settings.html`.
```

And append to the "Development" section:

```markdown
- Event boxes: http://localhost:8000/events.html?demo=1&bg=1
- Event boxes settings: http://localhost:8000/events-settings.html
- Sub, gift and resub boxes can be watched without a login by setting the channel to a big streamer; those notices arrive every few minutes.
- Follows without waiting for real ones: run the Twitch CLI mock (`nix shell nixpkgs#twitch-cli -c twitch event websocket start-server`), then load `events.html?eventsub=ws://127.0.0.1:8080/ws&api=http://127.0.0.1:8080#token=<your token>` and fire `twitch event trigger channel.follow --transport=websocket`. The token is still validated against Twitch, so use a real one from the settings page.
```

- [ ] **Step 2: Run all tests**

Run: `node --test`
Expected: all pass.

- [ ] **Step 3: Live verification (needs the user for the login)**

1. Ask the user to open `http://localhost:8000/events-settings.html`, click Connect Twitch, and log in with their moderator account. Expect the status "Connected as … · expires in N days · can read lennelen's followers".
2. Open the copied overlay URL in Chromium. Expect New Follower to show lennelen's newest follower right away. DevTools console: no errors.
3. Twitch CLI mock: start the server and load the overlay with `?eventsub=…&api=…` plus the real token as in the README. Fire `twitch event trigger channel.follow --transport=websocket`. Expect a new name to slide into New Follower. If the CLI cannot be installed, skip this and rely on step 5.
4. Set the channel to a large live channel (pick one live on twitch.tv right now) in the overlay URL and leave it open for a few minutes. Expect subs, resubs and gifts in the right boxes and a mystery gift crediting the gifter once.
5. Ask the user to have someone follow lennelen (or follow from a second account) while the overlay is open. Expect the name in New Follower within a few seconds.
6. Reload the overlay: names stay.
7. Open `http://localhost:8000/?demo=1&bg=1`: the chat overlay works as before.

Report each result to the user, including anything that did not work.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document the event boxes overlay setup and testing"
```
