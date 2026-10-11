import { parseConfig, serializeConfig } from "./config.js";

const PREVIEW = { demo: true, bg: true };
const LIVE = { demo: false, bg: false };

function createInput(field, value) {
  if (field.type === "select") {
    const select = document.createElement("select");
    for (const option of field.options) select.append(new Option(option, option, false, option === value));
    return select;
  }
  const input = document.createElement("input");
  if (field.type === "bool") {
    input.type = "checkbox";
    input.checked = value;
  } else if (field.type === "number") {
    input.type = "number";
    input.min = field.min;
    input.max = field.max;
    input.step = field.step ?? 1;
    input.value = value;
  } else {
    input.type = field.type === "color" ? "color" : "text";
    input.value = value;
  }
  return input;
}

function readInput(field, input) {
  if (field.type === "bool") return input.checked;
  if (field.type === "number") {
    const n = input.valueAsNumber;
    return Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.default;
  }
  return input.value;
}

// `fragment()` returns a "#..." suffix that must never go into the query string (the events overlay's token).
export function mountSettings({ schema, overlay, preview: previewPage, fragment = () => "", onChange = () => {} }) {
  const form = document.getElementById("form");
  const preview = document.getElementById("preview");
  const output = document.getElementById("obs-url");
  const copyButton = document.getElementById("copy");
  const values = parseConfig(location.search, schema);

  function liveQuery() {
    return serializeConfig({ ...values, ...LIVE }, schema);
  }

  function obsUrl() {
    const query = liveQuery();
    const base = new URL(overlay, location.href).href;
    return (query ? `${base}?${query}` : base) + fragment();
  }

  function updatePreview() {
    preview.contentWindow?.postMessage({ type: "config", values: { ...values, ...PREVIEW } }, location.origin);
  }

  function update() {
    output.value = obsUrl();
    const query = liveQuery();
    history.replaceState(null, "", (query ? `?${query}` : location.pathname) + fragment());
    updatePreview();
    onChange(values);
  }

  let fieldset = null;
  for (const field of schema) {
    if (field.group === "Demo") continue;
    if (fieldset?.dataset.group !== field.group) {
      fieldset = document.createElement("fieldset");
      fieldset.dataset.group = field.group;
      const legend = document.createElement("legend");
      legend.textContent = field.group;
      fieldset.append(legend);
      form.append(fieldset);
    }
    const label = document.createElement("label");
    label.className = "field";
    const text = document.createElement("span");
    text.textContent = field.label;
    const input = createInput(field, values[field.key]);
    input.addEventListener(field.type === "text" ? "change" : "input", () => {
      values[field.key] = readInput(field, input);
      update();
    });
    label.append(text, input);
    fieldset.append(label);
  }

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(obsUrl());
      copyButton.textContent = "Copied!";
    } catch {
      output.select();
      copyButton.textContent = "Press Ctrl+C";
    }
    setTimeout(() => (copyButton.textContent = "Copy OBS URL"), 1500);
  });

  // Edits made while the preview was still loading would otherwise be lost.
  preview.addEventListener("load", updatePreview);
  preview.src = `${previewPage}?${serializeConfig({ ...values, ...PREVIEW }, schema)}`;
  output.value = obsUrl();
  return { values, update };
}
