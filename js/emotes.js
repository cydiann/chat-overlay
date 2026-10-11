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
