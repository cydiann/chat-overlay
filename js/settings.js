import { SCHEMA } from "./schema.js";
import { mountSettings } from "./settings-form.js";

mountSettings({ schema: SCHEMA, overlay: "./", preview: "index.html" });
