// FC-013 — settings round-trip and migration.
//
// Mocks chrome.storage.local in-memory so `loadSettings` / `saveSettings` /
// `onSettingsChanged` can be exercised under vitest. The mock mirrors
// chrome's MV3 callback-API surface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  buildDefaultSettings,
  loadSettings,
  migrateSettings,
  onSettingsChanged,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "../../src/shared/settings.js";

// ---------------------------------------------------------------------------
// in-memory chrome.storage.local mock
// ---------------------------------------------------------------------------

interface ChangeListener {
  (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ): void;
}

function installChromeMock(): {
  store: Map<string, unknown>;
  listeners: Set<ChangeListener>;
} {
  const store = new Map<string, unknown>();
  const listeners = new Set<ChangeListener>();

  const localGet = (
    keys: string[],
    cb: (result: Record<string, unknown>) => void
  ): void => {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (store.has(k)) out[k] = store.get(k);
    }
    queueMicrotask(() => cb(out));
  };

  const localSet = (
    items: Record<string, unknown>,
    cb?: () => void
  ): void => {
    const changes: { [key: string]: chrome.storage.StorageChange } = {};
    for (const [k, newValue] of Object.entries(items)) {
      const oldValue = store.get(k);
      changes[k] = { oldValue, newValue };
      store.set(k, newValue);
    }
    queueMicrotask(() => {
      for (const l of listeners) l(changes, "local");
      cb?.();
    });
  };

  const fakeChrome = {
    runtime: { lastError: undefined as { message: string } | undefined },
    storage: {
      local: { get: localGet, set: localSet },
      onChanged: {
        addListener: (l: ChangeListener) => listeners.add(l),
        removeListener: (l: ChangeListener) => listeners.delete(l),
      },
    },
  };

  // @ts-expect-error — install minimal subset onto globalThis for tests.
  globalThis.chrome = fakeChrome;
  return { store, listeners };
}

describe("shared/settings — FC-013 round-trip", () => {
  let mock: ReturnType<typeof installChromeMock>;

  beforeEach(() => {
    mock = installChromeMock();
  });

  afterEach(() => {
    // @ts-expect-error — cleanup
    delete globalThis.chrome;
  });

  it("loadSettings returns defaults on first run and persists them", async () => {
    expect(mock.store.has(SETTINGS_STORAGE_KEY)).toBe(false);
    const s = await loadSettings();
    expect(s.actionMode).toBe("collapse"); // FPD-2 default
    expect(s.enabled).toBe(true);
    expect(s.toxicDetectorEnabled).toBe(true); // CON-020 default-on
    expect(s.enableWsHook).toBe(false); // RU-07 default-off
    expect(s.probationSnapshot.mode).toBe("skip"); // CON-019 pre-RU-01.5 default
    // First-run write happened.
    expect(mock.store.has(SETTINGS_STORAGE_KEY)).toBe(true);
    const stored = mock.store.get(SETTINGS_STORAGE_KEY) as { schemaVersion?: number };
    expect(stored.schemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION);
  });

  it("saveSettings merges patch and emits chrome.storage.onChanged", async () => {
    await loadSettings(); // seed defaults
    const observed: Array<{ enabled: boolean; actionMode: string }> = [];
    const unsub = onSettingsChanged((next) => {
      observed.push({ enabled: next.enabled, actionMode: next.actionMode });
    });

    const next = await saveSettings({ actionMode: "fade", enabled: false });
    expect(next.actionMode).toBe("fade");
    expect(next.enabled).toBe(false);

    // Listener fires after microtask drain.
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(observed.length).toBeGreaterThan(0);
    const last = observed[observed.length - 1];
    expect(last).toBeDefined();
    expect(last?.actionMode).toBe("fade");
    expect(last?.enabled).toBe(false);

    unsub();
  });

  it("saveSettings preserves untouched fields", async () => {
    await loadSettings();
    await saveSettings({ keywordBlacklist: ["spam-1", "spam-2"] });
    const after = await loadSettings();
    expect(after.keywordBlacklist).toEqual(["spam-1", "spam-2"]);
    // Untouched.
    expect(after.actionMode).toBe("collapse");
    expect(after.toxicDetectorEnabled).toBe(true);
  });

  it("migrateSettings fills missing fields from defaults", () => {
    const partial = { enabled: false, actionMode: "hide" } as unknown;
    const migrated = migrateSettings(partial);
    expect(migrated.enabled).toBe(false);
    expect(migrated.actionMode).toBe("hide");
    // Missing fields populated.
    expect(migrated.keywordBlacklist).toEqual([]);
    expect(migrated.probationSnapshot.mode).toBe("skip");
    expect(migrated.schemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION);
  });

  it("migrateSettings rejects unknown actionMode and falls back", () => {
    const partial = { actionMode: "delete-everything" } as unknown;
    const migrated = migrateSettings(partial);
    expect(migrated.actionMode).toBe("collapse"); // FPD-2 default fallback
  });

  it("buildDefaultSettings returns a fresh object each call", () => {
    const a = buildDefaultSettings();
    const b = buildDefaultSettings();
    expect(a).not.toBe(b);
    expect(a.probationSnapshot).not.toBe(b.probationSnapshot);
    a.keywordBlacklist.push("mutated");
    expect(b.keywordBlacklist).toEqual([]);
  });
});

describe("shared/settings — listener cleanup", () => {
  beforeEach(() => installChromeMock());
  afterEach(() => {
    // @ts-expect-error — remove the chrome stub installed in beforeEach
    delete globalThis.chrome;
  });

  it("onSettingsChanged returns an unsubscribe that detaches the listener", async () => {
    const calls = vi.fn();
    const unsub = onSettingsChanged(calls);
    await saveSettings({ enabled: false });
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(calls.mock.calls.length).toBeGreaterThan(0);

    const before = calls.mock.calls.length;
    unsub();
    await saveSettings({ enabled: true });
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(calls.mock.calls.length).toBe(before);
  });
});
