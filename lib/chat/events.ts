import { EventEmitter } from "node:events";
import type { ChatEvent } from "@/lib/chat/types";

/**
 * In-process pub/sub for chat events. Works for a single Node.js dev server
 * (and a single-instance Node deploy). For multi-instance hosting, replace this
 * with Redis pub/sub or a Postgres LISTEN/NOTIFY equivalent — the only call
 * sites are publish() and subscribe() below.
 *
 * The bus is stored on `globalThis` so HMR doesn't drop active subscribers.
 */

type Bus = EventEmitter & { __chatBus?: true };

declare global {

  var __chatBus: Bus | undefined;
}

function bus(): Bus {
  if (!globalThis.__chatBus) {
    const e = new EventEmitter() as Bus;
    e.setMaxListeners(0); // many concurrent SSE subscribers
    e.__chatBus = true;
    globalThis.__chatBus = e;
  }
  return globalThis.__chatBus;
}

const EVENT = "chat";

export function publish(event: ChatEvent): void {
  bus().emit(EVENT, event);
}

export function subscribe(handler: (e: ChatEvent) => void): () => void {
  const b = bus();
  b.on(EVENT, handler);
  return () => b.off(EVENT, handler);
}
