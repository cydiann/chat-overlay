# Celestial Chat Overlay: Design

Date: 2026-10-11

## Goal

A custom Twitch chat overlay for lennelen's stream, used as an OBS browser source. Messages appear as celestial-themed frosted-glass bubbles (modeled on the Etsy "Celestial Chat Widget" reference) with Twitch, 7TV, BTTV and FFZ emotes rendered inline.

## Scope

In scope:

- Twitch chat messages for one channel (default `lennelen`).
- Emotes: Twitch native (from IRC `emotes` tag), 7TV, BTTV, FFZ (channel + global sets for each).
- Moderation sync: deleted messages, timeouts and bans remove bubbles immediately.
- A settings page with live preview that produces the OBS URL.

Out of scope (v1):

- Event cards (subs, cheers, follows, raids, donations).
- Twitch badge images (need an authenticated API). Replaced by themed role marks.
- Live 7TV emote set updates mid-stream (refresh the OBS source to pick up new emotes).
- Any server or authentication. Everything runs client-side, anonymously.

## Hosting

- Public GitHub repo `cydiann/chat-overlay`, GitHub Pages from `main`.
- Overlay: `https://cydiann.github.io/chat-overlay/`
- Settings: `https://cydiann.github.io/chat-overlay/settings.html`
- Plain HTML, CSS and ES modules. No build step, no runtime dependencies.

## Architecture

```
chat-overlay/
  index.html        overlay shell; loads style.css + js/main.js
  settings.html     settings form + live preview iframe
  style.css         theme; all tunables are CSS custom properties
  js/schema.js      single settings schema: key, type, default, label, group
  js/config.js      parse URL params against schema; serialize non-default values
  js/irc.js         pure IRC line + tag parser
  js/twitch.js      anonymous WebSocket client (connect, join, reconnect)
  js/emotes.js      fetch 7TV/BTTV/FFZ sets into one name -> url map
  js/tokenize.js    pure: message text + Twitch emote ranges + emote map -> tokens
  js/moon.js        pure: user id -> moon phase index
  js/render.js      tokens + metadata -> bubble DOM (text nodes only)
  js/effects.js     starfield, shooting stars, sparkle pops, constellation lines
  js/demo.js        sample message generator for demo mode
  js/main.js        wiring: config, client, emotes, render, fade/max, postMessage
  tests/*.test.js   node:test suites for the pure modules
```

### Data flow

1. `config.js` reads URL params against `schema.js`, applies values as CSS custom properties and feature flags.
2. `twitch.js` connects to `wss://irc-ws.chat.twitch.tv:443`, sends `CAP REQ :twitch.tv/tags twitch.tv/commands`, `NICK justinfan<random>`, `JOIN #<channel>`.
3. On `ROOMSTATE`, the `room-id` tag gives the channel's numeric ID. `emotes.js` then fetches, in parallel:
   - 7TV: `https://7tv.io/v3/users/twitch/<id>` (channel set) and `https://7tv.io/v3/emote-sets/global`
   - BTTV: `https://api.betterttv.net/3/cached/users/twitch/<id>` and `https://api.betterttv.net/3/cached/emotes/global`
   - FFZ: `https://api.frankerfacez.com/v1/room/id/<id>` and `https://api.frankerfacez.com/v1/set/global`
   Merge priority on name clash: 7TV channel > 7TV global > BTTV > FFZ.
4. On `PRIVMSG`, `irc.js` parses tags (`display-name`, `color`, `user-id`, `badges`, `emotes`, `id`), `tokenize.js` produces tokens, `render.js` builds the bubble, `main.js` inserts it and schedules fade.
5. `CLEARMSG` (by `target-msg-id`) removes one bubble; `CLEARCHAT` with a user removes that user's bubbles; `CLEARCHAT` without a user clears all.
6. `PING` is answered with `PONG`.

### Tokenizing

- Twitch `emotes` tag ranges are in Unicode code points. Convert the message to an array of code points (`Array.from`) before slicing, so emoji before an emote do not shift positions.
- Non-Twitch-emote text is split on spaces; each word that matches the third-party map becomes an emote token, else text.
- 7TV zero-width emotes stack on top of the previous emote.
- Messages consisting only of emotes get a `big-emotes` class.
- Twitch emote URL: `https://static-cdn.jtvnw.net/emoticons/v2/<id>/default/dark/2.0`.

## Visuals

Defaults (all configurable via schema):

| Group | Setting | Default |
|---|---|---|
| Text | message font | Urbanist |
| Text | username font | Marcellus |
| Text | text size | 14px |
| Text | line height | 1.5 |
| Text | message text color | `#e9edff` |
| Pill | pill color | `#c3b2f5` |
| Pill | pill opacity | 40 |
| Pill | username text color | `#fefefe` |
| Pill | use Twitch name color | off |
| Glass | tint | `#121a38` |
| Glass | opacity | 50 |
| Glass | blur | 12px |
| Glass | border color A | `#a9b7e8` |
| Glass | border color B | `#b78cff` |
| Glass | border strength | 55 |
| Glass | moonlight sheen | 12 |
| Shape | corner radius | 16px |
| Shape | shadow softness | 25px |
| Shape | message spacing | 20px |
| Shape | horizontal padding | 16px |
| Shape | vertical padding | 10px |
| Ornaments | ornament color | `#c9b6ff` |
| Ornaments | moon icon color | `#f4eddc` |
| Effects | personal moon phases | on |
| Effects | sparkle pops + particles | on |
| Effects | constellation lines | on |
| Effects | ambient starfield | on |
| Effects | star count | 70 |
| Effects | star color | `#ffffff` |
| Effects | random shooting stars | on |
| Behavior | channel | `lennelen` |
| Behavior | fade after (seconds, 0 = never) | 30 |
| Behavior | max messages | 8 |
| Behavior | hidden users (comma list) | empty |
| Behavior | hide `!commands` | off |
| Demo | demo mode | off |
| Demo | preview background | off |

Fonts load from Google Fonts. Both font settings are dropdowns of a curated list (Urbanist, Quicksand, Nunito, Poppins, Marcellus, Cinzel, Cormorant Garamond).

### Bubble anatomy

- Frosted glass rectangle: tint at configured opacity, `backdrop-filter: blur()`, gradient border (A to B) at border strength, outer violet glow, sheen highlight along the top edge.
- Name pill sits on the bubble's top-left edge: moon phase icon, role mark (broadcaster ☀, mod ✦, VIP ◆; none for others), uppercase display name.
- Inline SVG ornaments: four-point sparkle at top-right, crescent at bottom-left.

### Personal moon phases

`moon.js` hashes `user-id` (FNV-1a, 32-bit) to one of 8 phases (new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent). Rendered as inline SVG in the moon icon color. Off: every user gets the crescent.

### Layout and motion

- Single left-aligned column anchored to the bottom of the source; new bubbles append at the bottom and older ones move up.
- Enter: slide up + fade in (~300ms), sparkle pop (scale + rotate burst, a few particles drifting up and fading).
- Constellation line: on enter, a dotted SVG line draws from the previous bubble's pill to the new pill, holds briefly, fades.
- Exit: after `fade` seconds, fade out then collapse height (so the column eases down). Exceeding `max` removes the oldest immediately with the same exit animation.
- Starfield: absolutely positioned layer behind the column, stars at random positions with staggered twinkle. Shooting star at random 8 to 20 s intervals.
- Background is transparent unless preview background is on (night-sky gradient, for demo/settings only).

## Settings page

- Form generated from `schema.js`, grouped as in the table above. Inputs: color pickers, number fields, toggles, dropdowns, text.
- Right side: `<iframe src="index.html?demo=1&bg=1&...">`. Form changes are sent with `postMessage({type: "config", values})`; the overlay applies them live without reload. The overlay only accepts messages from its own origin.
- "Copy OBS URL" writes `https://cydiann.github.io/chat-overlay/?<non-default params>` to the clipboard, always omitting `demo` and `bg`.
- Opening `settings.html?<params>` pre-fills the form, so a pasted OBS URL's query can be edited later.

## Error handling

- Socket close or error: reconnect with exponential backoff 1s, 2s, 4s ... capped at 30s; reset after a successful join.
- Each emote fetch is independent; failures and 404s are logged to console and skipped. Rendering never waits on emote loading; messages before the map loads render with Twitch emotes only.
- Emote `<img>` `onerror` replaces the image with its name as text.
- Invalid param values (wrong type, out of range, bad color) fall back to the schema default.
- All user content is inserted via `textContent` / text nodes. No `innerHTML` with chat data.

## Testing

`node --test tests/` with no dependencies. Covered:

- `irc.js`: tag parsing including escaped values (`\s`, `\:`, `\\`), PRIVMSG / CLEARMSG / CLEARCHAT / ROOMSTATE / PING, messages with `:` in the body.
- `tokenize.js`: Twitch emote ranges, emoji before an emote (code point offsets), third-party matches, priority on clashes, zero-width stacking, emote-only detection.
- `moon.js`: deterministic, in range, spreads across phases.
- `config.js`: parse with defaults, invalid values fall back, serialize omits defaults, round trip.

Manual: demo mode in a desktop browser, then live in OBS against the real channel.
