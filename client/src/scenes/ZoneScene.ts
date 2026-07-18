import Phaser from "phaser";
import {
  ABILITIES,
  ClientMessage,
  MOVE_SPEED,
  ServerMessage,
  type AbilityId,
  type CombatEventPayload,
  type JoinZoneOptions,
  type TransferPayload,
  type ChatBroadcastPayload,
  type LevelUpPayload,
  type InventoryPayload,
  type EquipmentPayload,
  type BankPayload,
  PICKUP_RANGE,
  distSq,
} from "@mmo/shared";
import { stepWithCollision } from "@mmo/shared/systems/collision";
import { levelForXp } from "@mmo/shared/systems/progression";
import { canAdd } from "@mmo/shared/systems/inventory";
import { abilityKitFor, basicAbilityFor } from "@mmo/shared/systems/weapons";
import { ITEMS, type EquipSlot } from "@mmo/shared/data/items";
import { BANKS, nearBank } from "@mmo/shared/data/banks";
import { NODES, RESOURCES } from "@mmo/shared/data/resources";
import { ZONES, DEFAULT_ZONE, mapForId, type ZoneId } from "@mmo/shared/data/zones";
import { MOBS } from "@mmo/shared/data/mobs";
import type { ZoneMap } from "@mmo/shared/systems/zonemap";
import type { EnemySchema, PlayerSchema, GroundLootSchema } from "@mmo/shared/schema/state";
import type { ZoneConnection } from "../net/room";
import { EntityView } from "../ui/EntityView";
import { TouchControls } from "../ui/TouchControls";
import { ChatBox } from "../ui/ChatBox";
import { AbilityBar } from "../ui/AbilityBar";
import { InventoryPanel } from "../ui/InventoryPanel";
import { BankPanel } from "../ui/BankPanel";
import { CraftPanel } from "../ui/CraftPanel";
import { QuestPanel } from "../ui/QuestPanel";
import { DialoguePanel } from "../ui/DialoguePanel";
import { ShopPanel } from "../ui/ShopPanel";
import { FriendsPanel } from "../ui/FriendsPanel";
import { PartyPanel } from "../ui/PartyPanel";
import { GuildPanel } from "../ui/GuildPanel";
import { TradePanel } from "../ui/TradePanel";
import { ExchangePanel } from "../ui/ExchangePanel";
import type {
  ItemStack,
  FriendEntry,
  FriendsPayload,
  PartyPayload,
  GuildPayload,
  TradeStatePayload,
  ExchangePayload,
  HuntPayload,
  AchievementsPayload,
  MountPayload,
  PerksPayload,
} from "@mmo/shared";
import { withEquipped, type QuestLog } from "@mmo/shared/systems/quests";
import { npcsInZone, type NpcDef } from "@mmo/shared/data/npcs";
import { vendorsInZone, type VendorDef } from "@mmo/shared/data/vendors";
import { waystonesInZone, type WaystoneDef } from "@mmo/shared/data/waystones";
import { FastTravelPanel } from "../ui/FastTravelPanel";
import {
  ensureArtTextures,
  paintZoneTexture,
  paintWaterOverlay,
  applyAtmosphere,
  addLandmarkGlow,
  sparkBurst,
  levelUpBurst,
} from "../render/artkit";
import { TutorialGuide } from "../ui/TutorialGuide";
import { SettingsPanel } from "../ui/SettingsPanel";
import { PerksPanel } from "../ui/PerksPanel";
import { loadSettings, type Settings } from "../settings";

const RECONCILE_SNAP = 64; // px of drift beyond which we hard-snap the local player
const REMOTE_LERP = 0.25; // interpolation factor for remote entities
const PLAYER_HALF = 12; // must match the server's collision box half-extent

// Terrain + entity art now live in render/artkit.ts (the procedural art kit).

/**
 * The playable zone. Renders authoritative server state, predicts the local
 * player's movement for responsiveness, and forwards player intent (move /
 * attack) to the server. It never resolves combat or trusts its own positions —
 * the server is authoritative.
 */
export class ZoneScene extends Phaser.Scene {
  private connection!: ZoneConnection;
  private localSessionId = "";

  private readonly players = new Map<string, EntityView>();
  private readonly enemies = new Map<string, EntityView>();
  /** Boss telegraph danger circles, keyed by enemy id. */
  private readonly telegraphs = new Map<string, Phaser.GameObjects.Arc>();
  /** Ground-loot pile markers, keyed by loot id. */
  private readonly lootViews = new Map<string, Phaser.GameObjects.Container>();
  /** Last walk-over pickup attempt per loot id (throttles the auto-send). */
  private readonly lootAttemptAt = new Map<string, number>();

  private predicted = { x: 0, y: 0 };
  private predictionReady = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private escKey!: Phaser.Input.Keyboard.Key;

  private selectedTargetId: string | null = null;
  private selectionRing!: Phaser.GameObjects.Arc;

  private lastSentDir = { dx: 0, dy: 0 };
  private lastMoveSentAt = 0;

  /** On-screen joystick + attack button; only created on touch devices. */
  private touch?: TouchControls;
  /** Ability bar UI (energy meter + per-ability cooldowns). */
  private abilityBar?: AbilityBar;
  /** Inventory panel UI (toggled with the I key). */
  private inventory?: InventoryPanel;
  /** Last inventory the server sent us (also surfaced to the test API). */
  private inventorySlots: ItemStack[] = [];
  /** Last equipment the server sent us (also surfaced to the test API). */
  private equipmentSlots: Partial<Record<EquipSlot, string>> = {};
  private equipmentDurability: Record<string, number> = {};
  /** Bank panel + its last-known contents; only usable at a town bank. */
  private bankPanel?: BankPanel;
  private bankSlots: ItemStack[] = [];
  /** Whether the local player is currently standing at a bank. */
  private atBank = false;
  /** Crafting panel (toggle C). */
  private craftPanel?: CraftPanel;
  /** Quest log panel (toggle J) + last-known quest log. */
  private questPanel?: QuestPanel;
  private questLog: QuestLog = [];
  /** NPC conversation panel (opens on talk). */
  private dialogue?: DialoguePanel;
  /** Vendor shop panel (opens on clicking a vendor). */
  private shop?: ShopPanel;
  /** Friends panel (toggle F) + last-known list. */
  private friendsPanel?: FriendsPanel;
  private friendsList: FriendEntry[] = [];
  /** Party panel (toggle P) + last-known roster. */
  private partyPanel?: PartyPanel;
  private partyState: PartyPayload = { members: [] };
  /** Guild panel (toggle G) + last-known state. */
  private guildPanel?: GuildPanel;
  private guildState: GuildPayload = { members: [] };
  /** Trade panel (toggle T) + last-known trade state. */
  private tradePanel?: TradePanel;
  private tradeState: TradeStatePayload = { active: false };
  /** Exchange panel (toggle X) + last-known state. */
  private exchangePanel?: ExchangePanel;
  private exchangeState: ExchangePayload = { orders: [] };
  /** Fast-travel (waystone) panel. */
  private fastTravelPanel?: FastTravelPanel;
  /** Last-known hunt state (task + points). */
  private huntState: HuntPayload = { task: null, points: 0 };
  /** Last-known achievements state. */
  private achievementsState: AchievementsPayload = { list: [], title: "" };
  /** Whether the player owns a mount (P11). */
  private mountOwned = false;
  /** Player settings (rebindable keys + toggles) and the pages that edit them. */
  /** Ability kit + basic attack for the equipped weapon class (P13). */
  private weaponKit: AbilityId[] = abilityKitFor(undefined);
  private basicAbility: AbilityId = basicAbilityFor(undefined);
  private settings: Settings = loadSettings();
  private settingsPanel?: SettingsPanel;
  private tutorial?: TutorialGuide;
  /** The Melee skill tree (toggle K) + last-known chosen perks. */
  private perksPanel?: PerksPanel;
  private chosenPerks: string[] = [];

  /** The current zone's map; resolved from server state on the first frame. */
  private map: ZoneMap | undefined = undefined;

  /** DOM chat overlay + zone HUD. */
  private chat?: ChatBox;
  private lastHud = "";

  /** Screen-fixed "you died" banner, shown while the local player is down. */
  private deathText?: Phaser.GameObjects.Text;

  constructor() {
    super("Zone");
  }

  init(data: { connection: ZoneConnection }): void {
    this.connection = data.connection;
    this.localSessionId = data.connection.room.sessionId;
    // Phaser REUSES the scene instance across scene.start() — reset every
    // per-zone field or the new zone inherits the old zone's state. The stale
    // `map` in particular made ensureWorld() skip drawing after EVERY zone
    // transfer (a black world) — latent since P1.3, surfaced by the art
    // audit's post-transfer screenshots.
    this.map = undefined;
    this.players.clear();
    this.enemies.clear();
    this.telegraphs.clear();
    this.lootViews.clear();
    this.lootAttemptAt.clear();
    this.predictionReady = false;
    this.selectedTargetId = null;
    this.atBank = false;
    this.lastSentDir = { dx: 0, dy: 0 };
    this.weaponKit = abilityKitFor(undefined);
    this.basicAbility = basicAbilityFor(undefined);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b0e14");
    // Generate the whole art package (silhouettes, glows, particles) up front.
    ensureArtTextures(this);
    // The tilemap + camera bounds are set on the first state frame, once we
    // know which zone the server put us in (see ensureWorld).

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    // Movement/attack are fixed; every panel + ability key comes from the
    // player's bindings (Settings → Controls). Re-read on each zone load.
    this.settings = loadSettings();
    const bound = [...new Set(Object.values(this.settings.keys))];
    const keyList = `W,A,S,D,SPACE,${bound.join(",")}`;
    this.keys = keyboard.addKeys(keyList) as Record<string, Phaser.Input.Keyboard.Key>;
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    keyboard.addCapture(`${keyList},UP,DOWN,LEFT,RIGHT`);

    this.selectionRing = this.add
      .circle(0, 0, 28)
      .setStrokeStyle(2, 0xffe066)
      .setVisible(false)
      .setDepth(5);

    this.escKey.on("down", () => this.selectTarget(null));

    this.deathText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "You fell — respawning…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#ef4444",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(500)
      .setVisible(false);
    this.scale.on("resize", () =>
      this.deathText?.setPosition(this.scale.width / 2, this.scale.height / 2),
    );

    // On touch / coarse-pointer devices, add the on-screen joystick + attack
    // button. Keyboard handlers stay active too (hybrid devices just work).
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    if (coarse || this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this);
    }

    // DOM chat overlay + HUD. While the chat input is focused, pause keyboard
    // movement so typing doesn't drive the character.
    this.chat = new ChatBox({
      onSend: (channel, text) => this.connection.room.send(ClientMessage.Chat, { channel, text }),
      onWhisper: (to, text) => this.connection.room.send(ClientMessage.Whisper, { to, text }),
      onFocusChange: (focused) => {
        if (this.input.keyboard) this.input.keyboard.enabled = !focused;
      },
    });
    this.events.once("shutdown", () => this.chat?.destroy());

    this.abilityBar = new AbilityBar({ onUse: (id) => this.tryUseAbility(id) });
    this.events.once("shutdown", () => this.abilityBar?.destroy());

    this.inventory = new InventoryPanel({
      onEquip: (itemId) => this.connection.room.send(ClientMessage.Equip, { itemId }),
      onUnequip: (slot) => this.connection.room.send(ClientMessage.Unequip, { slot }),
      onConsume: (itemId) => this.connection.room.send(ClientMessage.Consume, { itemId }),
    });
    this.inventory.setInventory(this.inventorySlots);
    this.inventory.setEquipment(this.equipmentSlots, this.equipmentDurability);
    this.events.once("shutdown", () => this.inventory?.destroy());

    this.craftPanel = new CraftPanel({
      onCraft: (recipeId) => this.connection.room.send(ClientMessage.Craft, { recipeId }),
    });
    this.events.once("shutdown", () => this.craftPanel?.destroy());

    this.questPanel = new QuestPanel({
      onAccept: (questId) => this.connection.room.send(ClientMessage.QuestAccept, { questId }),
      onComplete: (questId) => this.connection.room.send(ClientMessage.QuestComplete, { questId }),
    });
    this.events.once("shutdown", () => this.questPanel?.destroy());

    this.dialogue = new DialoguePanel({
      onAccept: (questId) => this.connection.room.send(ClientMessage.QuestAccept, { questId }),
      onComplete: (questId) => this.connection.room.send(ClientMessage.QuestComplete, { questId }),
      onBuyMount: () => this.connection.room.send(ClientMessage.BuyMount),
      onBgQueue: () => this.connection.room.send(ClientMessage.BgQueue),
    });
    this.events.once("shutdown", () => this.dialogue?.destroy());

    this.shop = new ShopPanel({
      onBuy: (vendorId, itemId, qty) => this.connection.room.send(ClientMessage.Buy, { vendorId, itemId, qty }),
      onSell: (vendorId, itemId, qty) => this.connection.room.send(ClientMessage.Sell, { vendorId, itemId, qty }),
      onRepair: () => this.connection.room.send(ClientMessage.Repair),
    });
    this.events.once("shutdown", () => this.shop?.destroy());

    this.friendsPanel = new FriendsPanel({
      onAdd: (name) => this.connection.room.send(ClientMessage.FriendAdd, { name }),
      onRemove: (name) => this.connection.room.send(ClientMessage.FriendRemove, { name }),
      onRefresh: () => this.connection.room.send(ClientMessage.RequestFriends),
    });
    // Pause Phaser keyboard while typing a friend's name (same as chat).
    const friendsInput = document.getElementById("friends-input");
    friendsInput?.addEventListener("focus", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    friendsInput?.addEventListener("blur", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    this.events.once("shutdown", () => this.friendsPanel?.destroy());

    this.partyPanel = new PartyPanel({
      onInvite: (name) => this.connection.room.send(ClientMessage.PartyInvite, { name }),
      onAccept: () => this.connection.room.send(ClientMessage.PartyAccept),
      onLeave: () => this.connection.room.send(ClientMessage.PartyLeave),
      onRefresh: () => this.connection.room.send(ClientMessage.RequestParty),
    });
    const partyInput = document.getElementById("party-input");
    partyInput?.addEventListener("focus", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    partyInput?.addEventListener("blur", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    this.events.once("shutdown", () => this.partyPanel?.destroy());

    this.guildPanel = new GuildPanel({
      onCreate: (name, tag) => this.connection.room.send(ClientMessage.GuildCreate, { name, tag }),
      onInvite: (name) => this.connection.room.send(ClientMessage.GuildInvite, { name }),
      onAccept: () => this.connection.room.send(ClientMessage.GuildAccept),
      onLeave: () => this.connection.room.send(ClientMessage.GuildLeave),
      onKick: (name) => this.connection.room.send(ClientMessage.GuildKick, { name }),
      onSetRank: (name, rank) => this.connection.room.send(ClientMessage.GuildSetRank, { name, rank }),
      onRefresh: () => this.connection.room.send(ClientMessage.RequestGuild),
    });
    // The guild panel builds its inputs dynamically — pause Phaser keys for any
    // focused field inside it (focusin/focusout bubble; focus/blur don't).
    const guildRoot = document.getElementById("guild");
    guildRoot?.addEventListener("focusin", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    guildRoot?.addEventListener("focusout", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    this.events.once("shutdown", () => this.guildPanel?.destroy());

    this.tradePanel = new TradePanel({
      onRequest: (name) => this.connection.room.send(ClientMessage.TradeRequest, { name }),
      onRespond: (accept) => this.connection.room.send(ClientMessage.TradeRespond, { accept }),
      onOffer: (items, coins) => this.connection.room.send(ClientMessage.TradeOffer, { items, coins }),
      onConfirm: () => this.connection.room.send(ClientMessage.TradeConfirm),
      onCancel: () => this.connection.room.send(ClientMessage.TradeCancel),
    });
    const tradeRoot = document.getElementById("trade");
    tradeRoot?.addEventListener("focusin", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    tradeRoot?.addEventListener("focusout", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    this.events.once("shutdown", () => this.tradePanel?.destroy());

    this.exchangePanel = new ExchangePanel({
      onPost: (side, itemId, qty, price) =>
        this.connection.room.send(ClientMessage.ExchangePost, { side, itemId, qty, price }),
      onCancel: (orderId) => this.connection.room.send(ClientMessage.ExchangeCancel, { orderId }),
      onCollect: (orderId) => this.connection.room.send(ClientMessage.ExchangeCollect, { orderId }),
      onRefresh: (itemId) =>
        this.connection.room.send(ClientMessage.RequestExchange, itemId ? { itemId } : {}),
    });
    const exchangeRoot = document.getElementById("exchange");
    exchangeRoot?.addEventListener("focusin", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = false;
    });
    exchangeRoot?.addEventListener("focusout", () => {
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    });
    this.events.once("shutdown", () => this.exchangePanel?.destroy());

    this.fastTravelPanel = new FastTravelPanel({
      onTravel: (destId) => this.connection.room.send(ClientMessage.FastTravel, { to: destId }),
    });
    this.events.once("shutdown", () => this.fastTravelPanel?.destroy());

    this.perksPanel = new PerksPanel({
      onChoose: (id) => this.connection.room.send(ClientMessage.ChoosePerk, { id }),
      onRespec: () => this.connection.room.send(ClientMessage.RespecPerks),
      onRefresh: () => this.connection.room.send(ClientMessage.RequestPerks),
    });
    this.events.once("shutdown", () => this.perksPanel?.destroy());

    // Settings (⚙ button) + the first-launch tutorial (skippable).
    this.tutorial = new TutorialGuide();
    this.settingsPanel = new SettingsPanel({
      onChange: (s) => {
        this.settings = s;
        // Register any newly bound keys NOW — the update loop reads
        // this.keys[bind.*] immediately, and an unregistered key crashes
        // JustDown every frame (the game "freezes" after a rebind).
        const kb = this.input.keyboard;
        if (kb) {
          for (const name of Object.values(s.keys)) {
            if (!this.keys[name]) this.keys[name] = kb.addKey(name);
          }
          kb.addCapture(Object.values(s.keys).join(","));
        }
      },
      onReplayTutorial: () => this.tutorial?.maybeShow(true),
    });
    const gear = document.getElementById("settings-gear");
    if (gear) {
      gear.style.display = "block";
      gear.onclick = () => {
        this.settingsPanel?.toggle();
        gear.blur(); // else a later Space (attack) "clicks" the still-focused gear
      };
    }
    this.events.once("shutdown", () => {
      this.settingsPanel?.destroy();
      this.tutorial?.destroy();
    });
    this.tutorial.maybeShow();

    this.bankPanel = new BankPanel({
      onDeposit: (itemId, qty) => this.connection.room.send(ClientMessage.Deposit, { itemId, qty }),
      onWithdraw: (itemId, qty) => this.connection.room.send(ClientMessage.Withdraw, { itemId, qty }),
    });
    this.events.once("shutdown", () => this.bankPanel?.destroy());

    this.setupStateSync();
    this.setupMessages();
    this.exposeTestApi();
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const room = this.connection.room;

    // The schema state streams in shortly AFTER join. On a remote server the
    // first few frames run before it arrives (invisible on localhost, where
    // it's sub-millisecond) — touching room.state.players.get() then throws
    // "Cannot read properties of undefined" and freezes the render loop.
    // Bail until the synced collections exist.
    if (!room.state?.players || !room.state.enemies) return;

    // Draw the zone's tilemap once we know which zone we're in.
    this.ensureWorld();

    // Zone + character HUD (name, player count, skill levels), refreshed only
    // when the string changes. Melee level is authoritative on the schema;
    // Vitality is derived from its XP with the same shared curve the server uses.
    const me = room.state.players.get(this.localSessionId);
    const meleeLvl = me?.level ?? 1;
    const vitalityLvl = me ? levelForXp(me.vitalityXp) : 1;
    const rangedLvl = me ? levelForXp(me.rangedXp) : 1;
    const magicLvl = me ? levelForXp(me.magicXp) : 1;
    const miningLvl = me ? levelForXp(me.miningXp) : 1;
    const fishingLvl = me ? levelForXp(me.fishingXp) : 1;
    const smithingLvl = me ? levelForXp(me.smithingXp) : 1;
    const cookingLvl = me ? levelForXp(me.cookingXp) : 1;
    const hud =
      `${this.map?.displayName ?? ""} — ${room.state.players.size} online` +
      ` · ⚔${meleeLvl} · 🏹${rangedLvl} · ✨${magicLvl} · ♥${vitalityLvl} · ⛏${miningLvl} · 🎣${fishingLvl}` +
      ` · 🔨${smithingLvl} · 🍳${cookingLvl}` +
      (me && me.restedXp > 0 ? " · 💤 rested" : "");
    if (hud !== this.lastHud) {
      this.lastHud = hud;
      // Titled segments: hovering a stat explains what it does (play-test ask).
      const parts: { text: string; tip?: string }[] = [
        { text: `${this.map?.displayName ?? ""} — ${room.state.players.size} online` },
        { text: `⚔${meleeLvl}`, tip: `Melee ${meleeLvl} — accuracy and max hit; levels from landing blows.` },
        { text: `🏹${rangedLvl}`, tip: `Ranged ${rangedLvl} — bow accuracy and damage; train it by fighting with a bow.` },
        { text: `✨${magicLvl}`, tip: `Magic ${magicLvl} — kindled staff accuracy and damage; train it by fighting with a staff.` },
        { text: `♥${vitalityLvl}`, tip: `Vitality ${vitalityLvl} — raises max HP; levels alongside combat.` },
        { text: `⛏${miningLvl}`, tip: `Mining ${miningLvl} — which rocks you can work and how reliably.` },
        { text: `🎣${fishingLvl}`, tip: `Fishing ${fishingLvl} — which waters you can fish and how reliably.` },
        { text: `🔨${smithingLvl}`, tip: `Smithing ${smithingLvl} — smelt bars and forge gear at the forge (C).` },
        { text: `🍳${cookingLvl}`, tip: `Cooking ${cookingLvl} — turn raw catches into healing food (C).` },
      ];
      if (me && me.restedXp > 0) {
        parts.push({ text: "💤 rested", tip: "Rested — +50% XP while this bonus lasts (earned offline)." });
      }
      this.chat?.setHudParts(parts);
    }

    // --- read input → movement intent (keyboard digital + joystick analog)
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys["A"]!.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys["D"]!.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys["W"]!.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys["S"]!.isDown) dy += 1;
    if (this.touch) {
      const v = this.touch.moveVector();
      if (v.dx !== 0 || v.dy !== 0) {
        dx = v.dx;
        dy = v.dy;
      }
    }

    // Throttle move intents: the analog joystick changes every frame, but the
    // room caps inbound messages (maxMessagesPerSecond). Send on a meaningful
    // change at ~12/s, and always send the stop immediately.
    const now = performance.now();
    const moveChanged =
      Math.abs(dx - this.lastSentDir.dx) > 0.08 || Math.abs(dy - this.lastSentDir.dy) > 0.08;
    const stopped = dx === 0 && dy === 0 && (this.lastSentDir.dx !== 0 || this.lastSentDir.dy !== 0);
    if (stopped || (moveChanged && now - this.lastMoveSentAt >= 80)) {
      room.send(ClientMessage.Move, { dx, dy });
      this.lastSentDir = { dx, dy };
      this.lastMoveSentAt = now;
    }

    // --- local player prediction + reconciliation
    const self = room.state.players.get(this.localSessionId);
    if (self && this.map) {
      if (!this.predictionReady) {
        this.predicted = { x: self.x, y: self.y };
        this.predictionReady = true;
      }
      if (!self.alive) {
        // While dead, don't predict — just follow the authoritative position
        // (it snaps to the respawn point when the server revives us).
        this.predicted = { x: self.x, y: self.y };
      } else {
        this.predicted = stepWithCollision(
          this.predicted,
          { dx, dy },
          dt,
          MOVE_SPEED,
          this.map.collision,
          PLAYER_HALF,
        );
        const drift = Phaser.Math.Distance.Between(
          this.predicted.x,
          this.predicted.y,
          self.x,
          self.y,
        );
        if (drift > RECONCILE_SNAP) {
          this.predicted = { x: self.x, y: self.y };
        } else if (drift > 2) {
          this.predicted.x = Phaser.Math.Linear(this.predicted.x, self.x, 0.1);
          this.predicted.y = Phaser.Math.Linear(this.predicted.y, self.y, 0.1);
        }
      }
    }
    this.deathText?.setVisible(!!self && !self.alive);

    // --- render entities from authoritative state
    room.state.players.forEach((player, sessionId) => {
      const view = this.players.get(sessionId);
      if (!view) return;
      if (sessionId === this.localSessionId) {
        view.setPosition(this.predicted.x, this.predicted.y);
      } else {
        view.lerpTo(player.x, player.y, REMOTE_LERP);
      }
      view.setHp(player.hp, player.maxHp);
      view.setAlive(player.alive);
      view.setMounted(player.mounted);
      view.setSkulled(player.skullUntil > Date.now());
      view.setTitle(player.title);
    });
    room.state.enemies.forEach((enemy, id) => {
      const view = this.enemies.get(id);
      if (!view) return;
      view.lerpTo(enemy.x, enemy.y, REMOTE_LERP);
      view.setHp(enemy.hp, enemy.maxHp);
      view.setAlive(enemy.alive);
      this.updateTelegraph(id, enemy);
    });

    this.updateSelectionRing();

    // --- abilities: refresh the bar (energy + cooldowns), then handle input
    if (self) this.abilityBar?.setEnergy(self.energy, self.maxEnergy);
    this.abilityBar?.render();

    // 1/2/3 fire on press; held Space (or the touch button) auto-repeats the
    // basic Strike whenever it comes off the global cooldown.
    const bind = this.settings.keys;
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.ability1]!)) this.tryUseAbility(this.weaponKit[0]!);
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.ability2]!)) this.tryUseAbility(this.weaponKit[1]!);
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.ability3]!)) this.tryUseAbility(this.weaponKit[2]!);
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.inventory]!)) this.inventory?.toggle();

    // Bank: fetch contents when you arrive at one; B toggles the panel there;
    // walking away closes it.
    const nowAtBank = !!this.map && nearBank(this.map.id, this.predicted.x, this.predicted.y);
    if (nowAtBank !== this.atBank) {
      this.atBank = nowAtBank;
      if (nowAtBank) room.send(ClientMessage.RequestBank);
      else this.bankPanel?.toggle(false);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.bank]!) && this.atBank) this.bankPanel?.toggle();

    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.quests]!)) this.questPanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.friends]!)) this.friendsPanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.party]!)) this.partyPanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.guild]!)) this.guildPanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.trade]!)) this.tradePanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.exchange]!)) this.exchangePanel?.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.mount]!)) {
      this.connection.room.send(ClientMessage.ToggleMount);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.skills]!)) this.perksPanel?.toggle();
    this.perksPanel?.setMeleeLevel(self?.level ?? 1);

    // Crafting panel (C); refresh its skill gates from live XP while open.
    if (Phaser.Input.Keyboard.JustDown(this.keys[bind.craft]!)) this.craftPanel?.toggle();
    if (this.craftPanel?.isOpen() && me) {
      this.craftPanel.setLevels({
        smithing: levelForXp(me.smithingXp),
        cooking: levelForXp(me.cookingXp),
      });
    }
    if (this.keys["SPACE"]!.isDown || (this.touch?.attackHeld() ?? false)) {
      this.tryUseAbility(this.basicAbility);
    }

    // Walk-over auto-pickup: your own drops hoover up as you step on them
    // (play-test ask — no clicking corpse-covered piles). Public piles stay
    // click-to-take so you can't vacuum someone else's loot by strolling by.
    if (self?.alive) {
      const now = Date.now();
      this.connection.room.state.loot.forEach((loot, id: string) => {
        if (loot.ownerId !== this.connection.room.sessionId) return;
        if (distSq(self.x, self.y, loot.x, loot.y) > PICKUP_RANGE * PICKUP_RANGE) return;
        const def = ITEMS[loot.itemId];
        // Skip what can't fit — the server would refuse anyway (and nag).
        if (!def || !canAdd(this.inventorySlots, loot.itemId, loot.qty, def.maxStack)) return;
        if (now - (this.lootAttemptAt.get(id) ?? 0) < 1000) return;
        this.lootAttemptAt.set(id, now);
        this.connection.room.send(ClientMessage.Pickup, { lootId: id });
      });
    }
  }

  /** Client-side gate (target/energy/cooldown) then send the ability intent. */
  private tryUseAbility(id: AbilityId): void {
    const room = this.connection.room;
    const self = room.state.players.get(this.localSessionId);
    if (!self || !self.alive || !this.abilityBar) return;
    if (!this.abilityBar.canUse(id, self.energy)) return;

    if (ABILITIES[id].kind === "heal") {
      room.send(ClientMessage.UseAbility, { abilityId: id, targetId: this.localSessionId });
    } else {
      if (!this.selectedTargetId) return; // attacks need a target
      room.send(ClientMessage.UseAbility, { abilityId: id, targetId: this.selectedTargetId });
    }
    this.abilityBar.markUsed(id);
  }

  // --- setup -----------------------------------------------------------------

  private setupStateSync(): void {
    const { room, $ } = this.connection;

    $(room.state).players.onAdd((player: PlayerSchema, sessionId: string) => {
      const isSelf = sessionId === this.localSessionId;
      const view = new EntityView(this, isSelf ? "self" : "player", {
        x: player.x,
        y: player.y,
        name: player.name,
        onClick: () => {
          if (!isSelf) this.selectTarget(sessionId);
        },
      });
      view.setHp(player.hp, player.maxHp);
      this.players.set(sessionId, view);

      if (isSelf) {
        this.predicted = { x: player.x, y: player.y };
        this.predictionReady = true;
        this.cameras.main.startFollow(view.container, true, 0.12, 0.12);
      }
    });

    $(room.state).players.onRemove((_player: PlayerSchema, sessionId: string) => {
      this.players.get(sessionId)?.destroy();
      this.players.delete(sessionId);
      if (this.selectedTargetId === sessionId) this.selectTarget(null);
    });

    $(room.state).enemies.onAdd((enemy: EnemySchema, id: string) => {
      const view = new EntityView(this, "enemy", {
        x: enemy.x,
        y: enemy.y,
        name: enemy.name,
        color: MOBS[enemy.kind]?.color ?? 0xef4444,
        mobKind: enemy.kind,
        boss: MOBS[enemy.kind]?.boss ?? false,
        onClick: () => this.selectTarget(id),
      });
      view.setHp(enemy.hp, enemy.maxHp);
      this.enemies.set(id, view);
    });

    $(room.state).enemies.onRemove((_enemy: EnemySchema, id: string) => {
      this.enemies.get(id)?.destroy();
      this.enemies.delete(id);
      this.telegraphs.get(id)?.destroy();
      this.telegraphs.delete(id);
      if (this.selectedTargetId === id) this.selectTarget(null);
    });

    $(room.state).loot.onAdd((loot: GroundLootSchema, id: string) => {
      this.lootViews.set(id, this.createLootMarker(loot, id));
    });
    $(room.state).loot.onRemove((_loot: GroundLootSchema, id: string) => {
      this.lootViews.get(id)?.destroy();
      this.lootViews.delete(id);
      this.lootAttemptAt.delete(id);
    });
  }

  /** A clickable ground-loot pile (click to send a pickup intent). */
  private createLootMarker(loot: GroundLootSchema, id: string): Phaser.GameObjects.Container {
    const def = ITEMS[loot.itemId];
    const color =
      loot.itemId === "coins" ? 0xffd34d : def && def.rarity !== "common" ? 0x9bd1ff : 0xd8c08a;
    const dot = this.add.circle(0, 0, 7, color).setStrokeStyle(2, 0x10131a);
    const qty = loot.qty > 1 ? ` x${loot.qty}` : "";
    const label = this.add
      .text(0, -16, `${def?.name ?? loot.itemId}${qty}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#ffe9b0",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    dot.setInteractive({ useHandCursor: true });
    dot.on("pointerdown", () => this.connection.room.send(ClientMessage.Pickup, { lootId: id }));
    // A soft glimmer + gentle bob so drops catch the eye without shouting.
    const glimmer = this.add
      .image(0, 0, "fx-soft")
      .setTint(color)
      .setAlpha(0.35)
      .setScale(2.2)
      .setBlendMode(Phaser.BlendModes.ADD);
    const c = this.add.container(loot.x, loot.y, [glimmer, dot, label]).setDepth(2);
    this.tweens.add({ targets: dot, y: -3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: glimmer, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1 });
    return c;
  }

  private setupMessages(): void {
    // The client already knows its own id via room.sessionId; we still register
    // a handler so the SDK doesn't warn about an unhandled 'welcome' message.
    this.connection.room.onMessage(ServerMessage.Welcome, () => {});

    this.connection.room.onMessage(ServerMessage.CombatEvent, (evt: CombatEventPayload) => {
      const targetView = this.enemies.get(evt.targetId) ?? this.players.get(evt.targetId);
      if (!targetView) return;
      const numbers = this.settings.showDamage;
      if (evt.miss) {
        if (numbers) targetView.floatingMiss();
        return;
      }
      if (evt.heal) {
        if (numbers) targetView.floatingHeal(evt.damage);
        sparkBurst(this, targetView.container.x, targetView.container.y - 10, 0x4ade80, 5);
      } else {
        targetView.hitFlash();
        if (numbers) targetView.floatingDamage(evt.damage);
        sparkBurst(this, targetView.container.x, targetView.container.y - 8, 0xffd166, evt.targetDied ? 12 : 6);
      }
    });

    this.connection.room.onMessage(ServerMessage.LevelUp, (p: LevelUpPayload) => {
      this.showLevelUp(p);
      const me = this.players.get(this.localSessionId);
      if (me) levelUpBurst(this, me.container.x, me.container.y);
    });

    this.connection.room.onMessage(ServerMessage.Inventory, (p: InventoryPayload) => {
      this.showGainToasts(this.inventorySlots, p.slots);
      this.inventorySlots = p.slots;
      this.inventory?.setInventory(p.slots);
      this.bankPanel?.setBag(p.slots);
      this.craftPanel?.setBag(p.slots);
      // Quest views count equipped items too (a worn sword still "counts").
      this.questPanel?.setBag(withEquipped(p.slots, this.equipmentSlots));
      this.dialogue?.setBag(withEquipped(p.slots, this.equipmentSlots));
      this.shop?.setBag(p.slots);
      this.tradePanel?.setBag(p.slots);
    });
    this.connection.room.onMessage(ServerMessage.Quests, (p: { quests: QuestLog }) => {
      this.questLog = p.quests;
      this.questPanel?.setQuests(p.quests);
      this.dialogue?.setQuests(p.quests);
    });
    this.connection.room.onMessage(ServerMessage.Friends, (p: FriendsPayload) => {
      this.friendsList = p.friends;
      this.friendsPanel?.setFriends(p.friends);
    });
    this.connection.room.onMessage(ServerMessage.Party, (p: PartyPayload) => {
      this.partyState = p;
      this.partyPanel?.setParty(p);
    });
    this.connection.room.onMessage(ServerMessage.Guild, (p: GuildPayload) => {
      this.guildState = p;
      this.guildPanel?.setGuild(p);
    });
    this.connection.room.onMessage(ServerMessage.Trade, (p: TradeStatePayload) => {
      this.tradeState = p;
      this.tradePanel?.setTrade(p);
    });
    this.connection.room.onMessage(ServerMessage.Exchange, (p: ExchangePayload) => {
      this.exchangeState = p;
      this.exchangePanel?.setExchange(p);
    });
    this.connection.room.onMessage(ServerMessage.Hunt, (p: HuntPayload) => {
      this.huntState = p;
    });
    this.connection.room.onMessage(ServerMessage.Achievements, (p: AchievementsPayload) => {
      this.achievementsState = p;
    });
    this.connection.room.onMessage(ServerMessage.Mount, (p: MountPayload) => {
      this.mountOwned = p.owned;
      this.dialogue?.setMountOwned(p.owned);
    });
    this.connection.room.onMessage(ServerMessage.Perks, (p: PerksPayload) => {
      this.chosenPerks = p.chosen;
      this.perksPanel?.setPerks(p.chosen);
    });
    this.connection.room.onMessage(ServerMessage.Equipment, (p: EquipmentPayload) => {
      this.equipmentSlots = p.equipment;
      const wType = p.equipment.weapon ? ITEMS[p.equipment.weapon]?.weaponType : undefined;
      this.weaponKit = abilityKitFor(wType);
      this.basicAbility = basicAbilityFor(wType);
      this.abilityBar?.setKit(this.weaponKit);
      this.equipmentDurability = p.durability ?? {};
      this.inventory?.setEquipment(p.equipment, this.equipmentDurability);
      // Keep the quest views' merged bag+gear in sync on equip changes too.
      this.questPanel?.setBag(withEquipped(this.inventorySlots, this.equipmentSlots));
      this.dialogue?.setBag(withEquipped(this.inventorySlots, this.equipmentSlots));
    });
    this.connection.room.onMessage(ServerMessage.Bank, (p: BankPayload) => {
      this.bankSlots = p.slots;
      this.bankPanel?.setBank(p.slots);
    });
    // Now that the handlers exist, pull our inventory + equipment (the server's
    // onJoin push can arrive before these handlers are registered and be dropped).
    this.connection.room.send(ClientMessage.RequestInventory);
    this.connection.room.send(ClientMessage.RequestMount);

    // Zone travel: the server says we stepped on a gate → leave this room and
    // re-boot into the target zone at the named entry. Re-booting cleanly
    // tears down this scene's map/entities for the new zone.
    this.connection.room.onMessage(ServerMessage.Chat, (p: ChatBroadcastPayload) => {
      this.chat?.addMessage(p);
    });

    this.connection.room.onMessage(ServerMessage.Transfer, (p: TransferPayload) => {
      localStorage.setItem("mmo:zone", p.zone);
      const opts = this.registry.get("joinOpts") as JoinZoneOptions;
      // Carry a dungeon ticket into the join; clear any stale one otherwise so
      // it can't leak into the next overworld join.
      const next: JoinZoneOptions = { ...opts, entry: p.entry };
      if (p.ticket) next.ticket = p.ticket;
      else delete next.ticket;
      this.registry.set("joinOpts", next);
      this.registry.set("zone", p.zone);
      void this.connection.room.leave();
      this.scene.start("Boot");
    });
  }

  // --- helpers ---------------------------------------------------------------

  /** Resolve the current zone from server state and draw it once. */
  private ensureWorld(): void {
    if (this.map) return;
    this.map = mapForId(this.connection.room.state.zoneId) ?? ZONES[DEFAULT_ZONE];
    this.drawTilemap(this.map);
    // Overworld furniture (banks/nodes/NPCs/vendors) is keyed by zone id;
    // dungeons simply have none, so every lookup no-ops there.
    const zoneId = this.map.id as ZoneId;
    for (const b of BANKS[zoneId] ?? []) this.drawBankMarker(b.x, b.y);
    for (const n of NODES[zoneId] ?? []) this.drawNodeMarker(n.id, n.type, n.x, n.y);
    for (const npc of npcsInZone(zoneId)) this.drawNpcMarker(npc);
    for (const v of vendorsInZone(zoneId)) this.drawVendorMarker(v);
    for (const w of waystonesInZone(zoneId)) this.drawWaystoneMarker(w);
    // The smith's forge: a visible, clickable place to smelt & craft (the C
    // panel works anywhere, but play-testers looked for a forge — give them one).
    const dorin = npcsInZone(zoneId).find((n) => n.id === "smith_dorin");
    if (dorin) this.drawForgeMarker(dorin.x + 40, dorin.y + 24);
    // Center small zones on large viewports (no top-left pinning): widen the
    // bounds symmetrically when the world is smaller than the screen.
    const vw = this.scale.width;
    const vh = this.scale.height;
    const bx = Math.min(0, -(vw - this.map.pixelWidth) / 2);
    const by = Math.min(0, -(vh - this.map.pixelHeight) / 2);
    this.cameras.main.setBounds(
      bx,
      by,
      Math.max(this.map.pixelWidth, this.map.pixelWidth - 2 * bx),
      Math.max(this.map.pixelHeight, this.map.pixelHeight - 2 * by),
    );
  }

  /** Draw/refresh a boss's telegraphed-AoE danger circle (a "get out" warning). */
  private updateTelegraph(id: string, enemy: EnemySchema): void {
    let arc = this.telegraphs.get(id);
    if (enemy.teleAt <= 0 || !enemy.alive) {
      if (arc) {
        arc.destroy();
        this.telegraphs.delete(id);
      }
      return;
    }
    if (!arc) {
      arc = this.add
        .circle(enemy.teleX, enemy.teleY, enemy.teleRadius, 0xff3020, 0.28)
        .setStrokeStyle(3, 0xff6040, 0.9)
        .setDepth(1); // above the ground, below entities
      this.telegraphs.set(id, arc);
    }
    arc.setPosition(enemy.teleX, enemy.teleY);
    arc.setRadius(enemy.teleRadius);
    // Pulse the fill so the warning reads as urgent while it winds up.
    arc.setFillStyle(0xff3020, 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(this.time.now / 90)));
  }

  /** A clickable vendor: opens the shop panel (the server gates each trade). */
  private drawVendorMarker(vendor: VendorDef): void {
    const dot = this.add
      .star(0, 0, 5, 6, 11, vendor.color)
      .setStrokeStyle(2, 0x10131a)
      .setInteractive({ useHandCursor: true });
    dot.on("pointerdown", () => this.shop?.open(vendor));
    addLandmarkGlow(this, vendor.x, vendor.y, 0xffd166, 0.9);
    const label = this.add
      .text(0, -20, `${vendor.name} 🪙`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffd34d",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    this.add.container(vendor.x, vendor.y, [dot, label]).setDepth(3);
  }

  /** A clickable NPC: opens the conversation and tells the server we talked. */
  private drawNpcMarker(npc: NpcDef): void {
    const dot = this.add
      .circle(0, 0, 11, npc.color)
      .setStrokeStyle(2, 0xffe066)
      .setInteractive({ useHandCursor: true });
    dot.on("pointerdown", () => {
      this.dialogue?.open(npc);
      this.connection.room.send(ClientMessage.Talk, { npcId: npc.id });
    });
    addLandmarkGlow(this, npc.x, npc.y, 0xffe8a3, 0.8);
    const label = this.add
      .text(0, -20, npc.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffe066",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    this.add.container(npc.x, npc.y, [dot, label]).setDepth(3);
  }

  /** A clickable resource node (click to start gathering). */
  private drawNodeMarker(id: string, type: string, x: number, y: number): void {
    const def = RESOURCES[type];
    const dot = this.add
      .circle(0, 0, 9, def?.color ?? 0x9e9e9e)
      .setStrokeStyle(2, 0x10131a)
      .setInteractive({ useHandCursor: true });
    dot.on("pointerdown", () => {
      this.connection.room.send(ClientMessage.Gather, { nodeId: id });
      sparkBurst(this, x, y - 4, def?.color ?? 0x9bd1ff, 5);
    });
    const label = this.add
      .text(0, -18, def?.name ?? type, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#cfe4ff",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    this.add.container(x, y, [dot, label]).setDepth(1);
  }

  /** A clickable waystone (click to open the fast-travel menu). */
  private drawWaystoneMarker(w: WaystoneDef): void {
    const dot = this.add
      .star(0, 0, 4, 6, 13, 0x7dd3fc)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    dot.on("pointerdown", () => this.fastTravelPanel?.open(w.id));
    addLandmarkGlow(this, w.x, w.y, 0x7dd3fc, 1.1);
    const label = this.add
      .text(0, -20, "Waystone", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#7dd3fc",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    this.add.container(w.x, w.y, [dot, label]).setDepth(3);
  }

  /** The clickable forge beside the smith — opens the crafting panel. */
  private drawForgeMarker(x: number, y: number): void {
    addLandmarkGlow(this, x, y, 0xff8a3c, 0.9);
    const anvil = this.add
      .rectangle(0, 0, 20, 12, 0x3a4150)
      .setStrokeStyle(2, 0x1a1f29)
      .setInteractive({ useHandCursor: true });
    anvil.on("pointerdown", () => this.craftPanel?.toggle(true));
    const ember = this.add.image(0, -2, "fx-soft").setTint(0xff8a3c).setAlpha(0.7).setScale(0.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ember, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    const label = this.add
      .text(0, -20, "⚒ Forge (C)", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffb066",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3);
    this.add.container(x, y, [anvil, ember, label]).setDepth(3);
  }

  /** A static "Bank" marker so players can find the town bank. */
  private drawBankMarker(x: number, y: number): void {
    addLandmarkGlow(this, x, y, 0x9ae6b4, 0.8);
    const tile = this.add.rectangle(x, y, 26, 26, 0x2e6f4f).setStrokeStyle(2, 0xffe066).setDepth(-9);
    const label = this.add
      .text(x, y - 22, "🏦 Bank", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffe066",
      })
      .setOrigin(0.5)
      .setStroke("#000", 3)
      .setDepth(-9);
    void tile;
    void label;
  }

  /** Paint the zone once into a canvas texture (the art kit's terrain pass),
   *  then dress it with the zone's atmosphere (vignette, fog, particles). */
  private drawTilemap(map: ZoneMap): void {
    const key = paintZoneTexture(this, map, map.id);
    this.add.image(0, 0, key).setOrigin(0).setDepth(-10);
    // Flowing water/lava: a highlight overlay drifting over the streams.
    const waterKey = paintWaterOverlay(this, map, map.id);
    if (waterKey) {
      const flow = this.add.image(0, 0, waterKey).setOrigin(0).setDepth(-9).setAlpha(0.9);
      this.tweens.add({
        targets: flow,
        x: 5,
        alpha: 0.45,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    applyAtmosphere(this, map.id, map.pixelWidth, map.pixelHeight, this.settings.particles);
  }

  /** Float "+N Item" above the player whenever the bag GAINS something —
   *  mining a rock, landing a catch, crafting, looting, quest rewards. One
   *  diff covers every acquisition path (play-test ask: quiet confirmation). */
  private showGainToasts(prev: ItemStack[], next: ItemStack[]): void {
    if (prev.length === 0 && next.length > 0 && this.lastHud === "") return; // login flood
    const before = new Map<string, number>();
    for (const s of prev) before.set(s.itemId, (before.get(s.itemId) ?? 0) + s.qty);
    const after = new Map<string, number>();
    for (const s of next) after.set(s.itemId, (after.get(s.itemId) ?? 0) + s.qty);
    const me = this.players.get(this.localSessionId);
    if (!me) return;
    let stack = 0;
    after.forEach((qty, itemId) => {
      const gain = qty - (before.get(itemId) ?? 0);
      if (gain <= 0 || stack >= 3) return;
      const name = ITEMS[itemId]?.name ?? itemId;
      const toast = this.add
        .text(me.container.x, me.container.y - 34 - stack * 16, `+${gain} ${name}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: itemId === "coins" ? "#ffd166" : "#b8f5c8",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setStroke("#05070a", 4)
        .setDepth(50);
      this.tweens.add({
        targets: toast,
        y: toast.y - 26,
        alpha: 0,
        duration: 1100,
        ease: "Cubic.easeOut",
        onComplete: () => toast.destroy(),
      });
      stack += 1;
    });
  }

  /** A brief gold banner when a skill levels up — pure feedback, no state. */
  private showLevelUp(p: LevelUpPayload): void {
    const labels: Record<string, string> = {
      melee: "Melee",
      vitality: "Vitality",
      mining: "Mining",
      fishing: "Fishing",
      smithing: "Smithing",
      cooking: "Cooking",
    };
    const label = labels[p.skill] ?? p.skill;
    const toast = this.add
      .text(this.scale.width / 2, this.scale.height * 0.32, `${label} level ${p.level}!`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#ffe066",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(600);
    this.tweens.add({
      targets: toast,
      y: toast.y - 40,
      alpha: { from: 1, to: 0 },
      duration: 1600,
      ease: "Cubic.easeIn",
      onComplete: () => toast.destroy(),
    });
  }

  private selectTarget(id: string | null): void {
    this.selectedTargetId = id;
    if (!id) this.selectionRing.setVisible(false);
  }

  private updateSelectionRing(): void {
    if (!this.selectedTargetId) {
      this.selectionRing.setVisible(false);
      return;
    }
    const view = this.enemies.get(this.selectedTargetId) ?? this.players.get(this.selectedTargetId);
    if (!view) {
      this.selectionRing.setVisible(false);
      return;
    }
    this.selectionRing
      .setVisible(true)
      .setPosition(view.container.x, view.container.y)
      .setRadius(view.radius + 8);
  }

  /** A small deterministic API for end-to-end tests (and debugging). */
  private exposeTestApi(): void {
    const room = this.connection.room;
    (window as unknown as { __mmo?: unknown }).__mmo = {
      ready: true,
      sessionId: () => room.sessionId,
      roomId: () => room.roomId,
      zone: () => room.state?.zoneId ?? null,
      playerCount: () => room.state?.players?.size ?? 0,
      enemyCount: () => room.state?.enemies?.size ?? 0,
      enemyIds: () => (room.state?.enemies ? [...room.state.enemies.keys()] : []),
      enemyHp: (id: string) => room.state?.enemies?.get(id)?.hp ?? null,
      telegraphActive: () => {
        let active = false;
        room.state?.enemies?.forEach((e) => {
          if (e.teleAt > 0) active = true;
        });
        return active;
      },
      enemyMaxHp: (id: string) => room.state?.enemies?.get(id)?.maxHp ?? null,
      me: () => {
        const p = room.state?.players?.get(room.sessionId);
        return p
          ? {
              x: p.x,
              y: p.y,
              hp: p.hp,
              maxHp: p.maxHp,
              energy: p.energy,
              name: p.name,
              level: p.level,
              meleeXp: p.meleeXp,
              rangedXp: p.rangedXp,
              magicXp: p.magicXp,
              vitalityXp: p.vitalityXp,
              miningXp: p.miningXp,
              fishingXp: p.fishingXp,
              smithingXp: p.smithingXp,
              cookingXp: p.cookingXp,
              restedXp: p.restedXp,
              meleeLevel: p.level,
              vitalityLevel: levelForXp(p.vitalityXp),
              miningLevel: levelForXp(p.miningXp),
              fishingLevel: levelForXp(p.fishingXp),
              smithingLevel: levelForXp(p.smithingXp),
              cookingLevel: levelForXp(p.cookingXp),
            }
          : null;
      },
      energy: () => room.state?.players?.get(room.sessionId)?.energy ?? 0,
      inventory: () => this.inventorySlots,
      equipment: () => this.equipmentSlots,
      durability: () => this.equipmentDurability,
      repair: () => room.send(ClientMessage.Repair),
      equip: (itemId: string) => room.send(ClientMessage.Equip, { itemId }),
      unequip: (slot: string) => room.send(ClientMessage.Unequip, { slot }),
      groundLoot: () => {
        const out: { id: string; itemId: string; qty: number; ownerId: string }[] = [];
        room.state?.loot?.forEach((l, id) =>
          out.push({ id, itemId: l.itemId, qty: l.qty, ownerId: l.ownerId }),
        );
        return out;
      },
      pickup: (lootId: string) => room.send(ClientMessage.Pickup, { lootId }),
      bank: () => this.bankSlots,
      atBank: () => this.atBank,
      deposit: (itemId: string, qty: number) => room.send(ClientMessage.Deposit, { itemId, qty }),
      withdraw: (itemId: string, qty: number) => room.send(ClientMessage.Withdraw, { itemId, qty }),
      gather: (nodeId: string) => room.send(ClientMessage.Gather, { nodeId }),
      craft: (recipeId: string) => room.send(ClientMessage.Craft, { recipeId }),
      consume: (itemId: string) => room.send(ClientMessage.Consume, { itemId }),
      quests: () => this.questLog,
      questAccept: (questId: string) => room.send(ClientMessage.QuestAccept, { questId }),
      questComplete: (questId: string) => room.send(ClientMessage.QuestComplete, { questId }),
      talk: (npcId: string) => room.send(ClientMessage.Talk, { npcId }),
      whisper: (to: string, text: string) => room.send(ClientMessage.Whisper, { to, text }),
      friends: () => this.friendsList,
      friendAdd: (name: string) => room.send(ClientMessage.FriendAdd, { name }),
      friendRemove: (name: string) => room.send(ClientMessage.FriendRemove, { name }),
      requestFriends: () => room.send(ClientMessage.RequestFriends),
      party: () => this.partyState,
      partyInvite: (name: string) => room.send(ClientMessage.PartyInvite, { name }),
      partyAccept: () => room.send(ClientMessage.PartyAccept),
      partyLeave: () => room.send(ClientMessage.PartyLeave),
      requestParty: () => room.send(ClientMessage.RequestParty),
      guild: () => this.guildState,
      guildCreate: (name: string, tag: string) => room.send(ClientMessage.GuildCreate, { name, tag }),
      guildInvite: (name: string) => room.send(ClientMessage.GuildInvite, { name }),
      guildAccept: () => room.send(ClientMessage.GuildAccept),
      guildLeave: () => room.send(ClientMessage.GuildLeave),
      guildKick: (name: string) => room.send(ClientMessage.GuildKick, { name }),
      guildSetRank: (name: string, rank: string) => room.send(ClientMessage.GuildSetRank, { name, rank }),
      requestGuild: () => room.send(ClientMessage.RequestGuild),
      trade: () => this.tradeState,
      tradeRequest: (name: string) => room.send(ClientMessage.TradeRequest, { name }),
      tradeRespond: (accept: boolean) => room.send(ClientMessage.TradeRespond, { accept }),
      tradeOffer: (items: ItemStack[], coins: number) =>
        room.send(ClientMessage.TradeOffer, { items, coins }),
      tradeConfirm: () => room.send(ClientMessage.TradeConfirm),
      tradeCancel: () => room.send(ClientMessage.TradeCancel),
      exchange: () => this.exchangeState,
      exchangePost: (side: string, itemId: string, qty: number, price: number) =>
        room.send(ClientMessage.ExchangePost, { side, itemId, qty, price }),
      exchangeCancel: (orderId: string) => room.send(ClientMessage.ExchangeCancel, { orderId }),
      exchangeCollect: (orderId: string) => room.send(ClientMessage.ExchangeCollect, { orderId }),
      requestExchange: (itemId?: string) =>
        room.send(ClientMessage.RequestExchange, itemId ? { itemId } : {}),
      achievements: () => this.achievementsState,
      requestAchievements: () => room.send(ClientMessage.RequestAchievements),
      setTitle: (id: string) => room.send(ClientMessage.SetTitle, { id }),
      playerTitle: (sessionId: string) => room.state?.players?.get(sessionId)?.title ?? "",
      hunt: () => this.huntState,
      huntAssign: () => room.send(ClientMessage.HuntAssign),
      huntBuy: (itemId: string) => room.send(ClientMessage.HuntBuy, { itemId }),
      requestHunt: () => room.send(ClientMessage.RequestHunt),
      duelRequest: (name: string) => room.send(ClientMessage.DuelRequest, { name }),
      duelRespond: (accept: boolean) => room.send(ClientMessage.DuelRespond, { accept }),
      playerHp: (sessionId: string) => room.state?.players?.get(sessionId)?.hp ?? null,
      playerSkull: (sessionId: string) => room.state?.players?.get(sessionId)?.skullUntil ?? 0,
      mountOwned: () => this.mountOwned,
      playerMounted: (sessionId: string) => room.state?.players?.get(sessionId)?.mounted ?? false,
      buyMount: () => room.send(ClientMessage.BuyMount),
      toggleMount: () => room.send(ClientMessage.ToggleMount),
      requestMount: () => room.send(ClientMessage.RequestMount),
      fastTravel: (to: string) => room.send(ClientMessage.FastTravel, { to }),
      perks: () => this.chosenPerks,
      choosePerk: (id: string) => room.send(ClientMessage.ChoosePerk, { id }),
      respecPerks: () => room.send(ClientMessage.RespecPerks),
      requestPerks: () => room.send(ClientMessage.RequestPerks),
      bgQueue: () => room.send(ClientMessage.BgQueue),
      playerTeam: (sessionId: string) => room.state?.players?.get(sessionId)?.team ?? "",
      buy: (vendorId: string, itemId: string, qty: number) =>
        room.send(ClientMessage.Buy, { vendorId, itemId, qty }),
      sell: (vendorId: string, itemId: string, qty: number) =>
        room.send(ClientMessage.Sell, { vendorId, itemId, qty }),
      setTarget: (id: string | null) => this.selectTarget(id),
      attack: (targetId: string) =>
        room.send(ClientMessage.UseAbility, { abilityId: "strike", targetId }),
      useAbility: (abilityId: string, targetId: string) =>
        room.send(ClientMessage.UseAbility, { abilityId, targetId }),
      move: (dx: number, dy: number) => room.send(ClientMessage.Move, { dx, dy }),
    };
  }
}
