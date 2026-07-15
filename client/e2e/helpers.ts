import { type Page, expect } from "@playwright/test";

/** One inventory stack, mirrored from @mmo/shared ItemStack. */
export interface TestItemStack {
  itemId: string;
  qty: number;
}

/** Shape of the in-page test API exposed by ZoneScene (see exposeTestApi). */
export interface MmoTestApi {
  ready: boolean;
  roomId(): string;
  zone(): string | null;
  playerCount(): number;
  enemyCount(): number;
  inventory(): TestItemStack[];
  equipment(): Record<string, string>;
  durability(): Record<string, number>;
  repair(): void;
  equip(itemId: string): void;
  unequip(slot: string): void;
  groundLoot(): { id: string; itemId: string; qty: number; ownerId: string }[];
  pickup(lootId: string): void;
  bank(): TestItemStack[];
  atBank(): boolean;
  deposit(itemId: string, qty: number): void;
  withdraw(itemId: string, qty: number): void;
  gather(nodeId: string): void;
  craft(recipeId: string): void;
  consume(itemId: string): void;
  quests(): { questId: string; status: "active" | "complete"; progress: number[] }[];
  questAccept(questId: string): void;
  questComplete(questId: string): void;
  talk(npcId: string): void;
  telegraphActive(): boolean;
  whisper(to: string, text: string): void;
  friends(): { name: string; online: boolean; zone?: string }[];
  friendAdd(name: string): void;
  friendRemove(name: string): void;
  requestFriends(): void;
  party(): {
    members: { name: string; leader: boolean; online: boolean; zone?: string }[];
    invitedBy?: string;
  };
  partyInvite(name: string): void;
  partyAccept(): void;
  partyLeave(): void;
  requestParty(): void;
  guild(): {
    name?: string;
    tag?: string;
    myRank?: "leader" | "officer" | "member";
    members: { name: string; rank: string; online: boolean; zone?: string }[];
    invitedTo?: { guildName: string; by: string };
  };
  guildCreate(name: string, tag: string): void;
  guildInvite(name: string): void;
  guildAccept(): void;
  guildLeave(): void;
  guildKick(name: string): void;
  guildSetRank(name: string, rank: "officer" | "member"): void;
  requestGuild(): void;
  trade(): {
    active: boolean;
    me?: { name: string; items: TestItemStack[]; coins: number; confirmed: boolean };
    them?: { name: string; items: TestItemStack[]; coins: number; confirmed: boolean };
    requestFrom?: string;
  };
  tradeRequest(name: string): void;
  tradeRespond(accept: boolean): void;
  tradeOffer(items: TestItemStack[], coins: number): void;
  tradeConfirm(): void;
  tradeCancel(): void;
  exchange(): {
    orders: {
      id: string;
      side: "buy" | "sell";
      itemId: string;
      qty: number;
      remaining: number;
      price: number;
      coinsToCollect: number;
      itemsToCollect: number;
    }[];
    item?: string;
    prices?: { price: number; qty: number; at: number }[];
  };
  exchangePost(side: "buy" | "sell", itemId: string, qty: number, price: number): void;
  exchangeCancel(orderId: string): void;
  exchangeCollect(orderId: string): void;
  requestExchange(itemId?: string): void;
  achievements(): {
    list: { id: string; name: string; desc: string; title?: string; unlocked: boolean }[];
    title: string;
  };
  requestAchievements(): void;
  setTitle(id: string): void;
  playerTitle(sessionId: string): string;
  hunt(): { task: { mob: string; remaining: number; points: number } | null; points: number };
  huntAssign(): void;
  huntBuy(itemId: string): void;
  requestHunt(): void;
  duelRequest(name: string): void;
  duelRespond(accept: boolean): void;
  playerHp(sessionId: string): number | null;
  playerSkull(sessionId: string): number;
  mountOwned(): boolean;
  playerMounted(sessionId: string): boolean;
  buyMount(): void;
  toggleMount(): void;
  requestMount(): void;
  fastTravel(to: string): void;
  perks(): string[];
  choosePerk(id: string): void;
  respecPerks(): void;
  requestPerks(): void;
  bgQueue(): void;
  playerTeam(sessionId: string): string;
  sessionId(): string;
  buy(vendorId: string, itemId: string, qty: number): void;
  sell(vendorId: string, itemId: string, qty: number): void;
  enemyIds(): string[];
  enemyHp(id: string): number | null;
  me(): {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    energy: number;
    name: string;
    level: number;
    meleeXp: number;
    vitalityXp: number;
    miningXp: number;
    fishingXp: number;
    smithingXp: number;
    cookingXp: number;
    restedXp: number;
    meleeLevel: number;
    vitalityLevel: number;
    miningLevel: number;
    fishingLevel: number;
    smithingLevel: number;
    cookingLevel: number;
  } | null;
  energy(): number;
  setTarget(id: string | null): void;
  attack(targetId: string): void;
  useAbility(abilityId: string, targetId: string): void;
  move(dx: number, dy: number): void;
}

declare global {
  interface Window {
    __mmo?: MmoTestApi;
  }
}

/**
 * Fill the login overlay and wait until the player is fully in the world.
 * The caller is responsible for navigating to the page first (goto/reload).
 */
export async function enterWorld(page: Page, name: string): Promise<void> {
  await page.fill("#name", name);
  await page.click("#enter");
  await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 20_000 });
  await page.waitForFunction(() => window.__mmo!.me() !== null, undefined, { timeout: 20_000 });
}

/**
 * Enter the world as a GM, deterministically across runs. Uses a *registered*
 * account (guest names get a random suffix once taken, which would silently
 * drop GM status), registering on the first run and logging in thereafter.
 * The name must be listed in the server's GM_USERNAMES (see playwright.config).
 */
export async function enterWorldAsGm(page: Page, name = "GameMaster"): Promise<void> {
  const password = "gm-secret-123";
  await page.fill("#name", name);
  await page.fill("#password", password);
  await page.click("#btn-register");
  // Resolve as soon as we're in OR registration is refused (name already taken).
  await page.waitForFunction(
    () =>
      window.__mmo?.ready === true ||
      (document.getElementById("login-error")?.textContent ?? "") !== "",
    undefined,
    { timeout: 20_000 },
  );
  if (!(await page.evaluate(() => window.__mmo?.ready === true))) {
    await page.click("#btn-login"); // existing account — log into it
    await page.waitForFunction(() => window.__mmo?.ready === true, undefined, { timeout: 20_000 });
  }
  await page.waitForFunction(() => window.__mmo!.me() !== null, undefined, { timeout: 20_000 });
  // The GameMaster fixture persists across runs — a prior combat test can leave
  // it dead (hp 0), which blocks alive-gated actions (buy/craft/gather/aggro).
  // Revive + top up every entry so GM tests always start from a clean state.
  await page.fill("#chat-input", "/heal");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.me()?.hp ?? 0)).toBeGreaterThan(0);
}

/**
 * Empty the GM's bag (a GM-only /clearbag). The GameMaster fixture persists
 * across runs, so its 28-slot bag would otherwise fill with junk item types and
 * make "add a new item" assertions flaky. Tests that add fresh items call this
 * first for a clean, deterministic bag.
 */
export async function clearBag(page: Page): Promise<void> {
  await page.fill("#chat-input", "/clearbag");
  await page.press("#chat-input", "Enter");
  await expect.poll(() => page.evaluate(() => window.__mmo!.inventory().length)).toBe(0);
}
