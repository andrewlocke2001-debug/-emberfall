import { type Page } from "@playwright/test";

/** One inventory stack, mirrored from @mmo/shared ItemStack. */
export interface TestItemStack {
  itemId: string;
  qty: number;
}

/** Shape of the in-page test API exposed by ZoneScene (see exposeTestApi). */
export interface MmoTestApi {
  ready: boolean;
  zone(): string | null;
  playerCount(): number;
  enemyCount(): number;
  inventory(): TestItemStack[];
  equipment(): Record<string, string>;
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
}
