export const PHASES = 8;

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function moonPhase(userId) {
  return fnv1a(String(userId)) % PHASES;
}

// Lit region = semicircle limb on the lit side + elliptical terminator back to the top.
// SVG y points down, so sweep=1 from top to bottom traces the right side.
export function moonPath(phase, r = 10, cx = 12, cy = 12) {
  const angle = (phase / PHASES) * 2 * Math.PI;
  const waxing = phase <= PHASES / 2;
  const gibbous = Math.cos(angle) < 0;
  const rx = +(Math.abs(Math.cos(angle)) * r).toFixed(2);
  const limbSweep = waxing ? 1 : 0;
  const termSweep = gibbous ? limbSweep : 1 - limbSweep;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
}
