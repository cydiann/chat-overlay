import { BOXES } from "./event-map.js";

const NAMES = [
  "moonlitmara",
  "xX_StarGazer_Xx",
  "nova",
  "celestialcat42",
  "TheVeryLongestNameOnTwitc",
  "CometCass",
  "xX_StarGazerSupreme_2009X",
  "NyxNightly",
];

export function demoUpdate(n) {
  return { box: BOXES[n % BOXES.length], name: NAMES[(n * 3) % NAMES.length] };
}

export function startEventsDemo(onUpdate, intervalMs = 1500) {
  let n = 0;
  for (; n < BOXES.length; n++) onUpdate(demoUpdate(n));
  const timer = setInterval(() => onUpdate(demoUpdate(n++)), intervalMs);
  return { stop: () => clearInterval(timer) };
}
