import { defineConfig } from "vite";
import { crx, defineManifest } from "@crxjs/vite-plugin";
import manifestJson from "./manifest.json" assert { type: "json" };

// MV3-only build (FPD-7). 100% local — no network calls (FPD-4).
// Build target: Chromium MV3 service worker + ES2022.
// defineManifest narrows the JSON to @crxjs's ManifestV3 shape so TS strict mode is happy.
const manifest = defineManifest(manifestJson as Parameters<typeof defineManifest>[0]);

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "es2022",
    sourcemap: true,
    minify: "esbuild",
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      output: {
        // Keep deterministic chunk names so dist/ stays under RU-13's 500KB budget.
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
});
