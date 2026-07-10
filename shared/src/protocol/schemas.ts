import { z } from "zod";
import { ABILITY_IDS } from "../types";
import { EQUIP_SLOTS } from "../data/items";
import type {
  MovePayload,
  UseAbilityPayload,
  ChatPayload,
  WhisperPayload,
  EquipPayload,
  UnequipPayload,
  PickupPayload,
  BankMovePayload,
  GatherPayload,
  CraftPayload,
  ConsumePayload,
  QuestActionPayload,
  TalkPayload,
  TradePayload,
  FriendActionPayload,
  PartyInvitePayload,
  GuildCreatePayload,
  GuildActionPayload,
  GuildSetRankPayload,
  TradeRequestPayload,
  TradeRespondPayload,
  TradeOfferPayload,
  ExchangePostPayload,
  ExchangeActionPayload,
  RequestExchangePayload,
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
  channel: z.enum(["zone", "global", "guild"]),
  text: z.string().min(1).max(200),
});

export const WhisperSchema = z.strictObject({
  to: z.string().min(1).max(24),
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

export const TalkSchema = z.strictObject({
  npcId: z.string().min(1).max(64),
});

/** buy + sell share this shape (a vendor, an item, and a positive quantity). */
export const TradeSchema = z.strictObject({
  vendorId: z.string().min(1).max(64),
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(1000),
});

/** friendAdd + friendRemove share this shape (a display name). */
export const FriendActionSchema = z.strictObject({
  name: z.string().min(1).max(24),
});

export const PartyInviteSchema = z.strictObject({
  name: z.string().min(1).max(24),
});

export const GuildCreateSchema = z.strictObject({
  name: z.string().min(3).max(24),
  tag: z.string().min(2).max(4),
});

/** guildInvite + guildKick share this shape (a display name). */
export const GuildActionSchema = z.strictObject({
  name: z.string().min(1).max(24),
});

export const GuildSetRankSchema = z.strictObject({
  name: z.string().min(1).max(24),
  rank: z.enum(["officer", "member"]),
});

export const TradeRequestSchema = z.strictObject({
  name: z.string().min(1).max(24),
});

export const TradeRespondSchema = z.strictObject({
  accept: z.boolean(),
});

/** A trade offer: up to a bagful of stacks + coins. The server re-validates the
 *  player actually holds these before the swap. */
export const TradeOfferSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        itemId: z.string().min(1).max(64),
        qty: z.number().int().min(1).max(2_147_483_647),
      }),
    )
    .max(28),
  coins: z.number().int().min(0).max(2_147_483_647),
});

export const ExchangePostSchema = z.strictObject({
  side: z.enum(["buy", "sell"]),
  itemId: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(2_147_483_647),
  price: z.number().int().min(1).max(2_147_483_647),
});

export const ExchangeActionSchema = z.strictObject({
  orderId: z.string().min(1).max(64),
});

export const RequestExchangeSchema = z.strictObject({
  itemId: z.string().min(1).max(64).optional(),
});

// --- compile-time drift guards (no runtime cost) -----------------------------

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const _move: AssertEqual<z.output<typeof MoveSchema>, MovePayload> = true;
const _ability: AssertEqual<z.output<typeof UseAbilitySchema>, UseAbilityPayload> = true;
const _chat: AssertEqual<z.output<typeof ChatSchema>, ChatPayload> = true;
const _whisper: AssertEqual<z.output<typeof WhisperSchema>, WhisperPayload> = true;
void _whisper;
const _equip: AssertEqual<z.output<typeof EquipSchema>, EquipPayload> = true;
const _unequip: AssertEqual<z.output<typeof UnequipSchema>, UnequipPayload> = true;
const _pickup: AssertEqual<z.output<typeof PickupSchema>, PickupPayload> = true;
const _bankMove: AssertEqual<z.output<typeof BankMoveSchema>, BankMovePayload> = true;
const _gather: AssertEqual<z.output<typeof GatherSchema>, GatherPayload> = true;
const _craft: AssertEqual<z.output<typeof CraftSchema>, CraftPayload> = true;
const _consume: AssertEqual<z.output<typeof ConsumeSchema>, ConsumePayload> = true;
const _quest: AssertEqual<z.output<typeof QuestActionSchema>, QuestActionPayload> = true;
const _talk: AssertEqual<z.output<typeof TalkSchema>, TalkPayload> = true;
const _trade: AssertEqual<z.output<typeof TradeSchema>, TradePayload> = true;
const _friend: AssertEqual<z.output<typeof FriendActionSchema>, FriendActionPayload> = true;
const _partyInvite: AssertEqual<z.output<typeof PartyInviteSchema>, PartyInvitePayload> = true;
const _guildCreate: AssertEqual<z.output<typeof GuildCreateSchema>, GuildCreatePayload> = true;
const _guildAction: AssertEqual<z.output<typeof GuildActionSchema>, GuildActionPayload> = true;
const _guildRank: AssertEqual<z.output<typeof GuildSetRankSchema>, GuildSetRankPayload> = true;
const _tradeReq: AssertEqual<z.output<typeof TradeRequestSchema>, TradeRequestPayload> = true;
const _tradeResp: AssertEqual<z.output<typeof TradeRespondSchema>, TradeRespondPayload> = true;
const _tradeOffer: AssertEqual<z.output<typeof TradeOfferSchema>, TradeOfferPayload> = true;
const _exPost: AssertEqual<z.output<typeof ExchangePostSchema>, ExchangePostPayload> = true;
const _exAction: AssertEqual<z.output<typeof ExchangeActionSchema>, ExchangeActionPayload> = true;
const _exReq: AssertEqual<z.output<typeof RequestExchangeSchema>, RequestExchangePayload> = true;
void _tradeReq;
void _tradeResp;
void _tradeOffer;
void _exPost;
void _exAction;
void _exReq;
void _friend;
void _partyInvite;
void _guildCreate;
void _guildAction;
void _guildRank;
void _quest;
void _talk;
void _trade;
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
