/* eslint-env node */
// ESLint config for Bilibili Danmaku Denoiser.
// RU-12: enforce no-network-call to *.bilibili.com (custom rule landed in unit handling RU-12; placeholder here).
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    webextensions: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: false
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  ignorePatterns: ["dist/", "node_modules/", "*.cjs"],
  rules: {
    "no-console": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    // Hard guard against accidental fetch/XHR landing in code (FPD-4 100% local, RU-12).
    // The semantic enforcement (regex over hostnames) lands in a later unit's custom plugin.
    "no-restricted-globals": [
      "error",
      { "name": "fetch", "message": "FPD-4: extension is 100% local. No network calls." },
      { "name": "XMLHttpRequest", "message": "FPD-4: extension is 100% local. No network calls." },
      { "name": "WebSocket", "message": "FPD-4: extension is 100% local. No network calls." }
    ]
  }
};
