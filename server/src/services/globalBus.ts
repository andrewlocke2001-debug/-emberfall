import { EventEmitter } from "node:events";
import type { ChatBroadcastPayload } from "@mmo/shared";

/**
 * Process-local pub/sub for cross-zone systems (global chat to start). Each
 * ZoneRoom subscribes and fans incoming messages out to its own clients.
 *
 * This works because all zone rooms run in one process. When we go
 * multi-process (P11), this is the seam that gets swapped for Redis pub/sub —
 * the rooms' subscribe/publish calls stay the same.
 */
class GlobalBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // one listener per live room; don't warn
  }

  publishChat(message: ChatBroadcastPayload): void {
    this.emit("chat", message);
  }

  /** Subscribe to global chat; returns an unsubscribe function. */
  onChat(handler: (message: ChatBroadcastPayload) => void): () => void {
    this.on("chat", handler);
    return () => this.off("chat", handler);
  }
}

export const globalBus = new GlobalBus();
