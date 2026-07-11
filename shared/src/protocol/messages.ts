import type { AbilityId, SkillId, ItemStack } from "../types";
import type { EquipSlot } from "../data/items";

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
  /** Dungeon instance ticket (routes to one instance + authorizes the join). */
  ticket?: string;
}

/** Client → server message types. */
export const ClientMessage = {
  Move: "move",
  UseAbility: "useAbility",
  Chat: "chat",
  /** Send a private message to a player by display name. */
  Whisper: "whisper",
  /** Ask the server to (re)send our inventory + equipment — sent once the
   *  client's handlers are registered, so the initial push can't lose the
   *  join race. */
  RequestInventory: "requestInventory",
  /** Equip an item from the bag into its slot. */
  Equip: "equip",
  /** Unequip a gear slot back into the bag. */
  Unequip: "unequip",
  /** Pick up a ground-loot pile (server checks range + ownership). */
  Pickup: "pickup",
  /** Ask the server to (re)send our bank contents (must be near a bank). */
  RequestBank: "requestBank",
  /** Move an item from the bag into the bank (must be near a bank). */
  Deposit: "deposit",
  /** Move an item from the bank into the bag (must be near a bank). */
  Withdraw: "withdraw",
  /** Start gathering a resource node (mining/fishing); auto-repeats until you
   *  move, the bag fills, or you go out of range. */
  Gather: "gather",
  /** Craft one of a recipe (smithing/cooking) from bag inputs. */
  Craft: "craft",
  /** Eat/consume an item from the bag to heal. */
  Consume: "consume",
  /** Repair all worn equipped gear for coins (proximity-checked at a vendor). */
  Repair: "repair",
  /** Ask a nearby player to trade. */
  TradeRequest: "tradeRequest",
  /** Accept or decline a pending trade request. */
  TradeRespond: "tradeRespond",
  /** Replace my current trade offer (items + coins). */
  TradeOffer: "tradeOffer",
  /** Confirm my current offer (fires the swap when both sides confirm). */
  TradeConfirm: "tradeConfirm",
  /** Cancel/close the active trade or pending request. */
  TradeCancel: "tradeCancel",
  /** Post a buy/sell order to the Exchange (escrows items/coins). */
  ExchangePost: "exchangePost",
  /** Cancel one of my open orders (returns escrow + pending collection). */
  ExchangeCancel: "exchangeCancel",
  /** Collect a filled order's proceeds/bought items into my bag. */
  ExchangeCollect: "exchangeCollect",
  /** Ask for my orders + the price feed for an item. */
  RequestExchange: "requestExchange",
  /** Challenge a nearby player to a duel (consensual PvP, no item loss). */
  DuelRequest: "duelRequest",
  /** Accept or decline a pending duel challenge. */
  DuelRespond: "duelRespond",
  /** Accept an available quest. */
  QuestAccept: "questAccept",
  /** Turn in a quest whose objectives are met. */
  QuestComplete: "questComplete",
  /** Talk to an NPC (advances talk objectives; proximity-checked). */
  Talk: "talk",
  /** Buy an item from a vendor (proximity-checked). */
  Buy: "buy",
  /** Sell an item to a vendor (proximity-checked). */
  Sell: "sell",
  /** Add a player (by display name) to the friends list. */
  FriendAdd: "friendAdd",
  /** Remove a name from the friends list. */
  FriendRemove: "friendRemove",
  /** Ask for the friends list with live presence. */
  RequestFriends: "requestFriends",
  /** Invite a player (by display name) to your party. */
  PartyInvite: "partyInvite",
  /** Accept your pending party invite. */
  PartyAccept: "partyAccept",
  /** Leave your current party. */
  PartyLeave: "partyLeave",
  /** Ask for current party state. */
  RequestParty: "requestParty",
  /** Found a new guild (name + tag). */
  GuildCreate: "guildCreate",
  /** Invite a player (by display name) to your guild. */
  GuildInvite: "guildInvite",
  /** Accept your pending guild invite. */
  GuildAccept: "guildAccept",
  /** Leave your guild (leader hands off or disbands when last out). */
  GuildLeave: "guildLeave",
  /** Kick a member (rank-gated). */
  GuildKick: "guildKick",
  /** Promote/demote a member between officer and member (leader only). */
  GuildSetRank: "guildSetRank",
  /** Ask for current guild state. */
  RequestGuild: "requestGuild",
} as const;

/** Server → client message types. */
export const ServerMessage = {
  Welcome: "welcome",
  CombatEvent: "combat",
  Chat: "chatMsg",
  Transfer: "transfer",
  LevelUp: "levelUp",
  Inventory: "inventory",
  Equipment: "equipment",
  Bank: "bank",
  Quests: "quests",
  Friends: "friends",
  Party: "party",
  Guild: "guild",
  /** The owner's live trade state (offers + confirmations, or a pending request). */
  Trade: "trade",
  /** The owner's Exchange orders + a price feed for the viewed item. */
  Exchange: "exchange",
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

/** Chat channels a client can post to (whisper is its own message). */
export type ChatChannel = "zone" | "global" | "guild";

/** Channels a displayed line can belong to (adds whisper for the UI). */
export type ChatDisplayChannel = ChatChannel | "whisper";

/** Client → server: say something. Server validates, censors, rebroadcasts. */
export interface ChatPayload {
  channel: ChatChannel;
  text: string;
}

/** Client → server: a private message to a player by display name. */
export interface WhisperPayload {
  to: string;
  text: string;
}

/** Server → client: a (already censored) chat line to display. */
export interface ChatBroadcastPayload {
  channel: ChatDisplayChannel;
  /** Display name of the sender. */
  from: string;
  /** Zone the sender was in (shown for global messages). */
  zone: string;
  text: string;
  /** Server timestamp (ms). */
  at: number;
  /** Whisper recipient's display name (whisper channel only). */
  to?: string;
}

/**
 * Server → client: you walked into a zone exit — leave this room and join
 * `zone`, asking for spawn point `entry`. The target room re-validates the
 * entry name; the client can't teleport anywhere the server didn't offer.
 */
export interface TransferPayload {
  zone: string;
  entry: string;
  /** Instance ticket for a dungeon target — routes the party to one instance
   *  (Colyseus filterBy) and authorizes the join. Absent for overworld zones. */
  ticket?: string;
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

/**
 * Server → client: your full inventory (sent only to the owner, on join and
 * after any change). Inventory is deliberately NOT in the synced ZoneState —
 * that would broadcast every player's bag to everyone. The server is the sole
 * authority; the client just renders what it's told.
 */
export interface InventoryPayload {
  slots: ItemStack[];
}

/** Client → server: equip one unit of this item from the bag into its slot. */
export interface EquipPayload {
  itemId: string;
}

/** Client → server: unequip a gear slot back into the bag. */
export interface UnequipPayload {
  slot: EquipSlot;
}

/** Client → server: pick up a ground-loot pile by its id. */
export interface PickupPayload {
  lootId: string;
}

/** Client → server: start gathering the resource node with this id. */
export interface GatherPayload {
  nodeId: string;
}

/** Client → server: craft one of this recipe from bag inputs. */
export interface CraftPayload {
  recipeId: string;
}

/** Client → server: eat/consume one of this item to heal. */
export interface ConsumePayload {
  itemId: string;
}

/** Client → server: accept / turn in a quest by id. */
export interface QuestActionPayload {
  questId: string;
}

/** Client → server: talk to an NPC by id (proximity-checked server-side). */
export interface TalkPayload {
  npcId: string;
}

/** Client → server: buy/sell `qty` of an item at a vendor (proximity-checked). */
export interface TradePayload {
  vendorId: string;
  itemId: string;
  qty: number;
}

/** Client → server: add/remove a friend by display name. */
export interface FriendActionPayload {
  name: string;
}

/** One friends-list row with live presence. */
export interface FriendEntry {
  name: string;
  online: boolean;
  /** Zone the friend is currently in (online only). */
  zone?: string;
}

/** Server → client: the owner's friends list (sent on request and change). */
export interface FriendsPayload {
  friends: FriendEntry[];
}

/** Client → server: invite a player to your party by display name. */
export interface PartyInvitePayload {
  name: string;
}

/** One party-roster row with live presence. */
export interface PartyMemberEntry {
  name: string;
  leader: boolean;
  online: boolean;
  /** Zone the member is currently in (online only). */
  zone?: string;
}

/** Server → client: your party roster (empty members = not in a party). */
export interface PartyPayload {
  members: PartyMemberEntry[];
  /** Who invited you, when you have a pending invite. */
  invitedBy?: string;
}

/** Client → server: ask a player (by display name) to trade. */
export interface TradeRequestPayload {
  name: string;
}

/** Client → server: accept or decline a pending trade request. */
export interface TradeRespondPayload {
  accept: boolean;
}

/** Client → server: replace my current trade offer (full desired offer). */
export interface TradeOfferPayload {
  items: ItemStack[];
  coins: number;
}

/** One side of a trade as shown to the client. */
export interface TradeParticipant {
  name: string;
  items: ItemStack[];
  coins: number;
  confirmed: boolean;
}

/** Server → client: the owner's live trade state. */
export interface TradeStatePayload {
  active: boolean;
  /** My offer (active trade only). */
  me?: TradeParticipant;
  /** My partner's offer (active trade only). */
  them?: TradeParticipant;
  /** A pending incoming request from this player (no active trade yet). */
  requestFrom?: string;
}

/** Client → server: post an Exchange order. */
export interface ExchangePostPayload {
  side: "buy" | "sell";
  itemId: string;
  qty: number;
  price: number;
}

/** Client → server: cancel/collect an order, or request the book for an item. */
export interface ExchangeActionPayload {
  orderId: string;
}
export interface RequestExchangePayload {
  /** Item to fetch the price feed for (omitted = just my orders). */
  itemId?: string | undefined;
}

/** Client → server: challenge a player (by display name) to a duel. */
export interface DuelRequestPayload {
  name: string;
}

/** Client → server: accept/decline the pending duel challenge. */
export interface DuelRespondPayload {
  accept: boolean;
}

/** One of the owner's Exchange orders (with pending collection). */
export interface ExchangeOrderEntry {
  id: string;
  side: "buy" | "sell";
  itemId: string;
  qty: number;
  remaining: number;
  price: number;
  coinsToCollect: number;
  itemsToCollect: number;
}

export interface ExchangePricePoint {
  price: number;
  qty: number;
  at: number;
}

/** Server → client: the owner's orders + optional price feed for a viewed item. */
export interface ExchangePayload {
  orders: ExchangeOrderEntry[];
  item?: string;
  prices?: ExchangePricePoint[];
}

/** Client → server: found a guild. */
export interface GuildCreatePayload {
  name: string;
  tag: string;
}

/** Client → server: guild action on a player by display name. */
export interface GuildActionPayload {
  name: string;
}

/** Client → server: set a member's rank (leader only; officer/member). */
export interface GuildSetRankPayload {
  name: string;
  rank: "officer" | "member";
}

/** One guild-roster row with live presence. */
export interface GuildMemberEntry {
  name: string;
  rank: "leader" | "officer" | "member";
  online: boolean;
  zone?: string;
}

/** Server → client: your guild state (no `name` = not in a guild). */
export interface GuildPayload {
  name?: string;
  tag?: string;
  myRank?: "leader" | "officer" | "member";
  members: GuildMemberEntry[];
  /** Pending invite, when you have one. */
  invitedTo?: { guildName: string; by: string };
}

/** One quest's state on the wire (mirrors systems/quests QuestProgress). */
export interface QuestEntry {
  questId: string;
  status: "active" | "complete";
  progress: number[];
}

/** Server → client: the owner's full quest log (sent on change). */
export interface QuestsPayload {
  quests: QuestEntry[];
}

/** Client → server: move `qty` of an item between bag and bank (near a bank). */
export interface BankMovePayload {
  itemId: string;
  qty: number;
}

/** Server → client: the owner's bank contents (sent when at a bank). */
export interface BankPayload {
  slots: ItemStack[];
}

/**
 * Server → client: the owner's equipped gear (slot → item id). Like inventory,
 * sent only to the owner (on request and after any change), never in synced
 * state. P3.2 uses it for bonuses; visible worn gear on other players is later.
 */
export interface EquipmentPayload {
  equipment: Partial<Record<EquipSlot, string>>;
  /** Remaining durability per owned gear item id (P8). Missing = undamaged. */
  durability?: Record<string, number>;
}
