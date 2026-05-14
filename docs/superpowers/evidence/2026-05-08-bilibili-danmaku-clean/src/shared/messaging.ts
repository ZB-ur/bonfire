// Typed chrome.runtime.sendMessage helpers.
//
// Provides a single MessageMap that all senders/receivers can import. Adding
// a new message type means: (1) extend MessageMap below, (2) update both
// sender call sites and the receiver dispatcher in src/background/sw.ts.
//
// Constraints honored here:
//   - FPD-4: messages are intra-extension only (chrome.runtime). No fetch.
//   - C5: optional fields use `T | null` where they carry "missing" semantics;
//     pure-optional payload fields (e.g. an absent uid filter) use `?:`.

import type { ExtensionSettings, NoiseCategory } from "./types.js";

// ---------------------------------------------------------------------------
// MessageMap — single source of truth
// ---------------------------------------------------------------------------

/**
 * The full set of internal RuntimeMessage shapes. Each key is a discriminator
 * for the request payload; each value is `{ request, response }`.
 *
 * To add a new message: add an entry here, then update the sender helper at
 * the bottom of this file and the receiver dispatcher in unit-11.
 */
export interface MessageMap {
  /**
   * Service worker / popup query: how many records were suppressed today
   * across all rooms? Used by the popup badge (RU-09 partial).
   */
  GET_TODAY_STATS: {
    request: Record<string, never>;
    response: { count: number; perCategory: Record<NoiseCategory, number> };
  };

  /**
   * Background -> content broadcast when settings change. Content scripts
   * also subscribe via chrome.storage.onChanged directly; this message is
   * an explicit fan-out for popup-driven hot-reload (RU-08 <=1s propagation).
   */
  SETTINGS_CHANGED: {
    request: { settings: ExtensionSettings };
    response: { ok: true };
  };

  /**
   * Content -> background ping issued on content-script boot. Lets the SW
   * lazily wake and (in unit-11) hand back the latest settings snapshot so
   * the content script avoids a round-trip to chrome.storage.local.
   */
  CONTENT_HELLO: {
    request: { roomId: string | null; href: string };
    response: { settings: ExtensionSettings };
  };
}

/** All known message types. */
export type MessageType = keyof MessageMap;

/** Wire envelope for any message. */
export interface RuntimeMessage<T extends MessageType = MessageType> {
  type: T;
  payload: MessageMap[T]["request"];
}

/** Type-narrowed response for a given message type. */
export type RuntimeResponse<T extends MessageType> = MessageMap[T]["response"];

// ---------------------------------------------------------------------------
// Sender helpers
// ---------------------------------------------------------------------------

/**
 * Type-safe wrapper over `chrome.runtime.sendMessage`. Resolves with the
 * receiver's response or rejects on `chrome.runtime.lastError`.
 *
 * Intended for popup/options/content -> background. For tab-targeted
 * messages use `sendTabMessage` instead.
 */
export function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]["request"]
): Promise<RuntimeResponse<T>> {
  const envelope: RuntimeMessage<T> = { type, payload };
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(envelope, (response: unknown) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message ?? "chrome.runtime.sendMessage failed"));
        return;
      }
      resolve(response as RuntimeResponse<T>);
    });
  });
}

/**
 * Type-safe wrapper over `chrome.tabs.sendMessage` for background -> content.
 */
export function sendTabMessage<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessageMap[T]["request"]
): Promise<RuntimeResponse<T>> {
  const envelope: RuntimeMessage<T> = { type, payload };
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, envelope, (response: unknown) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message ?? "chrome.tabs.sendMessage failed"));
        return;
      }
      resolve(response as RuntimeResponse<T>);
    });
  });
}

// ---------------------------------------------------------------------------
// Receiver helper
// ---------------------------------------------------------------------------

/**
 * One handler per message type. The dispatcher returns `true` from the
 * chrome.runtime.onMessage listener iff the handler is async, per the
 * MV3 messaging contract.
 *
 * Add a handler in unit-11's service worker for each MessageType you need
 * to receive. Handlers may return either a Promise<response> or a sync
 * response — the dispatcher normalizes both.
 */
export type MessageHandler<T extends MessageType> = (
  payload: MessageMap[T]["request"],
  sender: chrome.runtime.MessageSender
) => Promise<RuntimeResponse<T>> | RuntimeResponse<T>;

export type MessageHandlerMap = {
  [K in MessageType]?: MessageHandler<K>;
};

/**
 * Install a chrome.runtime.onMessage listener that routes envelopes to the
 * correct typed handler. Returns an unsubscribe function.
 */
export function installMessageRouter(handlers: MessageHandlerMap): () => void {
  const listener = (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean => {
    if (!isRuntimeMessage(msg)) {
      return false;
    }
    const handler = handlers[msg.type] as MessageHandler<MessageType> | undefined;
    if (!handler) {
      return false;
    }
    const result = handler(msg.payload, sender);
    if (result instanceof Promise) {
      result
        .then((r) => sendResponse(r))
        .catch((err: unknown) => {
          // Surface the error to the caller via lastError-equivalent shape.
          const message = err instanceof Error ? err.message : String(err);
          sendResponse({ __error: message });
        });
      return true; // async response
    }
    sendResponse(result);
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

// ---------------------------------------------------------------------------
// internal type guard
// ---------------------------------------------------------------------------

function isRuntimeMessage(v: unknown): v is RuntimeMessage {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return typeof obj["type"] === "string" && "payload" in obj;
}
