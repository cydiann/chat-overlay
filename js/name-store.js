// Reading localStorage itself throws in some sandboxed contexts, not just its methods.
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Entries are stored as JSON {name, at}. Anything else is a bare name saved before
// timestamps existed, which counts as older than any recorded event.
function parseEntry(raw) {
  try {
    const v = JSON.parse(raw);
    if (typeof v?.name === "string" && Number.isFinite(v.at)) return { name: v.name, at: v.at };
  } catch {
    // Not JSON, so a bare name.
  }
  return { name: raw, at: 0 };
}

export function createNameStore(channel, storage = defaultStorage()) {
  const key = box => `event-boxes:${channel}:${box}`;
  return {
    load(box) {
      try {
        const raw = storage?.getItem(key(box)) ?? null;
        return raw === null ? null : parseEntry(raw);
      } catch {
        return null;
      }
    },
    save(box, name, at = Date.now()) {
      try {
        storage?.setItem(key(box), JSON.stringify({ name, at }));
      } catch {
        // Persistence is a nicety; the box still shows the name.
      }
    },
  };
}
