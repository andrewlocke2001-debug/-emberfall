import type { AbilityDef, AbilityId, CombatSkill, WeaponType } from "../types";

/**
 * Weapon-class rules (P13, pure). A weapon's class decides which combat
 * skill governs attacks made with it, which basic attack the bar defaults
 * to, and which abilities it may use. Rooms wire these to netcode; the
 * client reuses them for bar layout and prediction.
 */

/** The combat skill that governs attacks with this weapon class. */
export function governingSkill(weaponType: WeaponType | undefined): CombatSkill {
  if (weaponType === "bow") return "ranged";
  if (weaponType === "staff") return "magic";
  return "melee"; // swords/axes/mauls/daggers — and bare fists
}

/** The free basic attack for this weapon class (Space / touch attack). */
export function basicAbilityFor(weaponType: WeaponType | undefined): AbilityId {
  if (weaponType === "bow") return "quick_shot";
  if (weaponType === "staff") return "cinderbolt";
  return "strike";
}

/** The ability-bar kit shown for this weapon class (basic, special, utility). */
export function abilityKitFor(weaponType: WeaponType | undefined): AbilityId[] {
  if (weaponType === "bow") return ["quick_shot", "aimed_shot", "mend"];
  if (weaponType === "staff") return ["cinderbolt", "ember_burst", "mend"];
  if (weaponType === "axe") return ["strike", "rend", "mend"];
  if (weaponType === "dagger") return ["strike", "hamstring", "mend"];
  // Maul + sword share the clean-burst melee kit.
  return ["strike", "power_strike", "mend"];
}

/**
 * Whether an ability may be used while wielding this weapon class.
 * Undefined `weaponTypes` = the melee-universal kit: usable with any melee
 * weapon or bare hands, but NOT with a bow/staff in hand (their kits replace
 * it — no punching people with a longbow equipped).
 */
export function canUseWithWeapon(ability: AbilityDef, weaponType: WeaponType | undefined): boolean {
  if (ability.kind === "heal") return true; // utility ignores the weapon
  if (ability.weaponTypes) return weaponType !== undefined && ability.weaponTypes.includes(weaponType);
  return governingSkill(weaponType) === "melee";
}
