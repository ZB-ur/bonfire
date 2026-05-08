// Sanity checks on the typed messaging helpers.
//
// Wire-protocol details (real chrome.runtime.sendMessage) are exercised in
// /achieve browser_checks. Here we only verify:
//   - sendMessage forms a `{ type, payload }` envelope.
//   - installMessageRouter dispatches by type and propagates async responses.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installMessageRouter,
  sendMessage,
  type RuntimeMessage,
} from "../../src/shared/messaging.js";

interface FakeChromeRuntime {
  lastError: { message: string } | undefined;
  sendMessage: (msg: unknown, cb: (response: unknown) => void) => void;
  onMessage: {
    addListener: (
      l: (
        msg: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (r: unknown) => void
      ) => boolean
    ) => void;
    removeListener: (l: unknown) => void;
  };
}

function installRuntimeMock(): {
  fake: FakeChromeRuntime;
  listeners: Set<
    (
      msg: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (r: unknown) => void
    ) => boolean
  >;
} {
  const listeners = new Set<
    (
      msg: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (r: unknown) => void
    ) => boolean
  >();
  const fake: FakeChromeRuntime = {
    lastError: undefined,
    sendMessage: (msg, cb) => {
      // Mirror chrome behavior: if any listener returns true (async), wait
      // for it to call sendResponse; otherwise dispatch sync and call cb
      // with the first response we get. If no listener responds, cb fires
      // with undefined.
      let responded = false;
      let anyAsync = false;
      const sendResponse = (r: unknown): void => {
        if (responded) return;
        responded = true;
        queueMicrotask(() => cb(r));
      };
      for (const l of listeners) {
        const isAsync = l(msg, {} as chrome.runtime.MessageSender, sendResponse);
        if (isAsync) anyAsync = true;
        if (responded && !isAsync) break;
      }
      if (!responded && !anyAsync) {
        queueMicrotask(() => cb(undefined));
      }
    },
    onMessage: {
      addListener: (l) => listeners.add(l),
      removeListener: (l) =>
        listeners.delete(
          l as (
            msg: unknown,
            sender: chrome.runtime.MessageSender,
            sendResponse: (r: unknown) => void
          ) => boolean
        ),
    },
  };

  // @ts-expect-error — install a minimal chrome.runtime stub on globalThis
  globalThis.chrome = { runtime: fake };
  return { fake, listeners };
}

describe("shared/messaging — envelope + dispatch", () => {
  beforeEach(() => installRuntimeMock());
  afterEach(() => {
    // @ts-expect-error — remove the chrome stub installed in beforeEach
    delete globalThis.chrome;
  });

  it("sendMessage wraps payload in { type, payload } and resolves response", async () => {
    const seenEnvelopes: RuntimeMessage[] = [];
    const unsub = installMessageRouter({
      GET_TODAY_STATS: (_payload, _sender) => {
        return {
          count: 42,
          perCategory: { toxic: 1, ad: 2, flood: 3, lowinfo: 4, offtopic: 5 },
        };
      },
      CONTENT_HELLO: (payload) => {
        seenEnvelopes.push({ type: "CONTENT_HELLO", payload });
        // Return a stub settings shape; the test only checks routing.
        return Promise.resolve({
          settings: {
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
          },
        });
      },
    });

    const stats = await sendMessage("GET_TODAY_STATS", {});
    expect(stats.count).toBe(42);
    expect(stats.perCategory.toxic).toBe(1);

    const hello = await sendMessage("CONTENT_HELLO", {
      roomId: "12345",
      href: "https://live.bilibili.com/12345",
    });
    expect(hello.settings.actionMode).toBe("collapse");
    expect(seenEnvelopes.length).toBe(1);
    expect(seenEnvelopes[0]?.type).toBe("CONTENT_HELLO");

    unsub();
  });

  it("installMessageRouter ignores envelopes whose type has no handler", async () => {
    const handler = vi.fn(() => ({
      count: 0,
      perCategory: { toxic: 0, ad: 0, flood: 0, lowinfo: 0, offtopic: 0 },
    }));
    installMessageRouter({ GET_TODAY_STATS: handler });

    // Send a different message type; only handler is GET_TODAY_STATS, so
    // the dispatcher returns `false` and the mock falls back to cb(undefined).
    const result = await sendMessage("SETTINGS_CHANGED", {
      // The contract surface only requires shape match; deep validity
      // doesn't matter for this routing test.
      settings: {} as never,
    }).catch((e: unknown) => e);
    expect(handler).not.toHaveBeenCalled();
    // The response is undefined when no handler matches.
    expect(result).toBeUndefined();
  });
});
