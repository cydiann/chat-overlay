import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_ID, SCOPES, authorizeUrl, readHash, tokenFromHash, tokenHash, validateToken, missingScopes,
} from "../js/auth.js";

test("client id and scope", () => {
  assert.equal(CLIENT_ID, "7cc4880z454947qrnfi3z0w493ta4s");
  assert.deepEqual(SCOPES, ["moderator:read:followers"]);
});

test("authorizeUrl asks for an implicit-grant token", () => {
  const url = new URL(authorizeUrl("https://cydiann.github.io/chat-overlay/events-settings.html", "xyz"));
  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "token");
  assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(url.searchParams.get("redirect_uri"), "https://cydiann.github.io/chat-overlay/events-settings.html");
  assert.equal(url.searchParams.get("scope"), "moderator:read:followers");
  assert.equal(url.searchParams.get("state"), "xyz");
});

test("readHash parses the Twitch login callback", () => {
  assert.deepEqual(readHash("#access_token=abc123&scope=moderator%3Aread%3Afollowers&state=xyz&token_type=bearer"), {
    access_token: "abc123", scope: "moderator:read:followers", state: "xyz", token_type: "bearer",
  });
  assert.deepEqual(readHash(""), {});
});

test("tokenFromHash only accepts plain tokens", () => {
  assert.equal(tokenFromHash("#token=abc123"), "abc123");
  assert.equal(tokenFromHash(""), null);
  assert.equal(tokenFromHash("#other=1"), null);
  assert.equal(tokenFromHash("#token=bad%20token"), null);
});

test("tokenHash builds the fragment", () => {
  assert.equal(tokenHash("abc123"), "#token=abc123");
  assert.equal(tokenHash(null), "");
});

test("validateToken returns the token owner", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ login: "cydiann", user_id: "42", scopes: ["moderator:read:followers"], expires_in: 5184000 }) };
  };
  assert.deepEqual(await validateToken("tok", fetchImpl), {
    login: "cydiann", userId: "42", scopes: ["moderator:read:followers"], expiresIn: 5184000,
  });
  assert.equal(seen.url, "https://id.twitch.tv/oauth2/validate");
  assert.equal(seen.init.headers.Authorization, "OAuth tok");
});

test("validateToken returns null for a dead token and throws otherwise", async () => {
  assert.equal(await validateToken("tok", async () => ({ ok: false, status: 401 })), null);
  await assert.rejects(validateToken("tok", async () => ({ ok: false, status: 500 })));
});

test("missingScopes lists what the token lacks", () => {
  assert.deepEqual(missingScopes([]), ["moderator:read:followers"]);
  assert.deepEqual(missingScopes(["moderator:read:followers", "chat:read"]), []);
});
