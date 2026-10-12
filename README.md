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
2. Open the settings page, adjust the look, and click **Copy OBS URL**. In OBS: Sources > + > Browser, paste the URL, Width 1700, Height 330.

Resubs only show up when the viewer shares the resub message in chat. That is how Twitch reports them.

All four boxes come from LennBot (the **Recent events URL** setting, on by default): it records every follow, sub, gift and resub in the channel, even while the overlay is closed. The overlay loads them at startup and asks again every 10 seconds, so the boxes survive a cleared OBS browser cache and need no Twitch login. Subs, gifts and resubs also arrive instantly from chat. A name is replaced only by a newer one. Older OBS URLs that end in `#token=...` still work; that part is ignored.

LennBot receives follows through the `chat-overlay` app in the Twitch developer console, using its client secret (`TWITCH_EVENTS_CLIENT_SECRET` on Railway). Don't delete that app. If you generate a new secret, update it on Railway and restart LennBot. That app's OAuth redirect URLs must keep `https://cydiann.github.io/chat-overlay/events-settings.html`, because LennBot's re-authorize link (logged if Twitch ever refuses the follow subscription) sends the broadcaster there.

## Development

```bash
python3 -m http.server 8000   # ES modules don't load from file://
node --test                   # unit tests, no dependencies
```

- Overlay: http://localhost:8000/?demo=1&bg=1
- Settings: http://localhost:8000/settings.html
- Event boxes: http://localhost:8000/events.html?demo=1&bg=1
- Event boxes settings: http://localhost:8000/events-settings.html
- Sub, gift and resub boxes can be watched live by setting the channel to a big streamer; those notices arrive every few minutes.

Every setting is defined once in `js/schema.js` (`js/events-schema.js` for the event boxes overlay); the overlay's URL parsing and the settings form are both generated from it.
