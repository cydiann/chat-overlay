const USERS = [
  { name: "CometCass", color: "#8fc0ff", role: null },
  { name: "NyxNightly", color: "#ff8ad8", role: "vip" },
  { name: "MoonMoth", color: "#b78cff", role: "moderator" },
  { name: "Lennelen", color: "#f4c97a", role: "broadcaster" },
  { name: "SolsticeSam", color: "#7dd3c0", role: null },
  { name: "OrionByte", color: "#ffb36b", role: null },
];

const LINES = [
  "W streamer W night sky",
  "did anyone catch that shooting star",
  "lol I am moonstruck",
  "the stars are twinkling omg",
  "that riven combo was so clean",
  "gg",
  "how many hours of riven today?",
  "this overlay is so pretty",
];

export function demoMessage(n, emoteNames = []) {
  const user = USERS[n % USERS.length];
  const pick = k => emoteNames[(n * 7 + k) % emoteNames.length];
  let text = LINES[n % LINES.length];
  let emotes = "";
  if (n % 7 === 6 && emoteNames.length) text = [pick(0), pick(1), pick(2)].join(" ");
  else if (n % 3 === 2 && emoteNames.length) text = `${text} ${pick(0)}`;
  else if (n % 4 === 1) {
    text = `Kappa ${text}`;
    emotes = "25:0-4";
  }
  const login = user.name.toLowerCase();
  return {
    type: "message",
    id: `demo-${n}`,
    userId: `demo-${login}`,
    login,
    displayName: user.name,
    color: user.color,
    role: user.role,
    emotes,
    text,
    action: false,
  };
}

export function startDemo(onMessage, getEmoteNames, intervalMs = 2200) {
  let n = 0;
  const tick = () => onMessage(demoMessage(n++, getEmoteNames()));
  tick();
  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer) };
}
