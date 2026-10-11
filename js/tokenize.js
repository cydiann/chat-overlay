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
