export class Bullet {
  constructor({ id, ownerId, x, y, vx, vy, createdAt, damage }) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.createdAt = createdAt;
    this.damage = damage;
    this.isAlive = true;
  }
}
