import { CHANNEL_FIELD, FONTS } from "./schema.js";
import { hexToRgba } from "./color.js";

// Order matters: settings form groups and serialized query order follow it.
export const EVENTS_SCHEMA = [
  CHANNEL_FIELD,

  { key: "tfollow", group: "Titles", type: "text", default: "New Follower", label: "Follower box title" },
  { key: "tsub", group: "Titles", type: "text", default: "New Subscriber", label: "Subscriber box title" },
  { key: "tgift", group: "Titles", type: "text", default: "Recent Gifter", label: "Gifter box title" },
  { key: "tresub", group: "Titles", type: "text", default: "Recent Resub", label: "Resub box title" },
  { key: "titlesize", group: "Titles", type: "number", default: 44, min: 16, max: 96, label: "Title size (px)" },
  { key: "titlecolor", group: "Titles", type: "color", default: "#eef3ff", label: "Title color" },
  { key: "glow", group: "Titles", type: "color", default: "#4f6dff", label: "Neon glow color" },

  { key: "namefont", group: "Names", type: "select", options: Object.keys(FONTS), default: "Quicksand", label: "Username font" },
  { key: "namesize", group: "Names", type: "number", default: 22, min: 10, max: 48, label: "Username size (px)" },
  { key: "namecolor", group: "Names", type: "color", default: "#ffffff", label: "Username color" },

  { key: "boxw", group: "Boxes", type: "number", default: 306, min: 120, max: 600, label: "Box width (px)" },
  { key: "boxh", group: "Boxes", type: "number", default: 60, min: 30, max: 200, label: "Box height (px)" },
  { key: "gap", group: "Boxes", type: "number", default: 66, min: 0, max: 300, label: "Space between boxes (px)" },
  { key: "filla", group: "Boxes", type: "color", default: "#ab97b2", label: "Fill color (left)" },
  { key: "fillb", group: "Boxes", type: "color", default: "#a293cc", label: "Fill color (right)" },
  { key: "bordera", group: "Boxes", type: "color", default: "#a9d3e3", label: "Border color (left)" },
  { key: "borderb", group: "Boxes", type: "color", default: "#efeaf6", label: "Border color (right)" },
  { key: "shadow", group: "Boxes", type: "number", default: 16, min: 0, max: 100, label: "Shadow strength (0-100)" },

  { key: "demo", group: "Demo", type: "bool", default: false, label: "Demo mode (turn off before going live)" },
  { key: "bg", group: "Demo", type: "bool", default: false, label: "Light preview background" },
];

const TITLE_KEYS = { follower: "tfollow", subscriber: "tsub", gifter: "tgift", resub: "tresub" };

export function titleFor(values, box) {
  return values[TITLE_KEYS[box]];
}

export function eventsCssVars(v) {
  return {
    "--title-size": `${v.titlesize}px`,
    "--title-color": v.titlecolor,
    "--glow": v.glow,
    "--name-font": `"${v.namefont}"`,
    "--name-size": `${v.namesize}px`,
    "--name-color": v.namecolor,
    "--box-w": `${v.boxw}px`,
    "--box-h": `${v.boxh}px`,
    "--gap": `${v.gap}px`,
    "--fill-a": v.filla,
    "--fill-b": v.fillb,
    "--border-a": v.bordera,
    "--border-b": v.borderb,
    "--shadow": hexToRgba("#3c285a", v.shadow),
  };
}
