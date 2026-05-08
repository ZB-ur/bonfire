/// <reference lib="webworker" />
// MV3 service worker entrypoint (FPD-7).
// Idle-by-default. No persistent state. No network. (FPD-4)
// Real lifecycle wiring lands in later units; this stub exists so the
// extension loads cleanly in chrome://extensions and the SW cold-starts < 50ms.

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  // Activate the new SW immediately on update — the denoiser holds no in-flight state.
  void self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // No-op for unit-1 skeleton.
    })()
  );
});

// Keep this file a module so Vite/CRX emits it as a service_worker module.
export {};
