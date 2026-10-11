const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(value) {
  return HEX.test(value);
}

function channels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex, opacityPct) {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${+(opacityPct / 100).toFixed(3)})`;
}

export function mixWithWhite(hex, pct) {
  const toHex = c => Math.round(c + ((255 - c) * pct) / 100).toString(16).padStart(2, "0");
  return "#" + channels(hex).map(toHex).join("");
}
