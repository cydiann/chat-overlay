export const API_BASE = "https://api.twitch.tv/helix";

async function get(path, { token, clientId, fetchImpl = (...args) => globalThis.fetch(...args) }) {
  const res = await fetchImpl(`${API_BASE}${path}`, { headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = new Error(`Twitch API ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function getUserId(login, opts) {
  const { data } = await get(`/users?login=${encodeURIComponent(login)}`, opts);
  if (!data?.length) throw new Error(`Twitch user ${login} not found`);
  return data[0].id;
}

// Without moderator access Twitch still answers 200 with the total but an empty list.
export async function getFollowers(broadcasterId, opts) {
  const { total = 0, data = [] } = await get(`/channels/followers?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=1`, opts);
  return { total, name: data[0]?.user_name ?? null };
}
