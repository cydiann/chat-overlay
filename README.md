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

## Development

```bash
python3 -m http.server 8000   # ES modules don't load from file://
node --test                   # unit tests, no dependencies
```

- Overlay: http://localhost:8000/?demo=1&bg=1
- Settings: http://localhost:8000/settings.html

Every setting is defined once in `js/schema.js`; the overlay's URL parsing and the settings form are both generated from it.
