export const WEAPON_STATS = {
  pistol: {
    id: "pistol",
    damage: 10,
    bulletSpeed: 650,
    fireRateMs: 500,
  },
};

export const DEFAULT_WEAPONS = [{ id: "pistol", ammo: Number.POSITIVE_INFINITY }];

export function getWeaponByIndex(player, index) {
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= player.weapons.length) return null;
  const weapon = player.weapons[index];
  if (!weapon) return null;
  const stats = WEAPON_STATS[weapon.id];
  if (!stats) return null;
  return { weapon, stats, index };
}

export function getCurrentWeapon(player) {
  return getWeaponByIndex(player, player.currentWeaponIndex);
}
