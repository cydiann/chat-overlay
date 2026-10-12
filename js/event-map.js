export const BOXES = ["follower", "subscriber", "gifter", "resub"];
export const ANON_LOGIN = "ananonymousgifter";

function gifterName(ev) {
  return ev.login === ANON_LOGIN ? "Anonymous" : ev.displayName;
}

function gifter(ev) {
  // A mystery gift sends one submysterygift and then a subgift per recipient tagged with the same
  // community gift id; only the submysterygift should credit the gifter.
  if (ev.communityGiftId) return null;
  return { box: "gifter", name: gifterName(ev) };
}

export function mapUsernotice(ev) {
  if (ev?.type !== "usernotice") return null;
  switch (ev.msgId) {
    case "sub":
      return { box: "subscriber", name: ev.displayName };
    case "resub":
      return { box: "resub", name: ev.displayName };
    case "submysterygift":
      // The mystery gift notice itself carries the community gift id, so unlike subgift it
      // always credits the gifter here.
      return { box: "gifter", name: gifterName(ev) };
    case "subgift":
      return gifter(ev);
    case "anonsubgift":
      return ev.communityGiftId ? null : { box: "gifter", name: "Anonymous" };
    case "anonsubmysterygift":
      return { box: "gifter", name: "Anonymous" };
    default:
      return null;
  }
}
