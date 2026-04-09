import { ZOMBIE_MAX_HP } from "../../config.js";

export class Zombie {
  constructor({ id, x, y }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.hp = ZOMBIE_MAX_HP;
    this.isAlive = true;
    this.lastContactDamageAtByPlayer = new Map();
  }
}
