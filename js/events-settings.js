import { mountSettings } from "./settings-form.js";
import { EVENTS_SCHEMA } from "./events-schema.js";

const OVERLAY_WIDTH = 1700;

const stage = document.querySelector(".stage");

const settings = mountSettings({
  schema: EVENTS_SCHEMA,
  overlay: "events.html",
  preview: "events.html",
});
settings.update();

// The preview renders at the real 1700x330 OBS size and is scaled down to fit.
new ResizeObserver(() => stage.style.setProperty("--scale", stage.clientWidth / OVERLAY_WIDTH)).observe(stage);
