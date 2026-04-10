import {
  BULLET_DAMAGE,
  BULLET_LIFETIME_MS,
  BULLET_RADIUS,
  BULLET_SPEED,
  FIRE_COOLDOWN_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ROOM_MAX_PLAYERS,
  ZOMBIE_CONTACT_COOLDOWN_MS,
  ZOMBIE_CONTACT_DAMAGE,
  ZOMBIE_MAX_PER_ROOM,
  ZOMBIE_RADIUS,
  ZOMBIE_SPAWN_INTERVAL_MS,
  ZOMBIE_SPEED,
} from "../config.js";
import { Bullet } from "./entities/Bullet.js";
import { Player } from "./entities/Player.js";
import { Zombie } from "./entities/Zombie.js";
import { clamp, distanceSquared, randomSpawn } from "../utils/helpers.js";

export class Room {
  constructor(code) {
    this.id = code;
    this.code = code;
    this.hostId = null;
    this.state = "waiting";
    this.selectedMap = "default";
    this.players = new Map();
    this.zombies = new Map();
    this.bullets = new Map();
    this.lastZombieSpawnAt = 0;
    this.bulletIdCounter = 1;
    this.zombieIdCounter = 1;
  }

  get canJoin() {
    return this.state === "waiting" && this.players.size < ROOM_MAX_PLAYERS;
  }

  addPlayer(socketId) {
    if (!this.canJoin) return null;

    const spawn = randomSpawn(GAME_WIDTH, GAME_HEIGHT);
    const player = new Player({ id: socketId, x: spawn.x, y: spawn.y });
    this.players.set(socketId, player);
    if (!this.hostId) {
      this.hostId = socketId;
    }
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.hostId === socketId) {
      const next = this.players.keys().next();
      this.hostId = next.done ? null : next.value;
    }
  }

  setSelectedMap(socketId, selectedMap) {
    if (socketId !== this.hostId) return { ok: false, reason: "Solo el host puede cambiar el mapa." };
    if (this.state !== "waiting") return { ok: false, reason: "No se puede cambiar mapa con partida iniciada." };
    if (selectedMap !== "default") return { ok: false, reason: "Mapa no disponible por ahora." };
    this.selectedMap = selectedMap;
    return { ok: true };
  }

  startGame(socketId) {
    if (socketId !== this.hostId) return { ok: false, reason: "Solo el host puede iniciar la partida." };
    if (this.state !== "waiting") return { ok: false, reason: "La partida ya esta en curso." };
    this.state = "playing";
    return { ok: true };
  }

  applyInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;
    player.applyInput(input);
  }

  tryShoot(socketId, angle, now) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;

    if (now - player.lastShotAt < FIRE_COOLDOWN_MS) return;

    const shootAngle = typeof angle === "number" ? angle : player.aimAngle;
    const vx = Math.cos(shootAngle) * BULLET_SPEED;
    const vy = Math.sin(shootAngle) * BULLET_SPEED;
    const bullet = new Bullet({
      id: `${this.code}-b-${this.bulletIdCounter++}`,
      ownerId: player.id,
      x: player.x + Math.cos(shootAngle) * (PLAYER_RADIUS + 4),
      y: player.y + Math.sin(shootAngle) * (PLAYER_RADIUS + 4),
      vx,
      vy,
      createdAt: now,
    });

    this.bullets.set(bullet.id, bullet);
    player.lastShotAt = now;
  }

  tick(deltaMs, now) {
    if (this.state !== "playing") return;
    const dt = deltaMs / 1000;
    this.movePlayers(dt);
    this.spawnZombies(now);
    this.moveZombies(dt, now);
    this.moveBullets(dt, now);
  }

  movePlayers(dt) {
    for (const player of this.players.values()) {
      if (!player.isAlive) continue;

      const horizontal = Number(player.input.right) - Number(player.input.left);
      const vertical = Number(player.input.down) - Number(player.input.up);
      let norm = Math.hypot(horizontal, vertical);
      if (norm === 0) continue;

      norm = 1 / norm;
      player.x = clamp(player.x + horizontal * norm * PLAYER_SPEED * dt, PLAYER_RADIUS, GAME_WIDTH - PLAYER_RADIUS);
      player.y = clamp(player.y + vertical * norm * PLAYER_SPEED * dt, PLAYER_RADIUS, GAME_HEIGHT - PLAYER_RADIUS);
    }
  }

  spawnZombies(now) {
    if (this.players.size === 0) return;
    if (this.zombies.size >= ZOMBIE_MAX_PER_ROOM) return;
    if (now - this.lastZombieSpawnAt < ZOMBIE_SPAWN_INTERVAL_MS) return;

    const spawn = randomSpawn(GAME_WIDTH, GAME_HEIGHT);
    const zombie = new Zombie({ id: `${this.code}-z-${this.zombieIdCounter++}`, x: spawn.x, y: spawn.y });
    this.zombies.set(zombie.id, zombie);
    this.lastZombieSpawnAt = now;
  }

  moveZombies(dt, now) {
    const alivePlayers = [...this.players.values()].filter((p) => p.isAlive);
    if (alivePlayers.length === 0) return;

    for (const zombie of this.zombies.values()) {
      let closest = alivePlayers[0];
      let minDist = distanceSquared(zombie.x, zombie.y, closest.x, closest.y);

      for (let i = 1; i < alivePlayers.length; i += 1) {
        const target = alivePlayers[i];
        const d = distanceSquared(zombie.x, zombie.y, target.x, target.y);
        if (d < minDist) {
          minDist = d;
          closest = target;
        }
      }

      const dx = closest.x - zombie.x;
      const dy = closest.y - zombie.y;
      const len = Math.hypot(dx, dy) || 1;
      zombie.x = clamp(zombie.x + (dx / len) * ZOMBIE_SPEED * dt, ZOMBIE_RADIUS, GAME_WIDTH - ZOMBIE_RADIUS);
      zombie.y = clamp(zombie.y + (dy / len) * ZOMBIE_SPEED * dt, ZOMBIE_RADIUS, GAME_HEIGHT - ZOMBIE_RADIUS);

      const sumRadius = PLAYER_RADIUS + ZOMBIE_RADIUS;
      if (distanceSquared(zombie.x, zombie.y, closest.x, closest.y) <= sumRadius * sumRadius) {
        const lastHitAt = zombie.lastContactDamageAtByPlayer.get(closest.id) || 0;
        if (now - lastHitAt >= ZOMBIE_CONTACT_COOLDOWN_MS) {
          closest.hp = Math.max(0, closest.hp - ZOMBIE_CONTACT_DAMAGE);
          zombie.lastContactDamageAtByPlayer.set(closest.id, now);
          if (closest.hp <= 0) closest.isAlive = false;
        }
      }
    }
  }

  moveBullets(dt, now) {
    for (const bullet of this.bullets.values()) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (
        bullet.x < -BULLET_RADIUS ||
        bullet.x > GAME_WIDTH + BULLET_RADIUS ||
        bullet.y < -BULLET_RADIUS ||
        bullet.y > GAME_HEIGHT + BULLET_RADIUS ||
        now - bullet.createdAt > BULLET_LIFETIME_MS
      ) {
        bullet.isAlive = false;
      }

      if (!bullet.isAlive) continue;

      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === bullet.ownerId) continue;
        const hitRadius = PLAYER_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, target.x, target.y) <= hitRadius * hitRadius) {
          target.hp = Math.max(0, target.hp - BULLET_DAMAGE);
          if (target.hp <= 0) target.isAlive = false;
          bullet.isAlive = false;
          break;
        }
      }

      if (!bullet.isAlive) continue;

      for (const zombie of this.zombies.values()) {
        const hitRadius = ZOMBIE_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, zombie.x, zombie.y) <= hitRadius * hitRadius) {
          zombie.hp = Math.max(0, zombie.hp - BULLET_DAMAGE);
          if (zombie.hp <= 0) zombie.isAlive = false;
          bullet.isAlive = false;
          break;
        }
      }
    }

    for (const [id, bullet] of this.bullets.entries()) {
      if (!bullet.isAlive) this.bullets.delete(id);
    }

    for (const [id, zombie] of this.zombies.entries()) {
      if (!zombie.isAlive) this.zombies.delete(id);
    }
  }

  getLobbyPlayers() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, isHost: p.id === this.hostId }));
  }

  buildLobbyData() {
    return {
      roomCode: this.code,
      hostId: this.hostId,
      state: this.state,
      selectedMap: this.selectedMap,
      players: this.getLobbyPlayers(),
      maxPlayers: ROOM_MAX_PLAYERS,
    };
  }

  buildState() {
    return {
      roomCode: this.code,
      selectedMap: this.selectedMap,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        hp: p.hp,
        aimAngle: p.aimAngle,
        isAlive: p.isAlive,
      })),
      zombies: [...this.zombies.values()].map((z) => ({
        id: z.id,
        x: z.x,
        y: z.y,
        hp: z.hp,
      })),
      bullets: [...this.bullets.values()].map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
      })),
    };
  }
}
