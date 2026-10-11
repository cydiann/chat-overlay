// Reading localStorage itself throws in some sandboxed contexts, not just its methods.
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createNameStore(channel, storage = defaultStorage()) {
  const key = box => `event-boxes:${channel}:${box}`;
  return {
    load(box) {
      try {
        return storage?.getItem(key(box)) ?? null;
      } catch {
        return null;
      }
    },
    save(box, name) {
      try {
        storage?.setItem(key(box), name);
      } catch {
        // Persistence is a nicety; the box still shows the name.
      }
    },
  };
}
