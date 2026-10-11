// Google Fonts families offered in the settings dropdowns, with the weights to request.
// Marcellus only ships 400; requesting a missing weight makes Google Fonts return an error.
export const FONTS = {
  Urbanist: "400;600;700",
  Quicksand: "400;600;700",
  Nunito: "400;600;700",
  Poppins: "400;600;700",
  Marcellus: "400",
  Cinzel: "400;600;700",
  "Cormorant Garamond": "400;600;700",
};

const fontOptions = Object.keys(FONTS);

// Accepts pasted "#name", "@name" and channel URLs. The pattern also keeps anything else out of the IRC JOIN line.
const channelName = s => s.replace(/\/+$/, "").replace(/^.*\//, "").replace(/^[#@]/, "").toLowerCase();

// Order matters: settings form groups and serialized query order follow it.
export const SCHEMA = [
  { key: "channel", group: "Behavior", type: "text", default: "lennelen", clean: channelName, pattern: /^[a-z0-9_]{1,25}$/, label: "Twitch channel" },
  { key: "fade", group: "Behavior", type: "number", default: 30, min: 0, max: 600, label: "Fade after (seconds, 0 = never)" },
  { key: "max", group: "Behavior", type: "number", default: 8, min: 1, max: 50, label: "Max messages on screen" },
  { key: "hide", group: "Behavior", type: "text", default: "", label: "Hidden users (comma separated)" },
  { key: "hidecmd", group: "Behavior", type: "bool", default: false, label: "Hide !commands" },

  { key: "font", group: "Text", type: "select", options: fontOptions, default: "Urbanist", label: "Message font" },
  { key: "namefont", group: "Text", type: "select", options: fontOptions, default: "Marcellus", label: "Username font" },
  { key: "size", group: "Text", type: "number", default: 14, min: 8, max: 64, label: "Text size (px)" },
  { key: "lh", group: "Text", type: "number", default: 1.5, min: 1, max: 3, step: 0.1, label: "Line spacing" },
  { key: "textcolor", group: "Text", type: "color", default: "#e9edff", label: "Message text color" },

  { key: "pill", group: "Pill", type: "color", default: "#c3b2f5", label: "Username pill color" },
  { key: "pillop", group: "Pill", type: "number", default: 40, min: 0, max: 100, label: "Pill opacity (0-100)" },
  { key: "nametext", group: "Pill", type: "color", default: "#fefefe", label: "Username text color" },
  { key: "namecolor", group: "Pill", type: "bool", default: false, label: "Tint pill with Twitch name color" },

  { key: "glass", group: "Glass", type: "color", default: "#121a38", label: "Glass tint" },
  { key: "glassop", group: "Glass", type: "number", default: 50, min: 0, max: 100, label: "Glass opacity (0-100)" },
  { key: "blur", group: "Glass", type: "number", default: 12, min: 0, max: 40, label: "Glass blur (px)" },
  { key: "bordera", group: "Glass", type: "color", default: "#a9b7e8", label: "Border color A (moonlight silver)" },
  { key: "borderb", group: "Glass", type: "color", default: "#b78cff", label: "Border color B (aurora violet)" },
  { key: "borderop", group: "Glass", type: "number", default: 55, min: 0, max: 100, label: "Border strength (0-100)" },
  { key: "sheen", group: "Glass", type: "number", default: 12, min: 0, max: 100, label: "Moonlight sheen (0-100)" },

  { key: "radius", group: "Shape", type: "number", default: 16, min: 0, max: 40, label: "Corner roundness (px)" },
  { key: "shadow", group: "Shape", type: "number", default: 25, min: 0, max: 80, label: "Shadow softness (px)" },
  { key: "gap", group: "Shape", type: "number", default: 20, min: 0, max: 60, label: "Message spacing (px)" },
  { key: "padx", group: "Shape", type: "number", default: 16, min: 0, max: 48, label: "Horizontal padding (px)" },
  { key: "pady", group: "Shape", type: "number", default: 10, min: 0, max: 32, label: "Vertical padding (px)" },

  { key: "ornament", group: "Ornaments", type: "color", default: "#c9b6ff", label: "Constellation and ornament color" },
  { key: "mooncolor", group: "Ornaments", type: "color", default: "#f4eddc", label: "Username moon icon color" },

  { key: "moons", group: "Effects", type: "bool", default: true, label: "Personal moon phases" },
  { key: "sparkles", group: "Effects", type: "bool", default: true, label: "Sparkle pops and particles" },
  { key: "constellation", group: "Effects", type: "bool", default: true, label: "Constellation lines between messages" },
  { key: "stars", group: "Effects", type: "bool", default: true, label: "Ambient starfield" },
  { key: "starcount", group: "Effects", type: "number", default: 70, min: 0, max: 200, label: "Star count (0-200)" },
  { key: "starcolor", group: "Effects", type: "color", default: "#ffffff", label: "Star color" },
  { key: "shooting", group: "Effects", type: "bool", default: true, label: "Random shooting stars" },

  { key: "demo", group: "Demo", type: "bool", default: false, label: "Demo mode (turn off before going live)" },
  { key: "bg", group: "Demo", type: "bool", default: false, label: "Night sky preview background" },
];
