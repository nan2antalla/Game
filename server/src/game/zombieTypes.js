export const ZOMBIE_TYPES = {
  normal: {
    id: "normal",
    hp: 60,
    speed: 80,
    damage: 12,
  },
  fast: {
    id: "fast",
    hp: 35,
    speed: 130,
    damage: 10,
  },
  tank: {
    id: "tank",
    hp: 130,
    speed: 55,
    damage: 22,
  },
  erratic: {
    id: "erratic",
    hp: 55,
    speed: 95,
    damage: 14,
    erraticChance: 0.35,
  },
};

export function randomZombieType() {
  const roll = Math.random();
  if (roll < 0.5) return "normal";
  if (roll < 0.72) return "fast";
  if (roll < 0.9) return "tank";
  return "erratic";
}
