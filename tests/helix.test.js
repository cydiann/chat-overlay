import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserId, getFollowers } from "../js/helix.js";

function fakeFetch(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, opts: { token: "tok", clientId: "cid", fetchImpl } };
}

test("getUserId resolves a login with auth headers", async () => {
  const { calls, opts } = fakeFetch(200, { data: [{ id: "659811388", login: "lennelen" }] });
  assert.equal(await getUserId("lennelen", opts), "659811388");
  assert.equal(calls[0].url, "https://api.twitch.tv/helix/users?login=lennelen");
  assert.deepEqual(calls[0].init.headers, { "Client-Id": "cid", Authorization: "Bearer tok" });
});

test("getUserId throws for unknown users and HTTP errors", async () => {
  await assert.rejects(getUserId("nobody", fakeFetch(200, { data: [] }).opts));
  await assert.rejects(getUserId("lennelen", fakeFetch(401, {}).opts), err => err.status === 401);
});

test("getFollowers returns the total and newest follower", async () => {
  const { calls, opts } = fakeFetch(200, { total: 120, data: [{ user_name: "MoonlitMara" }] });
  assert.deepEqual(await getFollowers("659811388", opts), { total: 120, name: "MoonlitMara" });
  assert.equal(calls[0].url, "https://api.twitch.tv/helix/channels/followers?broadcaster_id=659811388&first=1");
});

test("getFollowers without moderator access reports no name", async () => {
  assert.deepEqual(await getFollowers("1", fakeFetch(200, { total: 120, data: [] }).opts), { total: 120, name: null });
});
