# Event Boxes Overlay: Design

Date: 2026-10-12

## Goal

A second OBS browser source for lennelen's stream: a horizontal strip of four boxes showing the latest follower, new subscriber, sub gifter and resubscriber. Each username is always centered in its box. The look is rebuilt in HTML/CSS from a reference strip image: lavender gradient boxes with a light-blue border and a neon script title sitting on each box's top edge.

## Scope

In scope:

- Four boxes, fixed order: New Follower, New Subscriber, Recent Gifter, Recent Resub.
- Follows through Twitch EventSub over WebSocket, authenticated with a channel moderator's token (the person running the overlay, not the broadcaster).
- Subs, gifts and resubs through anonymous Twitch IRC `USERNOTICE` messages, the same connection type the chat overlay uses.
- Last names persisted per box so a source refresh or OBS restart does not blank them.
- A settings page with live preview, Twitch login, and OBS URL copy.
- Demo mode and a dev hook for the Twitch CLI mock EventSub server.

Why this split: Twitch only lets the broadcaster's own token subscribe to EventSub sub events, but follows can be read by any moderator. Sub, resub and gift notices are public in chat, so anonymous IRC covers them without anyone's token.

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
js/events-main.js      startup, config, wiring between auth, store, eventsub, IRC and render
js/eventsub.js         EventSub WebSocket client (welcome, subscribe, keepalive, reconnect, dedupe)
js/event-map.js        pure: EventSub follow notification or IRC usernotice event -> { box, name } or null
js/irc.js              gains a USERNOTICE case in toEvent (chat overlay ignores the new event type)
js/twitch.js           unchanged; connectChat is reused for the IRC side
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

- Behavior: `channel` (same field, cleaning and validation as the chat schema, default `lennelen`).
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
- Scope: `moderator:read:followers` only. Read-only; the worst a leaked token allows is reading the follower list of channels the moderator moderates.

## Login (settings page)

1. `CLIENT_ID` is a constant in `js/auth.js` (client IDs are public), from the dedicated `chat-overlay` Twitch app (Public client): `7cc4880z454947qrnfi3z0w493ta4s`.
2. Connect Twitch redirects to `https://id.twitch.tv/oauth2/authorize` with `response_type=token`, `client_id`, `redirect_uri` = the current `events-settings.html` URL without query or fragment, the scope, and a random `state` saved in `sessionStorage`.
3. On return the page reads `access_token` and `state` from the fragment, rejects a state mismatch, puts the token into the config, and rewrites the address bar to `?<settings>#token=<token>`.
4. It calls `GET https://id.twitch.tv/oauth2/validate`, then `GET /helix/users?login=<channel>` and `GET /helix/channels/followers?broadcaster_id=<id>&first=1`. It shows "Connected as <login>, expires in N days, can read <channel>'s followers", or a clear error: invalid token, missing scope, or "<login> is not a moderator of <channel>" when the followers call returns no data or is refused.
5. Copy OBS URL produces `events.html?<settings>#token=<token>`. A one-line warning says not to show this URL on stream.

The Chat Overlay app needs two OAuth redirect URLs registered in the Twitch developer console: the GitHub Pages `events-settings.html` URL and `http://localhost:8000/events-settings.html`.

## Data flow (overlay)

Startup:

1. Parse settings from the query and the token from the fragment.
2. Render the four boxes and restore saved names from `name-store`.
3. If demo mode is on, start the demo and stop here (no token needed).
4. If there is no token, log a warning and skip the follower steps (saved names stay on screen); IRC still runs.
5. Connect anonymous IRC to `channel` with `connectChat`. This runs regardless of the token, so the sub, gift and resub boxes work even with no or an expired token.
6. If there is no token, log a warning and skip the follower steps.
7. Validate the token; its `user_id` is the moderator ID. Resolve the channel's broadcaster ID with `GET /helix/users?login=<channel>`. On a definitive failure (401/403, or an expired/null validate), log and skip the follower steps. A transient failure (network error, or any other error) retries with backoff instead of giving up for the session.
8. Seed New Follower from `GET https://api.twitch.tv/helix/channels/followers?broadcaster_id=<id>&first=1` (newest first). This value overrides the saved one.
9. Connect EventSub for follows.
10. Re-validate every hour. On 401, close EventSub; IRC and the names on screen stay.

Name store keys: `event-boxes:<channel>:<box>` where box is `follower`, `subscriber`, `gifter`, `resub`. Every access is wrapped in try/catch. Demo mode does not write to the store.

## EventSub client (`js/eventsub.js`)

Shape follows `js/twitch.js`: `connectEventSub({ token, clientId, broadcasterId, moderatorId, onNotification, url, apiBase }, { WebSocketImpl, fetchImpl, setTimer, clearTimer, now })` returns `{ close() }`.

- Connects to `wss://eventsub.wss.twitch.tv/ws` (overridable for the Twitch CLI mock).
- On `session_welcome`: store `keepalive_timeout_seconds`, then POST one subscription to `<apiBase>/eventsub/subscriptions`: `channel.follow` v2, condition `{ broadcaster_user_id: <channel id>, moderator_user_id: <token user id> }`, `transport: { method: "websocket", session_id }`, headers `Client-Id` and `Authorization: Bearer <token>`. A failure (403 when not a moderator) is logged and the socket is closed without reconnecting, since retrying cannot fix it.
- Any message resets the silence timer. No message for `keepalive_timeout_seconds` + 5s: close and reconnect using `backoffDelay` from `twitch.js`.
- `session_reconnect`: open `reconnect_url`; when its `session_welcome` arrives, close the old socket. No new subscription POSTs on a reconnect welcome.
- `notification`: drop if its `metadata.message_id` was seen (bounded set of the last 500 IDs), otherwise pass `payload` to `onNotification`.
- `revocation`: log the subscription type and status.
- Backoff attempt counter resets after a successful welcome.

## IRC USERNOTICE (`js/irc.js`)

`toEvent` gains a `USERNOTICE` case returning `{ type: "usernotice", msgId, login, displayName, communityGiftId }` from tags `msg-id`, `login`, `display-name` (falling back to `login`) and `msg-param-community-gift-id` (empty string when absent). The chat overlay's `onEvent` switch has no case for it, so it is ignored there.

## Event mapping (`js/event-map.js`)

`mapFollow(payload)` for EventSub: `channel.follow` -> `{ box: "follower", name: event.user_name }`, anything else `null`.

`mapUsernotice(ev)` for IRC:

| `msg-id` | Condition | Box | Name |
|---|---|---|---|
| `sub` (paid or Prime) | | subscriber | `displayName` |
| `resub` | | resub | `displayName` |
| `submysterygift` (a gifter gifting several at once) | `login === "ananonymousgifter"` | gifter | `"Anonymous"` |
| `submysterygift` | otherwise | gifter | `displayName` |
| `subgift` | part of a mystery gift (`communityGiftId` set) | ignored (the `submysterygift` already credited the gifter) | |
| `subgift` (a single gift) | `login === "ananonymousgifter"` | gifter | `"Anonymous"` |
| `subgift` | otherwise | gifter | `displayName` |
| `anonsubgift`, `anonsubmysterygift` (legacy IDs) | | gifter | `"Anonymous"` |
| anything else (`raid`, `giftpaidupgrade`, `announcement`, ...) | | ignored | |

Gift recipients never reach New Subscriber: they only appear in `subgift`, which credits the gifter.

Known Twitch limitation: a resub only produces a `USERNOTICE` when the viewer shares it in chat. Resubs that are never announced do not reach the overlay.

`setName` on a box with the name it already shows is a no-op, so repeated notices from the same person do not replay the slide.

## Error handling

The overlay never shows an error on stream. It always renders the boxes with whatever names it has. Problems go to `console`. Status for the streamer is shown on the settings page.

| Problem | Behavior |
|---|---|
| No token / invalid token at startup | Sub, gift and resub boxes live through IRC; follower box shows its saved name; console warning |
| Token expires mid-stream (hourly validate 401) | EventSub closed; IRC continues; names stay |
| Not a moderator (follow subscription 403) | Logged; follower box frozen; other boxes keep working |
| `revocation` | Logged |
| Socket drop or silence (either connection) | Reconnect with backoff |
| `localStorage` unavailable or throwing | Works without persistence |
| Follower seed request fails | Logged; saved name stays |

Names are always set with `textContent`.

## Demo and dev

- `?demo=1` cycles names through all four boxes every few seconds, including 25-character names, so slide and scroll are visible. `?bg=1` adds a light preview background. The settings preview iframe uses both.
- `?eventsub=<ws url>&api=<base url>` point the overlay at the Twitch CLI mock (`twitch event websocket start-server`), for testing follows. Documented in the README.
- Sub, gift and resub handling can be watched live without a token by setting `channel` to any large channel, where these notices arrive every few minutes.

## Testing

Unit tests with `node --test`, no dependencies:

- `eventsub.test.js`: fake WebSocket, injected `fetch` and timers. Welcome triggers the follow POST with correct body and headers; notifications reach the callback; duplicate `message_id` dropped; silence past keepalive triggers reconnect; `session_reconnect` closes the old socket only after the new welcome and does not re-POST; a 403 POST closes without reconnecting.
- `irc.test.js`: `USERNOTICE` lines for sub, resub, subgift, mystery gift and anonymous gift (from Twitch's documented examples) parse into the expected `usernotice` events.
- `event-map.test.js`: `mapFollow`, and every row of the `mapUsernotice` table.
- `auth.test.js`: authorize URL contents, fragment parsing, state mismatch rejected, token fragment written without touching the query.
- `name-store.test.js`: save and restore with a fake storage, keys per channel, throwing storage tolerated.
- `config.test.js`: updated for the schema parameter; events schema defaults and coercion.

Manual check before done:

- Demo mode at 1700x330 in a browser: centering, slide animation, long-name scroll.
- Twitch CLI mock: a follow lands in New Follower.
- A real follow from a second account on lennelen lands in New Follower.
- Pointed at a large channel: subs, resubs and gifts land in the right boxes; a mystery gift shows the gifter once, not once per recipient.
- Reload keeps saved names.
- Chat overlay and its settings page still work after the config and settings refactor.

## README additions

- Events overlay setup: install MoonTime on the streaming PC, register a Twitch app (redirect URLs), set `CLIENT_ID`, connect with a moderator account, copy URL, add a 1700x330 browser source.
- Token note: it's in the URL fragment, never sent to GitHub; re-login when it expires.
- Dev: Twitch CLI mock usage with `?eventsub=` and `?api=`, and the large-channel trick for sub events.
