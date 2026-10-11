// LennBot records the latest sub, gifter and resub so the boxes survive a cleared cache
// (Twitch has no history API for them). The follower box recovers from Helix instead.
const HISTORY_BOXES = ["subscriber", "gifter", "resub"];

export function mergeHistory(cached, remote) {
  const updates = [];
  for (const box of HISTORY_BOXES) {
    const entry = remote?.[box];
    const at = Date.parse(entry?.updated_at);
    if (typeof entry?.name !== "string" || !entry.name || !Number.isFinite(at)) continue;
    if (at > (cached?.[box]?.at ?? 0)) updates.push({ box, name: entry.name, at });
  }
  return updates;
}

export async function fetchHistory(url, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Event history request failed with HTTP ${res.status}`);
  return res.json();
}
