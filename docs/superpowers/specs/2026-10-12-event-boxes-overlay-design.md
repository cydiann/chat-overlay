# Event Boxes Overlay: Design

Date: 2026-10-12

## Goal

A second OBS browser source for lennelen's stream: a horizontal strip of four boxes showing the latest follower, new subscriber, sub gifter and resubscriber. Each username is always centered in its box. The look is rebuilt in HTML/CSS from a reference strip image: lavender gradient boxes with a light-blue border and a neon script title sitting on each box's top edge.

## Scope

In scope:

- Four boxes, fixed order: New Follower, New Subscriber, Recent Gifter, Recent Resub.
- Live events through Twitch EventSub over WebSocket, authenticated with the broadcaster's own token.
- Last names persisted per box so a source refresh or OBS restart does not blank them.
- A settings page with live preview, Twitch login, and OBS URL copy.
- Demo mode and a dev hook for the Twitch CLI mock EventSub server.

Out of scope:

- Alert animations, sounds, counters, goals.
- Cheers, raids, donations.
- Token refresh (implicit-grant tokens cannot be refreshed; the streamer logs in again).
- Any server. Everything stays client-side on GitHub Pages.
- Changing the chat overlay's behavior.

## Hosting

- Same repo and GitHub Pages site as the chat overlay.
- Overlay: `https://cydiann.github.io/chat-overlay/events.html`
- Settings: `https://cydiann.github.io/chat-overlay/events-settings.html`
- OBS browser source: 1700x330, transparent.

## Architecture

```
events.html            overlay shell; loads events.css + js/events-main.js
events-settings.html   settings form, live preview iframe, Connect Twitch, copy URL
events.css             box, title, name, slide and scroll animations; tunables as CSS custom properties
js/events-schema.js    settings schema for this overlay
js/events-main.js      startup, config, wiring between auth, store, eventsub and render
js/eventsub.js         EventSub WebSocket client (welcome, subscribe, keepalive, reconnect, dedupe)
js/event-map.js        pure: EventSub notification -> { box, name } or null
js/boxes.js            render the four boxes; set a name with slide animation; overflow scroll
js/name-store.js       localStorage persistence of last name per box, failure-tolerant
js/auth.js             CLIENT_ID, authorize URL, fragment token parse/write, validate call
js/events-demo.js      fake names cycling through the boxes
js/settings-form.js    schema-driven settings form + preview + copy URL, extracted from settings.js
js/config.js           parse/serialize/normalize now take the schema as a parameter
js/settings.js         thin wrapper: settings-form.js with the chat schema
js/events-settings.js  settings-form.js with the events schema, plus the Connect Twitch flow
```

Plain HTML, CSS and ES modules, no build step, no runtime dependencies, matching the chat overlay.

## Visual design

- Row of four boxes, centered horizontally and vertically in the source, transparent page background.
- Box: default 306x60. Fill is a linear gradient from mauve (`#ab97b2`) to lavender (`#a293cc`). 3px border with a gradient from light blue (`#a9d3e3`) to near white (`#efeaf6`). Soft drop shadow.
- Title: centered on the box's top edge, overlapping it. Font `MoonTime` (system-installed, see Fonts) with `Neonderthaw` as the Google Fonts fallback. Near-white text with a layered blue neon `text-shadow` glow. Title case: "New Follower", "New Subscriber", "Recent Gifter", "Recent Resub".
- Name: Quicksand 600, white, subtle dark shadow, centered both ways in the box. Display name shown exactly as Twitch sends it.
- Long names: when the name is wider than the box's inner width, it scrolls slowly left and right with a pause at each end (CSS animation, distance set from the measured overflow). Names that fit do not move. Overflow is measured each time a name is set and after fonts load.
- New name: the old name slides out upward and fades, the new one slides in from below (about 0.5s). Each box animates independently.
- Empty box: box and title only.

### Fonts

MoonTime is a commercial Creative Market font (Dmitriy Chirkov). The font file is never committed or hosted. The streamer installs it on the streaming PC, and the CSS uses `font-family: "MoonTime", "Neonderthaw", cursive`. OBS's browser source picks up system fonts. Machines without it show Neonderthaw.

## Settings (`js/events-schema.js`)

Same schema shape as `js/schema.js` (key, group, type, default, label, and min/max/options/pattern where relevant).

- Titles: text for each of the four titles (defaults above), title size, glow color.
- Names: font (the existing `FONTS` list, default Quicksand), size (default 22), color (default white).
- Boxes: width, height, gap, fill color A, fill color B, border color A, border color B, shadow strength.
- Demo: `demo` and `bg` toggles, hidden from the form like the chat overlay.

The token is not a schema field, so it can never end up in the query string. `settings-form.js` takes an optional `fragment()` callback whose result is appended to the copied OBS URL and the settings page's own address; the events settings page uses it for `#token=…`, the chat settings page passes none.

`config.js`'s `defaults`, `normalize`, `parseConfig` and `serializeConfig` take the schema as an argument. The chat overlay passes its `SCHEMA`; existing tests are updated accordingly.

## Token handling

- The token is never in the query string. It lives in the URL fragment: `events.html?<settings>#token=<token>`. Fragments are not sent to the server, so GitHub Pages never sees it. The overlay and settings page read it from `location.hash`.
- Both pages set `<meta name="referrer" content="no-referrer">`.
- The token exists only in OBS's source URL, the streamer's browser, and requests to Twitch.
- Scopes: `moderator:read:followers`, `channel:read:subscriptions`. Read-only.

## Login (settings page)

1. `CLIENT_ID` is a constant in `js/auth.js` (client IDs are public). While empty, the Connect Twitch button is disabled with a note pointing to the README.
2. Connect Twitch redirects to `https://id.twitch.tv/oauth2/authorize` with `response_type=token`, `client_id`, `redirect_uri` = the current `events-settings.html` URL without query or fragment, both scopes, and a random `state` saved in `sessionStorage`.
3. On return the page reads `access_token` and `state` from the fragment, rejects a state mismatch, puts the token into the config, and rewrites the address bar to `?<settings>#token=<token>`.
4. It calls `GET https://id.twitch.tv/oauth2/validate` and shows "Connected as <login>, expires in N days", or an error for missing scopes or an invalid token.
5. Copy OBS URL produces `events.html?<settings>#token=<token>`. A one-line warning says not to show this URL on stream.

The Twitch app needs two redirect URLs registered: the GitHub Pages `events-settings.html` URL and `http://localhost:8000/events-settings.html`.

## Data flow (overlay)

Startup:

1. Parse settings from the query and the token from the fragment.
2. Render the four boxes and restore saved names from `name-store`.
3. If demo mode is on, start the demo and stop here (no token needed).
4. If there is no token, log a warning and stop (saved names stay on screen).
5. Validate the token. Use `user_id` as the broadcaster ID. On failure, log and stop.
6. Seed New Follower from `GET https://api.twitch.tv/helix/channels/followers?broadcaster_id=<id>&first=1` (newest first). This value overrides the saved one.
7. Connect EventSub.
8. Re-validate every hour. On 401, close EventSub and keep the names on screen.

Name store keys: `event-boxes:<broadcaster_id>:<box>` where box is `follower`, `subscriber`, `gifter`, `resub`. Every access is wrapped in try/catch. Demo mode does not write to the store.

## EventSub client (`js/eventsub.js`)

Shape follows `js/twitch.js`: `connectEventSub({ token, clientId, broadcasterId, onNotification, url, apiBase }, { WebSocketImpl, fetchImpl, setTimer, clearTimer, now })` returns `{ close() }`.

- Connects to `wss://eventsub.wss.twitch.tv/ws` (overridable for the Twitch CLI mock).
- On `session_welcome`: store `keepalive_timeout_seconds`, then POST four subscriptions to `<apiBase>/eventsub/subscriptions` with `transport: { method: "websocket", session_id }`, headers `Client-Id` and `Authorization: Bearer <token>`:
  - `channel.follow` v2, condition `{ broadcaster_user_id, moderator_user_id }` (both the broadcaster)
  - `channel.subscribe` v1, condition `{ broadcaster_user_id }`
  - `channel.subscription.gift` v1, condition `{ broadcaster_user_id }`
  - `channel.subscription.message` v1, condition `{ broadcaster_user_id }`
  Each POST is independent; a failure is logged and the rest continue.
- Any message resets the silence timer. No message for `keepalive_timeout_seconds` + 5s: close and reconnect using `backoffDelay` from `twitch.js`.
- `session_reconnect`: open `reconnect_url`; when its `session_welcome` arrives, close the old socket. No new subscription POSTs on a reconnect welcome.
- `notification`: drop if its `metadata.message_id` was seen (bounded set of the last 500 IDs), otherwise pass `payload` to `onNotification`.
- `revocation`: log the subscription type and status.
- Backoff attempt counter resets after a successful welcome.

## Event mapping (`js/event-map.js`)

Pure function from a notification payload to `{ box, name }` or `null`:

| Subscription type | Condition | Box | Name |
|---|---|---|---|
| `channel.follow` | | follower | `event.user_name` |
| `channel.subscribe` | `is_gift === false` | subscriber | `event.user_name` |
| `channel.subscribe` | `is_gift === true` | ignored | |
| `channel.subscription.gift` | `is_anonymous` | gifter | `"Anonymous"` |
| `channel.subscription.gift` | otherwise | gifter | `event.user_name` |
| `channel.subscription.message` | | resub | `event.user_name` |
| anything else | | ignored | |

Known Twitch limitation: `channel.subscription.message` only fires when the viewer shares their resub in chat. Resubs that are never announced do not reach the overlay.

## Error handling

The overlay never shows an error on stream. It always renders the boxes with whatever names it has. Problems go to `console`. Status for the streamer is shown on the settings page.

| Problem | Behavior |
|---|---|
| No token / invalid token at startup | Saved names shown, not live, console warning |
| Token expires mid-stream (hourly validate 401) | EventSub closed, names stay |
| A subscription POST fails | Logged; other boxes keep working |
| `revocation` | Logged |
| Socket drop or silence | Reconnect with backoff |
| `localStorage` unavailable or throwing | Works without persistence |
| Follower seed request fails | Logged; saved name stays |

Names are always set with `textContent`.

## Demo and dev

- `?demo=1` cycles names through all four boxes every few seconds, including 25-character names, so slide and scroll are visible. `?bg=1` adds a light preview background. The settings preview iframe uses both.
- `?eventsub=<ws url>&api=<base url>` point the overlay at the Twitch CLI mock (`twitch event websocket start-server`), for testing sub, gift and resub events without real ones. Documented in the README.

## Testing

Unit tests with `node --test`, no dependencies:

- `eventsub.test.js`: fake WebSocket, injected `fetch` and timers. Welcome triggers four POSTs with correct bodies and headers; notifications reach the callback; duplicate `message_id` dropped; silence past keepalive triggers reconnect; `session_reconnect` closes the old socket only after the new welcome and does not re-POST; one failing POST does not stop the others.
- `event-map.test.js`: every row of the mapping table.
- `auth.test.js`: authorize URL contents, fragment parsing, state mismatch rejected, token fragment written without touching the query.
- `name-store.test.js`: save and restore with a fake storage, keys per broadcaster, throwing storage tolerated.
- `config.test.js`: updated for the schema parameter; events schema defaults and coercion.

Manual check before done:

- Demo mode at 1700x330 in a browser: centering, slide animation, long-name scroll.
- Twitch CLI mock: a follow, sub, gift, anonymous gift and resub each land in the right box; a gifted recipient sub does not change New Subscriber.
- Reload keeps saved names.
- Chat overlay and its settings page still work after the config and settings refactor.

## README additions

- Events overlay setup: install MoonTime on the streaming PC, register a Twitch app (redirect URLs), set `CLIENT_ID`, connect, copy URL, add a 1700x330 browser source.
- Token note: it's in the URL fragment, never sent to GitHub; re-login when it expires.
- Dev: Twitch CLI mock usage with `?eventsub=` and `?api=`.
