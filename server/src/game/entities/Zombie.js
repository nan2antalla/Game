export class Zombie {
  constructor({ id, x, y, type, hp, speed, damage }) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.speed = speed;
    this.damage = damage;
    this.isAlive = true;
    this.lastContactDamageAtByPlayer = new Map();
    this.path = [];
    this.pathIndex = 0;
    this.lastPathAt = 0;
    this.erraticDirection = { x: 0, y: 0 };
    this.erraticUntil = 0;
  }
}
