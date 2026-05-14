# Code Handoff

← [[00-overview]] | See also: [[05-constraint-ledger]]

**Code Ready:** true

## Summary

Build a Manifest V3 Chrome extension that denoises live Bilibili danmaku in five categories (flood/repeat, low-info single-char/emoji, ad/external-link, toxicity, off-topic) on live.bilibili.com (default + web fullscreen + theater + small floating + replay). Architecture is OPT-C Hybrid Layered: a default DOM MutationObserver path and an opt-in WebSocket page-world hook share one NormalizedDanmakuRecord interface, one WhitelistEngine, and one NoiseClassifier. Default action is collapse-with-count; user may switch to hide or fade. Hard-whitelist for streamer/moderator/SC/guard-rank/gift roles is non-overridable. Normalization runs in two phases (record-construction then text-normalization with NFKC + zero-width strip + BiDi/combining/variation strip + traditional-to-simplified + pinyin + emoji aliases). Classifier output is multi-label (string[]) with priority ladder toxic > ad > flood > lowinfo > offtopic. RU-14 PROBATION handles missing role fields with a runtime empirical-fill on first dev session. RU-09 provides recover/feedback panel with rate-limited Always-allow, typed-CONFIRM for toxic, 7-day decay and bulk-revoke. 100% local processing; no remote calls; no Bilibili backend writes; sideload-friendly distribution.

## Retained Goal

MV3 Chrome extension for live.bilibili.com that performs five-category client-side danmaku denoising with default collapse-with-count action, hard role whitelist, 100% local processing, SPA reset, four playback-mode coverage, replay support, multi-extension coexistence, a11y compliance, censorship-adjacency boundary (client-side hide only). Sideload + open-source GitHub distribution; not Web Store; not VOD; not cloud LLM in MVP.

## Implementation Scope

Full MVP per OPT-C with all 15 RUs (RU-01 through RU-15) implemented. RU-07 (WS hook) is implemented but disabled by default. RU-13 ships an audited zh-Hans profanity dictionary (politically-censored terms manually stripped, license documented). RU-14 ships PROBATION runtime fallback with empirical-fill clause from CON-019 to be measured during the first /code dev session (RU-01.5). All 6 stage-G mitigation constraints (CON-017..022) and all interface contracts (CON-013..016) are implemented as written. v2 features (cloud LLM with user key, store-grade i18n, sync) are explicitly out of scope.

## Frozen Product Decisions


- FPD-1 (CON-001): All five noise categories must be implemented. Subset implementation forbidden.

- FPD-2 (CON-002): Default action is collapse-with-count. Hide and fade are user-selectable but not default. Default is not hide.

- FPD-3 (CON-006 + CON-022): Hard whitelist roles (streamer/moderator/SC/guard-rank/gift-onboard) are NEVER subject to any detector. Whitelist requires >=2 DOM signals to mitigate forgery (CON-022).

- FPD-4 (DROP-003): 100% local processing. No fetch/XHR/WebSocket/sendBeacon to any non-Bilibili host except chrome.* APIs. No remote model. No telemetry.

- FPD-5 (CON-010): Censorship-adjacency boundary. Client-side hide only. No calls to Bilibili report/delete APIs. No mutation of outgoing Bilibili requests. No leak of denoise state to other users.

- FPD-6 (CON-005): Normalization MUST precede flood/lowinfo detection. Order is fixed in CON-017.

- FPD-7 (CON-012): MV3 only. MV2 forbidden.

- FPD-8 (CON-015): Classifier call order is hard-fixed: P1 (record-construct) -> WhitelistEngine -> P2 (text-normalize) -> 5 detectors in parallel. Reordering is a contract violation.

- FPD-9 (CON-016): NoiseVerdict.category is string[] (multi-label) with priority ladder toxic > ad > flood > lowinfo > offtopic for UI primary-cause display.

- FPD-10 (CON-021): Toxic-category Always-allow requires typed CONFIRM. 60s session whitelist completely disables toxic for that record.

- FPD-11 (CON-019): RU-14 PROBATION includes a /code first-session empirical-fill clause for medalLevel visibility ratio with documented branch behavior.

- FPD-12 (DROP-002): Distribution is sideload + GitHub release. Not Chrome Web Store.

- FPD-13: Storage is chrome.storage.local only. chrome.storage.sync is forbidden in MVP.


## Implementation Units


### unit-1: MV3 project skeleton + manifest + toolchain

**Objective:** Establish a working MV3 unpacked extension that loads in chrome://extensions with empty content + popup + options + background and an idle service worker.
**Scope:** package.json, pnpm-lock.yaml, tsconfig.json, vite.config.ts, manifest.json, .eslintrc.cjs. Empty placeholder files for content/popup/options/background entrypoints.
**Depends on:** 
**Done when:** dist/manifest.json valid, Extension loads without errors, Service worker cold start < 50ms (RU-01 success_criteria)

### unit-1.5: First-session empirical baseline (RU-01.5)

**Objective:** Fill PR-1 / PR-2 / PR-3 / PR-4 inability-to-probe gaps with a single live dev session against >=5 real Bilibili rooms (logged-in + logged-out). Decide RU-14 default branch.
**Scope:** Manual data-collection notebook + selectorRegistry.verifiedAt timestamps + probationSnapshot.medalLevelVisibilityRatio + live-competitor list.
**Depends on:** unit-1
**Done when:** selectorRegistry has verifiedAt for all 5 modes, probationSnapshot.medalLevelVisibilityRatio populated; if < 0.5 set probationSnapshot.mode='fans-medal-detector-with-penalty' (CON-019/C1), RU-01.5-empirical-baseline.md committed with bfcache event-ordering log (PR-3) and live-competitor list (PR-4)

### unit-2: Shared types + settings persistence

**Objective:** Lock CON-013 / CON-014 / CON-016 type contracts and the chrome.storage.local schema with migration.
**Scope:** src/shared/types.ts (all entities from domain_model), src/shared/settings.ts (FC-013), src/shared/messaging.ts.
**Depends on:** unit-1
**Done when:** All entity types from domain_model exported, loadSettings returns defaults on first run, saveSettings emits chrome.storage.onChanged

### unit-3: Phase-2 normalization with idempotency tests

**Objective:** Implement FC-001 normalizeText covering CON-017's full ordered pipeline, with ACC-004 idempotency tests passing.
**Scope:** src/content/normalize.ts + emoji alias table + pinyin lib integration.
**Depends on:** unit-2
**Done when:** normalize('草'), normalize('艹'), normalize('cao'), normalize('🌱'), normalize('\u200b艹\u200b') all yield 'cao', normalize(normalize(x)) === normalize(x) for all fixtures (ACC-004), BiDi/combining/variation strip steps each have a passing test (CON-017)

### unit-4: DOM observer + lifecycle + record construction

**Objective:** Implement FC-002 buildRecord and FC-012 ContextLifecycle so that danmaku DOM nodes produce NormalizedDanmakuRecord events and SPA/bfcache transitions reset cleanly (CON-004).
**Scope:** src/content/observer.ts, src/content/lifecycle.ts, src/content/selector-registry.ts wiring with verified entries from unit-1.5.
**Depends on:** unit-1.5, unit-3
**Done when:** MutationObserver fires NormalizedDanmakuRecord on real chat-item nodes, ContextLifecycle.reset triggers on pushState, popstate, pageshow(persisted=true), visibilitychange (PR-3), Old observer disconnect verified via console diagnostic

### unit-5: WhitelistEngine with dual-signal + PROBATION

**Objective:** Implement FC-004 checkWhitelist with CON-022 dual-signal verification and RU-14 PROBATION branch wired to probationSnapshot.
**Scope:** src/content/whitelist.ts + tests/whitelist.spec.ts.
**Depends on:** unit-2
**Done when:** ACC-005 5-role fixtures with noise text return WHITELISTED, Single fans-medal returns PROBATION (CON-022), All-null role/medal/guard returns PROBATION (RU-14), isPaid=true requires confirmed parent ancestor in fixture data

### unit-6: Five detectors + classifier orchestrator

**Objective:** Implement FC-005..FC-010 with multi-label aggregation and priority-ladder primaryCategory (CON-016).
**Scope:** src/content/classifier/index.ts + 5 detector files + tests.
**Depends on:** unit-3, unit-5, unit-9
**Done when:** Each detector has independent passing fixtures (RU-05 success_criteria), FloodDetector Map.size capped at 8192 LRU verified by test (CON-018), Per-tick 500 sampling verified (CON-018), Multi-label fixtures resolve primaryCategory by toxic > ad > flood > lowinfo > offtopic (CON-016), ToxicDetector disabled when settings.toxicDetectorEnabled=false (CON-020)

### unit-7: Action executor with 3 modes + a11y

**Objective:** Implement FC-011 applyAction with collapse/hide/fade modes, prefers-contrast auto-degrade, and bdd- namespace classes.
**Scope:** src/content/executor.ts + integrated into content/index.ts.
**Depends on:** unit-6
**Done when:** Three action modes each demo-pass (RU-06), aria-hidden=true on hide mode (CON-008), fade auto-degrades to hide under prefers-contrast (CON-008), No removeChild on danmaku nodes (CON-009/RU-10)

### unit-8: Recover panel + feedback loop with safety bars

**Objective:** Implement FC-014 RecoverPanel with restore/Always-allow, typed-CONFIRM toxic modal, rate limit, 7-day decay.
**Scope:** src/content/recover-panel.tsx + bulk-revoke UI in options page.
**Depends on:** unit-7
**Done when:** RU-09 demo passes (suppression -> restore -> hash bypass for 60s), Toxic Always-allow requires literal CONFIRM (FPD-10/CON-021), Rate limit 10/min enforced (CON-021), Bulk-revoke clears alwaysAllowHashes (CON-021), 7-day decay visible in options (CON-021)

### unit-9: Audited profanity dictionary + RU-13

**Objective:** Ship audited zh-Hans profanity dictionary in dict/ with manual political-censorship strip and license documentation.
**Scope:** dict/audited-zh-profanity.txt + dict/README.md.
**Depends on:** unit-1
**Done when:** dict file packaged in extension build, README declares source/license/removed, Extension package total size < 500KB (RU-13 success_criteria)

### unit-10: WS hook v2 path (default disabled)

**Objective:** Implement FC-003 page-world WebSocket constructor wrap producing NormalizedDanmakuRecord with sourceLayer='ws'. Default settings.enableWsHook=false.
**Scope:** src/page/ws-hook.ts + opt-in toggle in options page.
**Depends on:** unit-2, unit-6
**Done when:** Default install does not inject page world, WeakMap tracks already-patched WebSocket instances (RU-10), Schema parse failure does not throw to host page

### unit-11: Popup + options + service-worker wiring

**Objective:** Wire popup quick controls, options-page settings, and chrome.runtime messaging end-to-end.
**Scope:** src/popup/main.ts, src/options/main.ts, src/background/sw.ts integration.
**Depends on:** unit-2, unit-8
**Done when:** Popup loads <200ms (RU-08), Options changes propagate <1s via chrome.storage.onChanged (RU-08), Today denoise count visible in popup (RU-09 partial)

### unit-12: ESLint network-call rule + censorship boundary

**Objective:** Lock RU-12 + CON-010 statically: ESLint rule blocks any fetch/XHR/sendBeacon/WebSocket constructor that targets *.bilibili.com URLs (except read-only WS hook in src/page/ws-hook.ts).
**Scope:** .eslintrc.cjs custom rule + manifest audit.
**Depends on:** unit-1
**Done when:** Manifest contains no webRequestBlocking permission (RU-12), ESLint custom rule passes baseline + fails the deliberately-added fetch test

### unit-13: Multi-extension coexistence + namespace audit

**Objective:** Verify RU-10 namespace isolation; MutationObserver self-loop filter; WeakMap WS instance dedup.
**Scope:** Audit observer.ts and executor.ts for self-write filtering + WS hook idempotency.
**Depends on:** unit-7, unit-10
**Done when:** Console clean during multi-extension session, No double-hide flicker (RU-10/ACC-003)

### unit-14: 8h memory soak + ACC-002 verification

**Objective:** Run 1h/4h/8h timepoint baseline measurement on a real high-density room; confirm <20% growth.
**Scope:** Manual chrome://task-manager observation + FloodDetector adversarial-burst stress test (CON-018).
**Depends on:** unit-6, unit-7
**Done when:** 1h/4h/8h growth < 20% (ACC-002), Adversarial burst does not crash tab (CON-018)

### unit-15: Final acceptance walkthrough + ACC-006 binary checklist

**Objective:** Run all 8 ACC-006 binary items end-to-end and produce final pass/fail log.
**Scope:** Walkthrough only; no code changes unless a binary item fails.
**Depends on:** unit-13, unit-14
**Done when:** All 8 ACC-006 items report PASS (with N/A clauses honored per C2), ACC-001 30-minute qualitative pass on user-chosen room


## Verification Commands


- `pnpm install`

- `pnpm build`

- `pnpm lint`

- `pnpm test`

- `pnpm test -- tests/normalize.spec.ts (ACC-004 idempotency)`

- `pnpm test -- tests/whitelist.spec.ts (ACC-005 priority + CON-022 dual-signal + RU-14 PROBATION)`

- `pnpm test -- tests/classifier.spec.ts (CON-016 multi-label + priority ladder)`

- `pnpm test -- tests/flood.spec.ts (CON-018 LRU 8192 + per-tick 500 sampling + GC)`

- `pnpm test -- tests/lifecycle.spec.ts (CON-004 SPA + PR-3 bfcache)`

- `node scripts/manifest-validate.cjs dist/manifest.json (MV3 schema check)`

- `du -sh dist/ (RU-13 expects total < 500KB)`


## Acceptance Checks


- AC-1 (ACC-001): 30-minute qualitative pass on a >50 msg/sec room with subjective approval.

- AC-2 (ACC-002): 1h/4h/8h memory growth < 20%.

- AC-3 (ACC-003): Multi-extension coexistence with no error spam, no flicker.

- AC-4 (ACC-004): normalizeText idempotency unit tests pass.

- AC-5 (ACC-005): WhitelistEngine 5-role priority unit tests pass.

- AC-6 (ACC-006): All 8 binary checklist items PASS (with C2 N/A clauses honored).

- AC-7 (FPD-4): Static + manifest audit confirms zero outbound calls to *.bilibili.com.

- AC-8 (FPD-3 + CON-022): WhitelistEngine never bypassed; dual-signal forgery test fails to whitelist.

- AC-9 (CON-019/C1): probationSnapshot.medalLevelVisibilityRatio populated; default branch matches measurement (skip if >=0.5, fans-medal-detector-with-penalty if <0.5).

- AC-10 (CON-020): dict/README.md present with documented audit; ToxicDetector disable toggle works.


## Reentry Triggers


- RT-1: If RU-01.5 finds medalLevel visibility < 50% AND fans-medal-detector-with-penalty also misclassifies > 30% in the dev session, halt coding and reenter Stage F probes.

- RT-2: If Bilibili changes the WS protobuf schema such that ws-hook.ts cannot parse a sample frame, do NOT auto-retry; halt unit-10 and document in unresolved_gaps for next planning pass.

- RT-3: If pnpm install fails on a transitive dep due to a removed-from-registry package, halt unit-1 and reenter to revisit DEP-001.

- RT-4: If during ACC-002 memory measurement, growth exceeds 50% at the 4h mark, halt and reenter to revisit RU-11 / CON-018 caps.

- RT-5: If a Bilibili reverse-engineering counter (RISK-010) actively shadowbans the test account, halt and revisit CON-010 boundary.

- RT-6: If the audited dictionary cannot be reduced under 200KB without losing > 30% of profanity coverage, halt and reenter to revisit RU-13.

- RT-7: If any forbidden_decision is on the verge of being violated (compile-time or design-time), STOP and reenter.

