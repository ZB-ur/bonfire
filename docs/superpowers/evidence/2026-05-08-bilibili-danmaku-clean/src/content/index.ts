// Content script entrypoint for live.bilibili.com and www.bilibili.com (replay).
// Injected at document_idle (see manifest.json content_scripts.run_at).
// Real observer/normalize/whitelist wiring lands in later units.
// This unit-1 stub exists so the extension loads without errors.

// Guard: never run in iframes. The manifest already restricts all_frames=false,
// but a defensive check keeps us safe if matches expand later.
if (window.top === window.self) {
  // No-op for unit-1 skeleton.
}

export {};
