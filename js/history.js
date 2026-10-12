// LennBot records the latest follower, sub, gifter and resub, so the boxes survive a cleared
// cache and the follower box needs no Twitch login here.
const HISTORY_BOXES = ["follower", "subscriber", "gifter", "resub"];

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

// Polling every few seconds would otherwise log the same failure over and over while LennBot
// restarts; this logs the first failure and stays quiet until a request works again.
export function createWarnOnce(log) {
  let armed = true;
  return {
    fail(err) {
      if (!armed) return;
      armed = false;
      log(err);
    },
    ok() {
      armed = true;
    },
  };
}
