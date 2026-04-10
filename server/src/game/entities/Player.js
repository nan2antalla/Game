import { PLAYER_MAX_HP } from "../../config.js";
import { DEFAULT_WEAPONS } from "../weapons.js";

export class Player {
  constructor({ id, name, x, y }) {
    this.id = id;
    this.name = name || `Player-${id.slice(0, 4)}`;
    this.x = x;
    this.y = y;
    this.hp = PLAYER_MAX_HP;
    this.aimAngle = 0;
    this.input = { up: false, down: false, left: false, right: false };
    this.lastShotAt = 0;
    this.isAlive = true;
    this.respawnAt = null;
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    this.weapons = structuredClone(DEFAULT_WEAPONS);
    this.currentWeaponIndex = 0;
  }

  applyInput(input = {}) {
    this.input.up = Boolean(input.up);
    this.input.down = Boolean(input.down);
    this.input.left = Boolean(input.left);
    this.input.right = Boolean(input.right);
    if (typeof input.aimAngle === "number") {
      this.aimAngle = input.aimAngle;
    }
  }
}
