export class Bullet {
  constructor({ id, ownerId, x, y, vx, vy, createdAt }) {
    this.id = id;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.createdAt = createdAt;
    this.isAlive = true;
  }
}
