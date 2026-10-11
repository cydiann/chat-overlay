export const CLIENT_ID = "7cc4880z454947qrnfi3z0w493ta4s";
export const SCOPES = ["moderator:read:followers"];

export function authorizeUrl(redirectUri, state) {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export function readHash(hash) {
  return Object.fromEntries(new URLSearchParams(hash.replace(/^#/, "")));
}

export function tokenFromHash(hash) {
  const token = readHash(hash).token;
  return token && /^[a-z0-9]+$/i.test(token) ? token : null;
}

// The token lives in the fragment because browsers never send fragments to the server.
export function tokenHash(token) {
  return token ? `#token=${token}` : "";
}

export async function validateToken(token, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const res = await fetchImpl("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Token validation failed: ${res.status}`);
  const body = await res.json();
  return { login: body.login, userId: body.user_id, scopes: body.scopes ?? [], expiresIn: body.expires_in };
}

export function missingScopes(scopes) {
  return SCOPES.filter(scope => !scopes.includes(scope));
}
