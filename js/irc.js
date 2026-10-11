const TAG_ESCAPES = { ":": ";", s: " ", "\\": "\\", r: "\r", n: "\n" };

export function unescapeTag(value) {
  return value.replace(/\\(.?)/g, (_, c) => (c in TAG_ESCAPES ? TAG_ESCAPES[c] : c));
}

export function parseLine(line) {
  const msg = { tags: {}, prefix: null, command: "", params: [] };
  let rest = line;

  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ");
    for (const pair of rest.slice(1, space).split(";")) {
      const eq = pair.indexOf("=");
      if (eq === -1) msg.tags[pair] = "";
      else msg.tags[pair.slice(0, eq)] = unescapeTag(pair.slice(eq + 1));
    }
    rest = rest.slice(space + 1);
  }

  if (rest.startsWith(":")) {
    const space = rest.indexOf(" ");
    msg.prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  let trailing = null;
  const trailingAt = rest.indexOf(" :");
  if (trailingAt !== -1) {
    trailing = rest.slice(trailingAt + 2);
    rest = rest.slice(0, trailingAt);
  }

  const parts = rest.split(" ").filter(Boolean);
  msg.command = parts.shift() ?? "";
  msg.params = parts;
  if (trailing !== null) msg.params.push(trailing);
  return msg;
}

const ROLES = ["broadcaster", "moderator", "vip"];

export function roleFromBadges(badges = "") {
  const names = new Set(badges.split(",").map(b => b.split("/")[0]).filter(Boolean));
  return ROLES.find(role => names.has(role)) ?? null;
}

const ACTION = /^\u0001ACTION (.*)\u0001$/;

export function toEvent(msg) {
  const { tags, command, params } = msg;
  switch (command) {
    case "PRIVMSG": {
      const raw = params[1] ?? "";
      const action = ACTION.exec(raw);
      const login = (msg.prefix ?? "").split("!")[0];
      return {
        type: "message",
        id: tags.id ?? "",
        userId: tags["user-id"] ?? "",
        login,
        displayName: tags["display-name"] || login,
        color: tags.color || null,
        role: roleFromBadges(tags.badges),
        emotes: tags.emotes ?? "",
        text: action ? action[1] : raw,
        action: Boolean(action),
      };
    }
    case "CLEARMSG":
      return { type: "clearmsg", targetId: tags["target-msg-id"] ?? "" };
    case "CLEARCHAT":
      return params[1]
        ? { type: "clearuser", userId: tags["target-user-id"] ?? "", login: params[1] }
        : { type: "clearall" };
    case "ROOMSTATE":
      return { type: "roomstate", roomId: tags["room-id"] ?? "" };
    case "PING":
      return { type: "ping", payload: params[0] ?? "" };
    case "RECONNECT":
      return { type: "reconnect" };
    default:
      return null;
  }
}
