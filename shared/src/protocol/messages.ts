import type { AbilityId, SkillId } from "../types";

/**
 * The wire protocol between client and server: message type identifiers and
 * their payload shapes. Centralizing these keeps both ends in sync — a typo is
 * a compile error, not a silent dropped message.
 */

/** Options the client sends when joining a zone room. */
export interface JoinZoneOptions {
  /** Signed session token (from /auth/*). The server derives identity from it. */
  token: string;
  /** When arriving via a zone exit, the named entry point to spawn at. */
  entry?: string;
}

/** Client → server message types. */
export const ClientMessage = {
  Move: "move",
  UseAbility: "useAbility",
  Chat: "chat",
} as const;

/** Server → client message types. */
export const ServerMessage = {
  Welcome: "welcome",
  CombatEvent: "combat",
  Chat: "chatMsg",
  Transfer: "transfer",
  LevelUp: "levelUp",
} as const;

/** Continuous movement intent; dx/dy in [-1, 1]. */
export interface MovePayload {
  dx: number;
  dy: number;
}

/** Use an ability on a target, addressed by its state-map key. */
export interface UseAbilityPayload {
  abilityId: AbilityId;
  targetId: string;
}

/** Server tells the joining client which session/character is theirs. */
export interface WelcomePayload {
  sessionId: string;
  playerId: string;
}

/** A resolved combat event, for client-side feedback (floating damage, etc.). */
export interface CombatEventPayload {
  /** State-map key of the attacker (a player session id). */
  attackerId: string;
  /** State-map key of the target (enemy id or player session id). */
  targetId: string;
  /** Amount of damage dealt, or HP restored when `heal` is true. */
  damage: number;
  targetDied: boolean;
  /** True for a heal (client shows a green +N instead of damage). */
  heal?: boolean;
}

/** Chat channels available in P1. Party/guild channels arrive with P6. */
export type ChatChannel = "zone" | "global";

/** Client → server: say something. Server validates, censors, rebroadcasts. */
export interface ChatPayload {
  channel: ChatChannel;
  text: string;
}

/** Server → client: a (already censored) chat line to display. */
export interface ChatBroadcastPayload {
  channel: ChatChannel;
  /** Display name of the sender. */
  from: string;
  /** Zone the sender was in (shown for global messages). */
  zone: string;
  text: string;
  /** Server timestamp (ms). */
  at: number;
}

/**
 * Server → client: you walked into a zone exit — leave this room and join
 * `zone`, asking for spawn point `entry`. The target room re-validates the
 * entry name; the client can't teleport anywhere the server didn't offer.
 */
export interface TransferPayload {
  zone: string;
  entry: string;
}

/**
 * Server → client: a skill just gained a level (for level-up feedback). Sent
 * only to the player who leveled — XP totals themselves stream via the synced
 * PlayerSchema, so the client can always recompute exact levels too.
 */
export interface LevelUpPayload {
  skill: SkillId;
  level: number;
}
