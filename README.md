# Celestial Chat Overlay

Twitch chat as celestial frosted-glass bubbles, for an OBS browser source. Shows Twitch, 7TV, BTTV and FFZ emotes. No login, no server: it reads chat anonymously.

- Overlay: https://cydiann.github.io/chat-overlay/
- Settings with live preview: https://cydiann.github.io/chat-overlay/settings.html

## OBS setup

1. Open the settings page, tweak the look, click **Copy OBS URL**.
2. In OBS: Sources > + > Browser. Paste the URL. Width 440, Height 760 (or whatever fits your layout).
3. Leave "Shutdown source when not visible" off so chat keeps flowing.
4. To change settings later, open `settings.html?<the query part of your OBS URL>`, adjust, copy again.

The glass blur only blurs the overlay's own content (the stars), not the game behind the browser source, so in OBS the glass reads as a tint at the glass opacity. Raise Glass opacity if it looks too faint.

New 7TV emotes added mid-stream show up after you refresh the browser source.

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

## Development

```bash
python3 -m http.server 8000   # ES modules don't load from file://
node --test                   # unit tests, no dependencies
```

- Overlay: http://localhost:8000/?demo=1&bg=1
- Settings: http://localhost:8000/settings.html
- Event boxes: http://localhost:8000/events.html?demo=1&bg=1
- Event boxes settings: http://localhost:8000/events-settings.html
- Sub, gift and resub boxes can be watched without a login by setting the channel to a big streamer; those notices arrive every few minutes.
- Follows without waiting for real ones: run the Twitch CLI mock (`nix shell nixpkgs#twitch-cli -c twitch event websocket start-server`), then load `events.html?eventsub=ws://127.0.0.1:8080/ws&api=http://127.0.0.1:8080#token=<your token>` and fire `twitch event trigger channel.follow --transport=websocket`. The token is still validated against Twitch, so use a real one from the settings page.

Every setting is defined once in `js/schema.js` (`js/events-schema.js` for the event boxes overlay); the overlay's URL parsing and the settings form are both generated from it.
