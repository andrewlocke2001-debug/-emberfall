import { type Page } from "@playwright/test";

/** Shape of the in-page test API exposed by ZoneScene (see exposeTestApi). */
export interface MmoTestApi {
  ready: boolean;
  playerCount(): number;
  enemyHp(id: string): number | null;
  me(): { x: number; y: number; hp: number; name: string; level: number } | null;
  setTarget(id: string | null): void;
  attack(targetId: string): void;
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
