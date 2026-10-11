export const BOXES = ["follower", "subscriber", "gifter", "resub"];
export const ANON_LOGIN = "ananonymousgifter";

export function mapFollow(payload) {
  const name = payload?.event?.user_name;
  return payload?.subscription?.type === "channel.follow" && name ? { box: "follower", name } : null;
}

function gifter(ev) {
  // A mystery gift sends one submysterygift and then a subgift per recipient tagged with the same
  // community gift id; only the submysterygift should credit the gifter.
  if (ev.communityGiftId) return null;
  return { box: "gifter", name: ev.login === ANON_LOGIN ? "Anonymous" : ev.displayName };
}

export function mapUsernotice(ev) {
  if (ev?.type !== "usernotice") return null;
  switch (ev.msgId) {
    case "sub":
      return { box: "subscriber", name: ev.displayName };
    case "resub":
      return { box: "resub", name: ev.displayName };
    case "submysterygift":
      return { box: "gifter", name: ev.login === ANON_LOGIN ? "Anonymous" : ev.displayName };
    case "subgift":
      return gifter(ev);
    case "anonsubgift":
    case "anonsubmysterygift":
      return ev.communityGiftId ? null : { box: "gifter", name: "Anonymous" };
    default:
      return null;
  }
}
