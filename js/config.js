import { SCHEMA } from "./schema.js";
import { isHex, hexToRgba } from "./color.js";

export function defaults() {
  return Object.fromEntries(SCHEMA.map(field => [field.key, field.default]));
}

function coerce(field, raw) {
  const s = String(raw).trim();
  switch (field.type) {
    case "number": {
      const n = Number(s);
      if (s === "" || !Number.isFinite(n) || n < field.min || n > field.max) return field.default;
      return n;
    }
    case "bool":
      if (s === "1" || s === "true") return true;
      if (s === "0" || s === "false") return false;
      return field.default;
    case "color": {
      const c = s.startsWith("#") ? s : `#${s}`;
      return isHex(c) ? c.toLowerCase() : field.default;
    }
    case "select":
      return field.options.includes(s) ? s : field.default;
    default: {
      const v = field.clean ? field.clean(s) : s;
      return field.pattern && !field.pattern.test(v) ? field.default : v;
    }
  }
}

export function normalize(input) {
  const values = defaults();
  for (const field of SCHEMA) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null) values[field.key] = coerce(field, raw);
  }
  return values;
}

export function parseConfig(search) {
  return normalize(Object.fromEntries(new URLSearchParams(search)));
}

export function serializeConfig(values) {
  const params = new URLSearchParams();
  for (const field of SCHEMA) {
    const v = values[field.key];
    if (v === undefined || v === field.default) continue;
    if (field.type === "bool") params.set(field.key, v ? "1" : "0");
    else if (field.type === "color") params.set(field.key, v.replace("#", ""));
    else params.set(field.key, String(v));
  }
  return params.toString();
}

export function cssVars(v) {
  return {
    "--font-msg": `"${v.font}"`,
    "--font-name": `"${v.namefont}"`,
    "--size": `${v.size}px`,
    "--lh": String(v.lh),
    "--text": v.textcolor,
    "--pill-bg": hexToRgba(v.pill, v.pillop),
    "--name-text": v.nametext,
    "--glass-bg": hexToRgba(v.glass, v.glassop),
    "--blur": `${v.blur}px`,
    "--border-a": hexToRgba(v.bordera, v.borderop),
    "--border-b": hexToRgba(v.borderb, v.borderop),
    "--glow": hexToRgba(v.borderb, Math.round(v.borderop * 0.6)),
    "--sheen": hexToRgba("#ffffff", v.sheen),
    "--radius": `${v.radius}px`,
    "--shadow": `${v.shadow}px`,
    "--gap": `${v.gap}px`,
    "--padx": `${v.padx}px`,
    "--pady": `${v.pady}px`,
    "--ornament": v.ornament,
    "--moon": v.mooncolor,
    "--star": v.starcolor,
  };
}
