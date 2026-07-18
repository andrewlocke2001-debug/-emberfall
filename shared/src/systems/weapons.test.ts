import { describe, it, expect } from "vitest";
import { governingSkill, basicAbilityFor, abilityKitFor, canUseWithWeapon } from "./weapons";
import { ABILITIES } from "../data/abilities";
import { ITEMS } from "../data/items";

describe("governingSkill", () => {
  it("routes bows to ranged, staves to magic, everything else to melee", () => {
    expect(governingSkill("bow")).toBe("ranged");
    expect(governingSkill("staff")).toBe("magic");
    expect(governingSkill("sword")).toBe("melee");
    expect(governingSkill("axe")).toBe("melee");
    expect(governingSkill("dagger")).toBe("melee");
    expect(governingSkill(undefined)).toBe("melee"); // bare fists
  });
});

describe("basicAbilityFor / abilityKitFor", () => {
  it("gives each class a free basic attack that its kit starts with", () => {
    for (const w of ["bow", "staff", "sword", undefined] as const) {
      const basic = basicAbilityFor(w);
      expect(abilityKitFor(w)[0]).toBe(basic);
      expect(ABILITIES[basic].energyCost ?? 0).toBe(0); // basics are always free
    }
  });
});

describe("canUseWithWeapon", () => {
  it("gates class kits to their weapon and blocks melee kit behind a bow", () => {
    expect(canUseWithWeapon(ABILITIES.quick_shot, "bow")).toBe(true);
    expect(canUseWithWeapon(ABILITIES.quick_shot, "sword")).toBe(false);
    expect(canUseWithWeapon(ABILITIES.quick_shot, undefined)).toBe(false);
    expect(canUseWithWeapon(ABILITIES.strike, "sword")).toBe(true);
    expect(canUseWithWeapon(ABILITIES.strike, undefined)).toBe(true);
    expect(canUseWithWeapon(ABILITIES.strike, "bow")).toBe(false);
    expect(canUseWithWeapon(ABILITIES.mend, "bow")).toBe(true); // utility ignores weapon
  });
});

describe("weapon content sanity", () => {
  it("every ability's weaponTypes reference real weapon-typed items", () => {
    const typedWeapons = new Set(
      Object.values(ITEMS)
        .filter((i) => i.weaponType)
        .map((i) => i.weaponType),
    );
    for (const a of Object.values(ABILITIES)) {
      for (const w of a.weaponTypes ?? []) {
        expect(typedWeapons.has(w)).toBe(true); // no kit without a wieldable weapon
      }
    }
  });

  it("every equippable weapon declares a weapon class", () => {
    for (const item of Object.values(ITEMS)) {
      if (item.equipSlot === "weapon") expect(item.weaponType).toBeDefined();
    }
  });
});
