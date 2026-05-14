# Constraint Ledger

**Generated:** 2026-05-07T15:21:25.067Z
**Total entries:** 16

## Frozen Constraints



## Proposed / Challenged


### CON-001 [PROPOSED] (confirmed_fact)
- **Content:** MV3 is the only currently-supported manifest version for new Chrome Web Store submissions; MV2 deprecated. Background script replaced by non-persistent service worker (idle-killable ~30s).
- **Rationale:** Chrome Web Store policy and MV3 service-worker lifecycle are documented platform behaviors as of 2024+.

### CON-002 [PROPOSED] (confirmed_fact)
- **Content:** Bilibili livestream danmaku is delivered via WebSocket from a chat/broadcast server. Protocol is reverse-engineered community knowledge, not a published stable API; framing/compression/auth have changed across deploys.
- **Rationale:** Public observation; treat as moving target.

### CON-003 [PROPOSED] (confirmed_fact)
- **Content:** Two viable intercept points: (a) MAIN-world WebSocket monkey-patch (pre-render, fragile to protocol drift), (b) MutationObserver on rendered DOM (post-render with flicker risk, fragile to selector drift). Hybrid is possible.
- **Rationale:** Architectural reality the user will hit no matter the noise-definition choice.

### CHA-001 [CHALLENGED] (challenged_claim)
- **Content:** Implicit user assumption: 'noise reduction' is a single well-defined feature. Reality: 'noise' spans 5+ classes (spam/repeat, low-info, off-topic, toxicity, advertising) needing different mechanisms (regex/list, frequency, semantic, classifier, sender-reputation). One engine cannot cover all five at the same accuracy/cost.
- **Rationale:** Drives v1 scope; without scoping which class, no defined success criterion.

### RGOAL-001 [PROPOSED] (retained_goal)
- **Content:** v1 noise class A — 重复刷屏 dedup (PRIMARY axis). Hash/burst-collapse high-frequency repeats: '6666', '哈哈哈哈', copy-paste raids. Dedup window-based (TBD: wall-clock vs message-count). Output modality: cluster-and-count — 首条保留, 后续凝成 '6666 ×N' 实时增量计数 (preserves crowd-cheer atmosphere).
- **Rationale:** User-confirmed primary noise class. Highest user-perceived value, simplest mechanism.

### RGOAL-002 [PROPOSED] (retained_goal)
- **Content:** v1 noise class B — 低质量短弹幕 filter. Single-emoji, 1-2 char, gibberish. Mechanism: length/entropy heuristic, hand-tuned threshold.
- **Rationale:** User-confirmed secondary noise class. Per-message classifier, deterministic.

### RGOAL-003 [PROPOSED] (retained_goal)
- **Content:** v1 noise class C — 偏题/引战/广告 filter. Mechanism TBD: keyword/regex blocklist (manual) vs ML/semantic (heavy). Priority below A and B.
- **Rationale:** User-confirmed third noise class. Mechanism choice deferred — must answer ML-vs-rules question downstream.

### ASEM-001 [PROPOSED] (acceptance_semantic)
- **Content:** v1 acceptance scope is RGOAL-001 only (dedup of high-frequency repeats). RGOAL-002 (low-info filter) and RGOAL-003 (off-topic/inflammatory/ad filter) are PROPOSED-but-deferred to post-v1 backlog. v1 'visibly cleaner' acceptance bar must be reachable from RGOAL-001 alone.
- **Rationale:** Phased delivery: v1 ships dedup only; B and C deferred to v1.1+/v1.2+. Lowers v1 effort, makes acceptance criterion testable on a single mechanism.

### CON-004 [PROPOSED] (frozen_constraint)
- **Content:** v1 implementation surface coverage limited to Bilibili chat-list sidebar (DOM-rendered message list). Canvas/WebGL danmaku overlay rendering layer is OUT of v1 scope — cluster-and-count cannot be performed there from a Chrome extension because rendered danmaku instances are not exposed. v1 acceptance applies only to chat-list sidebar.
- **Rationale:** Forced by Q3 = cluster-and-count output modality. Canvas overlay would require either (a) intercepting WS frames pre-render and reconstructing the overlay (out of scope for v1 effort budget), or (b) DOM-overlay manipulation which Bilibili's renderer does not support hooking into externally.


## Open Risks


### RISK-001
- **Content:** Failure-mode policy on Bilibili-side drift (selector or WS schema change) is unspecified. Silent fail-open and silent fail-closed are both user-hostile in opposite directions. Without explicit policy, the dogfood ships in a state where user cannot tell if filter worked or filter died — making 'visibly cleaner' acceptance test undecidable.
- **Rationale:** Scout's synthesis observation: every other behavioral question is a special case of this meta-question.


## Discarded Options


### DROP-001
- **Content:** Class D pure rate-limiting / volume sampler (regardless of message content) — explicitly out of v1 scope per user.
- **Rationale:** User did not select D; closing scope explicitly to anchor non-goals.

### DROP-002
- **Content:** Output modalities A=Drop (display:none) and C=Progressive-fade — rejected in favor of B=cluster-and-count. A drops crowd-cheer atmosphere; C has CSS opacity timing complexity matching B's effort but produces a visually weaker signal.
- **Rationale:** User selected B per Q3 2026-05-07 with explicit acknowledgment of surface tradeoff.

