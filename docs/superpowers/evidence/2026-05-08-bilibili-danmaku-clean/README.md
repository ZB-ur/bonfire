# Bilibili Danmaku Denoiser

Local-only Manifest V3 Chrome extension that denoises Bilibili live (`live.bilibili.com`) and replay (`www.bilibili.com`) danmaku.

## Frozen product decisions (excerpt)

- 5 noise categories (FPD-1).
- Default action is `collapse-with-count` (FPD-2). Hide is opt-in.
- 100% local, no network (FPD-4).
- MV3 only (FPD-7).
- Persistence is `chrome.storage.local` only (FPD-13).

## Toolchain

- Node `>=18.18`
- pnpm preferred (`pnpm install`, `pnpm build`). npm works as a fallback.
- Bundler: Vite + `@crxjs/vite-plugin`.
- Language: TypeScript strict.

## Build

```bash
pnpm install
pnpm build
```

The compiled extension lands in `dist/`. Load it via `chrome://extensions/` -> Developer mode -> Load unpacked -> select `dist/`.

## Status

This repository is being assembled in vertical units. Unit 1 wires up the toolchain and an empty MV3 skeleton: idle service worker, empty content script, empty popup, empty options page. Subsequent units add normalization, the whitelist, the classifier, the flood detector, lifecycle handling, settings UI, and tests.
