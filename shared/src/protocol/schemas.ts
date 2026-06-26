import { z } from "zod";
import { ABILITY_IDS } from "../types";
import { EQUIP_SLOTS } from "../data/items";
import type {
  MovePayload,
  UseAbilityPayload,
  ChatPayload,
  EquipPayload,
  UnequipPayload,
  PickupPayload,
  BankMovePayload,
  GatherPayload,
  CraftPayload,
  ConsumePayload,
  QuestActionPayload,
} from "./messages";

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

export const EquipSchema = z.strictObject({
  itemId: z.string().min(1).max(64),
});

export const UnequipSchema = z.strictObject({
  slot: z.enum(EQUIP_SLOTS),
});

export const PickupSchema = z.strictObject({
  lootId: z.string().min(1).max(64),
});

/** deposit + withdraw share this shape (itemId + positive quantity). */
export const BankMoveSchema = z.strictObject({
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(1_000_000_000),
});

export const GatherSchema = z.strictObject({
  nodeId: z.string().min(1).max(64),
});

export const CraftSchema = z.strictObject({
  recipeId: z.string().min(1).max(64),
});

export const ConsumeSchema = z.strictObject({
  itemId: z.string().min(1).max(64),
});

/** questAccept + questComplete share this shape (a quest id). */
export const QuestActionSchema = z.strictObject({
  questId: z.string().min(1).max(64),
});

// --- compile-time drift guards (no runtime cost) -----------------------------

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const _move: AssertEqual<z.output<typeof MoveSchema>, MovePayload> = true;
const _ability: AssertEqual<z.output<typeof UseAbilitySchema>, UseAbilityPayload> = true;
const _chat: AssertEqual<z.output<typeof ChatSchema>, ChatPayload> = true;
const _equip: AssertEqual<z.output<typeof EquipSchema>, EquipPayload> = true;
const _unequip: AssertEqual<z.output<typeof UnequipSchema>, UnequipPayload> = true;
const _pickup: AssertEqual<z.output<typeof PickupSchema>, PickupPayload> = true;
const _bankMove: AssertEqual<z.output<typeof BankMoveSchema>, BankMovePayload> = true;
const _gather: AssertEqual<z.output<typeof GatherSchema>, GatherPayload> = true;
const _craft: AssertEqual<z.output<typeof CraftSchema>, CraftPayload> = true;
const _consume: AssertEqual<z.output<typeof ConsumeSchema>, ConsumePayload> = true;
const _quest: AssertEqual<z.output<typeof QuestActionSchema>, QuestActionPayload> = true;
void _quest;
void _move;
void _ability;
void _chat;
void _equip;
void _unequip;
void _pickup;
void _bankMove;
void _gather;
void _craft;
void _consume;
