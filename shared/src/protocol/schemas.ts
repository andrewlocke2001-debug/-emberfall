import { z } from "zod";
import { ABILITY_IDS } from "../types";
import type { MovePayload, UseAbilityPayload, ChatPayload } from "./messages";

/**
 * zod schemas for every client→server message (kit rule #2: validate every
 * inbound message). Colyseus 0.17 accepts these natively via
 * `onMessage(type, Schema, handler)` — a payload that fails validation is
 * logged and the offending client is disconnected before our handler runs.
 *
 * NOT exported from the shared barrel on purpose: the server imports
 * "@mmo/shared/protocol/schemas" directly, so zod never enters the client
 * bundle. The payload *types* stay in ./messages (client-safe); the
 * AssertEqual checks below make schema/type drift a compile error.
 */

export const MoveSchema = z.strictObject({
  dx: z.number().min(-1).max(1),
  dy: z.number().min(-1).max(1),
});

export const UseAbilitySchema = z.strictObject({
  abilityId: z.enum(ABILITY_IDS),
  targetId: z.string().min(1).max(64),
});

export const ChatSchema = z.strictObject({
  channel: z.enum(["zone", "global"]),
  text: z.string().min(1).max(200),
});

// --- compile-time drift guards (no runtime cost) -----------------------------

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const _move: AssertEqual<z.output<typeof MoveSchema>, MovePayload> = true;
const _ability: AssertEqual<z.output<typeof UseAbilitySchema>, UseAbilityPayload> = true;
const _chat: AssertEqual<z.output<typeof ChatSchema>, ChatPayload> = true;
void _move;
void _ability;
void _chat;
