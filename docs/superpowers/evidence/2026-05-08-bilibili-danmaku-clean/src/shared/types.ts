// Shared type contracts for the Bilibili Danmaku Denoiser.
//
// These types are FROZEN by ledger CONs and the H-Review preserved
// conditions C5/C6. Do not "tighten" them with `?:` optional syntax —
// the C5 rule is explicit: nullable fields use `T | null`, never the
// optional-property form.
//
// Sources:
//   CON-013: NormalizedDanmakuRecord field set
//   CON-014: NoiseVerdict shape
//   CON-016: NoiseVerdict.category as string[] + primaryCategory ladder
//   CON-007: ExtensionSettings persistence keys
//   CON-011 + RU-09: DenoisedSessionLog
//   CON-018: FloodWindowEntry hard caps
//   CON-019: ProbationSnapshot empirical-fill
//   RU-03: SelectorRegistryEntry (4 playback modes + replay)
//   C5: nullable fields MUST use `T | null` (never `?: T`)
//   C6: session-allow vs persistent-allow are TWO separate stores
//
// All callers (RU-02..RU-09 + RU-15) consume from this module.

// ---------------------------------------------------------------------------
// CON-013 — NormalizedDanmakuRecord
// ---------------------------------------------------------------------------

/**
 * The role bucket parsed off the danmaku DOM node.
 *
 * - `null` means the field is *missing* (DOM did not expose it). PROBATION-eligible.
 * - `'unknown'` means the field is *present but unrecognized* (RU-14 tracks these).
 * - The other variants are the five hard-whitelist roles plus the fans-medal-only
 *   marker used by CON-019 fans-medal-detector-with-penalty branch.
 */
export type DanmakuRole =
  | "streamer"
  | "moderator"
  | "guard"
  | "sc"
  | "gift"
  | "fans-medal-only"
  | "unknown"
  | null;

/**
 * Layer that produced this record. CON-013.
 * - `'dom'`: MutationObserver path (default).
 * - `'ws'`: page-world WebSocket hook (RU-07, opt-in).
 */
export type SourceLayer = "dom" | "ws";

/**
 * CON-013 + C5: the canonical record threaded through the classifier pipeline.
 *
 * Phase 1 (record-construction) sets every field. `normalizedText === rawText`
 * after Phase 1. Phase 2 (text-normalization, CON-017) mutates only
 * `normalizedText`; raw fields are immutable thereafter.
 *
 * C5: medalLevel, guardLevel, role, uid all use `T | null`. NEVER `?: T`.
 */
export interface NormalizedDanmakuRecord {
  /** Verbatim original text from the danmaku DOM node or WS frame. */
  rawText: string;
  /** Phase-2 normalized text (CON-017). Equals rawText pre-Phase-2. */
  normalizedText: string;
  /** Bilibili user id; `null` when DOM does not expose it. */
  uid: string | null;
  /** Parsed role bucket. `null` = field missing (PROBATION via RU-14). */
  role: DanmakuRole;
  /** Fans-medal level. `null` = field missing; `0` = present-and-zero. */
  medalLevel: number | null;
  /** Guard level (0..3). `null` = field missing; `0` = no guard. */
  guardLevel: number | null;
  /**
   * `true` only when DOM ancestor confirmation is present
   * (.super-chat-message OR .gift-bubble parent). Per CON-022, a single
   * fans-medal class never sets this to `true`.
   */
  isPaid: boolean;
  /** Date.now() at record construction. */
  ts: number;
  /** Layer that produced this record. CON-013. */
  sourceLayer: SourceLayer;
}

// ---------------------------------------------------------------------------
// CON-014 + CON-016 — NoiseVerdict
// ---------------------------------------------------------------------------

/**
 * The five noise categories. CON-001 + CON-016. Order in this union does not
 * imply priority; the ladder is encoded in `PRIMARY_CATEGORY_LADDER` below.
 */
export type NoiseCategory = "toxic" | "ad" | "flood" | "lowinfo" | "offtopic";

/**
 * CON-016 priority ladder: toxic > ad > flood > lowinfo > offtopic.
 * Used by RU-05's classifier orchestrator to resolve `primaryCategory`
 * from the multi-label `category[]` (FPD-9).
 *
 * Lower index = higher priority.
 */
export const PRIMARY_CATEGORY_LADDER: ReadonlyArray<NoiseCategory> = [
  "toxic",
  "ad",
  "flood",
  "lowinfo",
  "offtopic",
] as const;

/**
 * CON-014 + CON-016: classifier output.
 *
 * Invariants (locked by CON-014/016 + FPD-3):
 *   - verdict='PASS'  => category=[] AND primaryCategory=null
 *   - verdict='NOISE' => category.length >= 1 AND primaryCategory is the
 *                        highest-priority element of category per the ladder
 *   - WhitelistEngine match returns verdict='PASS' regardless of detectors.
 */
export interface NoiseVerdict {
  verdict: "PASS" | "NOISE";
  /** Multi-label categories. CON-016. Empty array iff verdict='PASS'. */
  category: NoiseCategory[];
  /**
   * Highest-priority category per CON-016 ladder.
   * `null` iff verdict='PASS'.
   */
  primaryCategory: NoiseCategory | null;
  /** Confidence score in [0, 1]. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// CON-007 — ExtensionSettings
// ---------------------------------------------------------------------------

/**
 * The three user-selectable action modes. CON-002.
 * Default is `'collapse'` (FPD-2). NEVER flip the default to `'hide'`.
 */
export type ActionMode = "collapse" | "hide" | "fade";

/** CON-021: a single Always-allow entry persisted in chrome.storage.local. */
export interface AlwaysAllowEntry {
  /** Hash of the normalized record (FNV-1a or xxhash; coder choice). */
  hash: string;
  /** Date.now() when the user added this entry. */
  addedTs: number;
  /** addedTs + 7 days; entry is auto-evicted past this point (CON-021). */
  decayTs: number;
  /** The category this entry was originally classified as. */
  category: NoiseCategory;
}

/** Community preset for OffTopicDetector (RU-05, ACC-006 item 8). */
export type CommunityPreset = "gaming" | "vtuber" | "general";

/**
 * CON-019 — RU-14 PROBATION runtime branch state.
 *
 * Filled during the RU-01.5 first-session empirical fill. If
 * `medalLevelVisibilityRatio < 0.5`, the planner switches `mode` to
 * `'fans-medal-detector-with-penalty'` (CON-019 / C1).
 *
 * `null` measurement values mean "not yet measured" — the default branch
 * is `'skip'` until RU-01.5 completes.
 */
export interface ProbationSnapshot {
  /** Ratio in [0, 1]; `null` = not yet measured. */
  medalLevelVisibilityRatio: number | null;
  /** Date.now() of measurement; `null` = not yet measured. */
  measuredAt: number | null;
  /** Active branch behavior. CON-019. */
  mode: "skip" | "fans-medal-detector-with-penalty";
}

/**
 * CON-007 — user configuration persisted in chrome.storage.local (RU-08).
 *
 * Storage rules (FPD-13 + C6):
 *   - chrome.storage.local ONLY. NEVER chrome.storage.sync.
 *   - The session-allow store (60s in-memory, scoped to current room) is
 *     SEPARATE from `alwaysAllowHashes` (persistent). Two stores per C6.
 *   - `schemaVersion` drives the migration scaffold in `settings.ts`.
 */
export interface ExtensionSettings {
  /** Schema version for forward-compat migration. */
  schemaVersion: number;
  /** Master enable switch (popup quick toggle). */
  enabled: boolean;
  /** Action mode for suppressed records. CON-002. Default `'collapse'`. */
  actionMode: ActionMode;
  /** User keyword blacklist. */
  keywordBlacklist: string[];
  /** User keyword whitelist (never-suppress). */
  keywordWhitelist: string[];
  /** UID blacklist. */
  uidBlacklist: string[];
  /** Room ids in which the denoiser is fully disabled. */
  roomWhitelist: string[];
  /** CON-021 — persistent (7-day decay) Always-allow. */
  alwaysAllowHashes: AlwaysAllowEntry[];
  /** RU-07 — opt-in WebSocket hook. Default false. */
  enableWsHook: boolean;
  /** CON-020 — advanced switch to disable ToxicDetector entirely. Default true. */
  toxicDetectorEnabled: boolean;
  /** OffTopicDetector preset. */
  presetCommunity: CommunityPreset;
  /** CON-019 — RU-14 PROBATION runtime branch snapshot. */
  probationSnapshot: ProbationSnapshot;
}

// ---------------------------------------------------------------------------
// CON-011 + RU-09 — DenoisedSessionLog
// ---------------------------------------------------------------------------

/**
 * Per-session record of a suppressed danmaku (RU-09 recover panel input).
 *
 * Constraints:
 *   - Max 1000 entries per session in-memory (LRU; RU-11).
 *   - Not persisted across page reloads (session-only). The persistent
 *     allow-list is `alwaysAllowHashes` per C6.
 *   - Cleared on SPA room change (RU-03 / CON-004 reset).
 */
export interface DenoisedSessionLog {
  /** uuid v4. */
  id: string;
  rawText: string;
  uid: string | null;
  ts: number;
  /** Multi-label categories that triggered suppression. */
  category: NoiseCategory[];
  /** Highest-priority category per CON-016 ladder. */
  primaryCategory: NoiseCategory;
  confidence: number;
  actionApplied: ActionMode;
  /** Collapse-group hash; `null` for hide/fade modes. */
  groupKey: string | null;
  /** Bilibili room id. */
  roomId: string;
}

// ---------------------------------------------------------------------------
// CON-018 — FloodWindowEntry
// ---------------------------------------------------------------------------

/**
 * Sliding-window entry kept in FloodDetector's internal Map.
 *
 * CON-018 hard caps (enforced by RU-11 / unit-6 flood.ts):
 *   - Map.size LRU-evicted at 8192.
 *   - Per-tick insert cap 500 (excess sampled).
 *   - Window default 60s, user-adjustable.
 *   - Periodic GC every 30s removes entries older than the window.
 */
export interface FloodWindowEntry {
  hash: string;
  count: number;
  firstSeenTs: number;
  lastSeenTs: number;
}

// ---------------------------------------------------------------------------
// RU-03 + PR-2 mitigation — SelectorRegistryEntry
// ---------------------------------------------------------------------------

/** The five playback contexts the observer must cover. CON-003. */
export type PlaybackMode =
  | "default"
  | "web-fullscreen"
  | "theater"
  | "small-floating"
  | "replay";

/**
 * A single playback-mode -> DOM-selector mapping.
 *
 * `verifiedAt` is `null` until RU-01.5's first-session probe stamps it.
 * The selector should still be best-guess shipped so the extension boots.
 */
export interface SelectorRegistryEntry {
  mode: PlaybackMode;
  containerSelector: string;
  itemSelector: string;
  /** Date.now() when the selector was empirically verified; `null` until RU-01.5. */
  verifiedAt: number | null;
}
