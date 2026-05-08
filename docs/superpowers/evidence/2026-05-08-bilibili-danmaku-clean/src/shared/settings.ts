// FC-013 — ExtensionSettings persistence (RU-08, CON-007).
//
// Storage rules (FPD-13 + C6 + handoff#code_preflight):
//   - chrome.storage.local ONLY. NEVER chrome.storage.sync.
//   - schemaVersion drives a migration scaffold so future shape changes are
//     non-breaking on first launch.
//   - On first run loadSettings() returns a freshly-built defaults object
//     and writes it back to storage so subsequent reads are deterministic.
//   - saveSettings() emits chrome.storage.onChanged automatically (it's the
//     standard side-effect of chrome.storage.local.set). No manual emit
//     needed.
//   - C6: this module touches the *persistent* settings only. The 60s
//     session-allow store is a separate in-memory module (lands in unit-8).

import type {
  ActionMode,
  CommunityPreset,
  ExtensionSettings,
  ProbationSnapshot,
} from "./types.js";

/** Bumped whenever ExtensionSettings shape changes. */
export const CURRENT_SETTINGS_SCHEMA_VERSION = 1;

/** chrome.storage.local key under which the settings object lives. */
export const SETTINGS_STORAGE_KEY = "settings";

/** Default action mode (CON-002 / FPD-2). NEVER flip to 'hide'. */
const DEFAULT_ACTION_MODE: ActionMode = "collapse";

/** Default OffTopicDetector preset (RU-05). */
const DEFAULT_PRESET_COMMUNITY: CommunityPreset = "general";

/**
 * CON-019 / RU-14 — pre-RU-01.5 default. Once RU-01.5 fills
 * `medalLevelVisibilityRatio`, the runtime may flip mode to
 * 'fans-medal-detector-with-penalty' if ratio < 0.5.
 */
const DEFAULT_PROBATION_SNAPSHOT: ProbationSnapshot = {
  medalLevelVisibilityRatio: null,
  measuredAt: null,
  mode: "skip",
};

/**
 * Build a fresh defaults object. Called on first run and during migration.
 * Returns a brand-new object every call (no shared mutable state).
 */
export function buildDefaultSettings(): ExtensionSettings {
  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    enabled: true,
    actionMode: DEFAULT_ACTION_MODE,
    keywordBlacklist: [],
    keywordWhitelist: [],
    uidBlacklist: [],
    roomWhitelist: [],
    alwaysAllowHashes: [],
    // RU-07 default OFF (DOM-default architecture; WS hook is opt-in).
    enableWsHook: false,
    // CON-020 — toxic detector enabled by default; user may disable.
    toxicDetectorEnabled: true,
    presetCommunity: DEFAULT_PRESET_COMMUNITY,
    probationSnapshot: { ...DEFAULT_PROBATION_SNAPSHOT },
  };
}

/**
 * Migration scaffold. Given a stored object of unknown schema version,
 * upgrade it field-by-field to CURRENT_SETTINGS_SCHEMA_VERSION.
 *
 * The current implementation only handles "no version yet" (first run after
 * upgrade from a hypothetical pre-schema build) by merging defaults. Future
 * schema bumps should add explicit `if (version < N) { ... }` blocks here.
 */
export function migrateSettings(stored: unknown): ExtensionSettings {
  const defaults = buildDefaultSettings();
  if (!stored || typeof stored !== "object") {
    return defaults;
  }

  // Best-effort field-by-field merge. Unknown fields in `stored` are dropped.
  // Missing fields fall back to defaults. Type narrowing is intentionally
  // permissive at this boundary because the persisted blob is `unknown`.
  const partial = stored as Partial<ExtensionSettings> & {
    schemaVersion?: unknown;
  };

  const merged: ExtensionSettings = {
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    enabled: typeof partial.enabled === "boolean" ? partial.enabled : defaults.enabled,
    actionMode: isActionMode(partial.actionMode) ? partial.actionMode : defaults.actionMode,
    keywordBlacklist: isStringArray(partial.keywordBlacklist)
      ? partial.keywordBlacklist
      : defaults.keywordBlacklist,
    keywordWhitelist: isStringArray(partial.keywordWhitelist)
      ? partial.keywordWhitelist
      : defaults.keywordWhitelist,
    uidBlacklist: isStringArray(partial.uidBlacklist)
      ? partial.uidBlacklist
      : defaults.uidBlacklist,
    roomWhitelist: isStringArray(partial.roomWhitelist)
      ? partial.roomWhitelist
      : defaults.roomWhitelist,
    alwaysAllowHashes: Array.isArray(partial.alwaysAllowHashes)
      ? partial.alwaysAllowHashes
      : defaults.alwaysAllowHashes,
    enableWsHook:
      typeof partial.enableWsHook === "boolean" ? partial.enableWsHook : defaults.enableWsHook,
    toxicDetectorEnabled:
      typeof partial.toxicDetectorEnabled === "boolean"
        ? partial.toxicDetectorEnabled
        : defaults.toxicDetectorEnabled,
    presetCommunity: isCommunityPreset(partial.presetCommunity)
      ? partial.presetCommunity
      : defaults.presetCommunity,
    probationSnapshot: isProbationSnapshot(partial.probationSnapshot)
      ? partial.probationSnapshot
      : defaults.probationSnapshot,
  };

  return merged;
}

/**
 * Load settings from chrome.storage.local. On first run (no stored value)
 * builds defaults, writes them back, and returns them.
 *
 * Returns the migrated, fully-populated ExtensionSettings.
 */
export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await readStorageKey(SETTINGS_STORAGE_KEY);

  if (raw === undefined) {
    const defaults = buildDefaultSettings();
    // First-run write so the next read is deterministic.
    await writeStorageKey(SETTINGS_STORAGE_KEY, defaults);
    return defaults;
  }

  const migrated = migrateSettings(raw);

  // If migration changed the shape (i.e. the persisted blob was missing
  // fields), persist the upgraded shape so we don't migrate on every read.
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { schemaVersion?: unknown }).schemaVersion !== CURRENT_SETTINGS_SCHEMA_VERSION
  ) {
    await writeStorageKey(SETTINGS_STORAGE_KEY, migrated);
  }

  return migrated;
}

/**
 * Save a partial patch onto the persisted settings. Loads the current
 * blob, merges, and writes. The chrome.storage API automatically fires
 * `chrome.storage.onChanged` listeners; no extra emit needed.
 *
 * Returns the new merged ExtensionSettings.
 */
export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next: ExtensionSettings = { ...current, ...patch };
  // Always normalize schemaVersion on write.
  next.schemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION;
  await writeStorageKey(SETTINGS_STORAGE_KEY, next);
  return next;
}

/**
 * Subscribe to settings changes. Fires when the persisted `settings` blob
 * is mutated in chrome.storage.local from any context (popup, options,
 * service worker, content script). Returns an unsubscribe function.
 */
export function onSettingsChanged(
  listener: (next: ExtensionSettings, previous: ExtensionSettings | null) => void
): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ): void => {
    // FPD-13 — we listen on local only. Ignore other areas defensively.
    if (areaName !== "local") return;
    const change = changes[SETTINGS_STORAGE_KEY];
    if (!change) return;

    const next = migrateSettings(change.newValue);
    const previous =
      change.oldValue === undefined ? null : migrateSettings(change.oldValue);
    listener(next, previous);
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

// ---------------------------------------------------------------------------
// internal helpers — chrome.storage.local promisified wrappers
// ---------------------------------------------------------------------------

function readStorageKey(key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message ?? "chrome.storage.local.get failed"));
        return;
      }
      resolve(result[key]);
    });
  });
}

function writeStorageKey(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message ?? "chrome.storage.local.set failed"));
        return;
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// internal type guards (defensive — persisted blob is `unknown`)
// ---------------------------------------------------------------------------

function isActionMode(v: unknown): v is ActionMode {
  return v === "collapse" || v === "hide" || v === "fade";
}

function isCommunityPreset(v: unknown): v is CommunityPreset {
  return v === "gaming" || v === "vtuber" || v === "general";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isProbationSnapshot(v: unknown): v is ProbationSnapshot {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  const ratioOk =
    obj["medalLevelVisibilityRatio"] === null ||
    typeof obj["medalLevelVisibilityRatio"] === "number";
  const measuredOk =
    obj["measuredAt"] === null || typeof obj["measuredAt"] === "number";
  const modeOk = obj["mode"] === "skip" || obj["mode"] === "fans-medal-detector-with-penalty";
  return ratioOk && measuredOk && modeOk;
}
