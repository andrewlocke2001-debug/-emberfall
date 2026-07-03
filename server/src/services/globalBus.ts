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

  /** Publish a whisper; the room holding the recipient (by name) delivers it. */
  publishWhisper(message: ChatBroadcastPayload): void {
    this.emit("whisper", message);
  }

  /** Subscribe to whispers; returns an unsubscribe function. */
  onWhisper(handler: (message: ChatBroadcastPayload) => void): () => void {
    this.on("whisper", handler);
    return () => this.off("whisper", handler);
  }

  /** Announce that these players' party rosters changed (by display name). */
  publishPartyChanged(names: string[]): void {
    this.emit("partyChanged", names);
  }

  /** Subscribe to party-roster changes; returns an unsubscribe function. */
  onPartyChanged(handler: (names: string[]) => void): () => void {
    this.on("partyChanged", handler);
    return () => this.off("partyChanged", handler);
  }

  /** Publish a guild chat line; rooms deliver to members of `guildId`. */
  publishGuildChat(guildId: string, message: ChatBroadcastPayload): void {
    this.emit("guildChat", guildId, message);
  }

  onGuildChat(handler: (guildId: string, message: ChatBroadcastPayload) => void): () => void {
    this.on("guildChat", handler);
    return () => this.off("guildChat", handler);
  }

  /** Announce that these players' guild state changed (by display name). */
  publishGuildChanged(names: string[]): void {
    this.emit("guildChanged", names);
  }

  onGuildChanged(handler: (names: string[]) => void): () => void {
    this.on("guildChanged", handler);
    return () => this.off("guildChanged", handler);
  }
}

export const globalBus = new GlobalBus();
