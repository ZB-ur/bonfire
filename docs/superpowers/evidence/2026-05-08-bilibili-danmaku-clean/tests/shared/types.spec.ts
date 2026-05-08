// Compile-time + light runtime checks for the shared type contracts.
//
// The real exhaustive contract tests for NormalizedDanmakuRecord /
// NoiseVerdict shape land alongside the units that produce them
// (unit-3 normalize, unit-5 whitelist, unit-6 classifier). This file
// only guards unit-2's two narrow promises:
//
//   1. Every entity from the frozen domain_model is exported.
//   2. PRIMARY_CATEGORY_LADDER matches CON-016 verbatim.

import { describe, expect, it } from "vitest";
import {
  PRIMARY_CATEGORY_LADDER,
  type AlwaysAllowEntry,
  type CommunityPreset,
  type DanmakuRole,
  type DenoisedSessionLog,
  type ExtensionSettings,
  type FloodWindowEntry,
  type NoiseCategory,
  type NoiseVerdict,
  type NormalizedDanmakuRecord,
  type PlaybackMode,
  type ProbationSnapshot,
  type SelectorRegistryEntry,
  type SourceLayer,
} from "../../src/shared/types.js";

describe("shared/types — domain model surface", () => {
  it("PRIMARY_CATEGORY_LADDER is the CON-016 ladder verbatim", () => {
    expect([...PRIMARY_CATEGORY_LADDER]).toEqual([
      "toxic",
      "ad",
      "flood",
      "lowinfo",
      "offtopic",
    ]);
  });

  it("NormalizedDanmakuRecord uses `T | null` for nullable fields (C5)", () => {
    // Compile-time guard: this must type-check. If a future edit silently
    // switches to `?: number`, this literal stops compiling.
    const rec: NormalizedDanmakuRecord = {
      rawText: "hi",
      normalizedText: "hi",
      uid: null,
      role: null,
      medalLevel: null,
      guardLevel: null,
      isPaid: false,
      ts: 0,
      sourceLayer: "dom",
    };
    expect(rec.role).toBeNull();
    expect(rec.medalLevel).toBeNull();
    expect(rec.guardLevel).toBeNull();
  });

  it("NoiseVerdict.category is string[] (multi-label, CON-016)", () => {
    const v: NoiseVerdict = {
      verdict: "NOISE",
      category: ["toxic", "ad"],
      primaryCategory: "toxic",
      confidence: 0.91,
    };
    expect(Array.isArray(v.category)).toBe(true);
    expect(v.category.length).toBe(2);
  });

  it("PASS verdict has empty category and null primaryCategory", () => {
    const v: NoiseVerdict = {
      verdict: "PASS",
      category: [],
      primaryCategory: null,
      confidence: 1.0,
    };
    expect(v.category).toEqual([]);
    expect(v.primaryCategory).toBeNull();
  });

  it("ExtensionSettings carries every CON-007 + CON-019 field", () => {
    const s: ExtensionSettings = {
      schemaVersion: 1,
      enabled: true,
      actionMode: "collapse",
      keywordBlacklist: [],
      keywordWhitelist: [],
      uidBlacklist: [],
      roomWhitelist: [],
      alwaysAllowHashes: [],
      enableWsHook: false,
      toxicDetectorEnabled: true,
      presetCommunity: "general",
      probationSnapshot: {
        medalLevelVisibilityRatio: null,
        measuredAt: null,
        mode: "skip",
      },
    };
    expect(s.actionMode).toBe("collapse"); // FPD-2 default
  });

  // The following are pure compile-time exercises: simply naming the types
  // here ensures they are exported and structurally addressable. If any
  // export disappears, this test file fails to compile.
  it("all 7 entity types from the domain_model are exported", () => {
    const sentinels: ReadonlyArray<unknown> = [
      null as unknown as NormalizedDanmakuRecord,
      null as unknown as NoiseVerdict,
      null as unknown as ExtensionSettings,
      null as unknown as DenoisedSessionLog,
      null as unknown as FloodWindowEntry,
      null as unknown as SelectorRegistryEntry,
      null as unknown as ProbationSnapshot,
      null as unknown as AlwaysAllowEntry,
      null as unknown as DanmakuRole,
      null as unknown as NoiseCategory,
      null as unknown as CommunityPreset,
      null as unknown as PlaybackMode,
      null as unknown as SourceLayer,
    ];
    expect(sentinels.length).toBe(13);
  });
});
