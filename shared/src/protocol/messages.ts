import type { AbilityId } from "../types";

/**
 * The wire protocol between client and server: message type identifiers and
 * their payload shapes. Centralizing these keeps both ends in sync — a typo is
 * a compile error, not a silent dropped message.
 */

/** Options the client sends when joining a zone room. */
export interface JoinZoneOptions {
  /** Stable, client-persisted id so a refresh restores the same character. */
  playerId: string;
  name: string;
}

/** Client → server message types. */
export const ClientMessage = {
  Move: "move",
  UseAbility: "useAbility",
} as const;

/** Server → client message types. */
export const ServerMessage = {
  Welcome: "welcome",
  CombatEvent: "combat",
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
  damage: number;
  targetDied: boolean;
}
