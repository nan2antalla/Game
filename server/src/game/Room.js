import {
  BARREL_EXPLOSION_DAMAGE,
  BARREL_EXPLOSION_RADIUS,
  BARREL_RADIUS,
  BOX_RADIUS,
  BULLET_LIFETIME_MS,
  BULLET_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_PICKUP_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  PLAYER_SPEED,
  ROOM_MAX_PLAYERS,
  WALL_MAX_HP,
  WORLD_CELL_SIZE,
  WORLD_COLS,
  WORLD_ROWS,
  ZOMBIE_AI_TICK_MS,
  ZOMBIE_CONTACT_COOLDOWN_MS,
  ZOMBIE_MAX_PER_ROOM,
  ZOMBIE_PATH_RECALC_MS,
  ZOMBIE_RADIUS,
  ZOMBIE_SPAWN_INTERVAL_MS,
} from "../config.js";
import { clamp, distanceSquared, randomSpawn } from "../utils/helpers.js";
import { Bullet } from "./entities/Bullet.js";
import { Player } from "./entities/Player.js";
import { Zombie } from "./entities/Zombie.js";
import { findPath } from "./pathfinding.js";
import { applyPlayerDeathScore, applyZombieKillScore } from "./scoring.js";
import { createWorld } from "./world.js";
import { getCurrentWeapon, getWeaponByIndex } from "./weapons.js";
import { randomZombieType, ZOMBIE_TYPES } from "./zombieTypes.js";

export class Room {
  constructor(code) {
    this.id = code;
    this.code = code;
    this.hostId = null;
    this.state = "waiting";
    this.selectedMap = "default";
    this.mode = "score";
    this.scoreLimit = 500;
    this.timeLimitMs = 5 * 60 * 1000;
    this.startTime = null;
    this.gameOver = false;

    this.players = new Map();
    this.zombies = new Map();
    this.bullets = new Map();
    this.world = createWorld();

    this.lastZombieSpawnAt = 0;
    this.lastZombieAiAt = 0;
    this.bulletIdCounter = 1;
    this.zombieIdCounter = 1;
    this.events = [];
  }

  consumeEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }

  queueEvent(type, payload) {
    this.events.push({ type, payload });
  }

  get canJoin() {
    return this.state === "waiting" && this.players.size < ROOM_MAX_PLAYERS;
  }

  validatePlayerName(playerName, excludeId = null) {
    const normalized = String(playerName || "").trim();
    if (!normalized) return { ok: false, reason: "El nombre es obligatorio." };
    if (normalized.length > 12) return { ok: false, reason: "El nombre no puede superar 12 caracteres." };
    const taken = [...this.players.values()].some(
      (p) => p.id !== excludeId && p.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (taken) return { ok: false, reason: "Ese nombre ya existe en la sala." };
    return { ok: true, name: normalized };
  }

  addPlayer(socketId, playerName) {
    if (!this.canJoin) return null;
    const nameCheck = this.validatePlayerName(playerName);
    if (!nameCheck.ok) return null;
    const spawn = this.findOpenSpawn(PLAYER_RADIUS);
    const player = new Player({ id: socketId, name: nameCheck.name, x: spawn.x, y: spawn.y });
    this.players.set(socketId, player);
    if (!this.hostId) this.hostId = socketId;
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
    const nextMap = String(selectedMap || "").trim().toLowerCase();
    if (!nextMap) return { ok: false, reason: "Mapa invalido." };
    this.selectedMap = nextMap;
    return { ok: true };
  }

  setWorldFromMap(worldData, selectedMap) {
    this.world = worldData;
    this.selectedMap = selectedMap;
  }

  setModeSettings(socketId, payload) {
    if (socketId !== this.hostId) return { ok: false, reason: "Solo el host puede cambiar el modo." };
    if (this.state !== "waiting") return { ok: false, reason: "No se puede cambiar modo durante la partida." };
    const mode = payload?.mode;
    if (!["score", "time", "campaign"].includes(mode)) return { ok: false, reason: "Modo invalido." };
    const scoreOptions = [250, 500, 1000, 2500, 5000];
    const timeOptionsMin = [2, 5, 10, 30];
    this.mode = mode;
    if (mode === "score") {
      const scoreLimit = Number(payload?.scoreLimit);
      if (!scoreOptions.includes(scoreLimit)) return { ok: false, reason: "Meta de score invalida." };
      this.scoreLimit = scoreLimit;
    }
    if (mode === "time") {
      const minutes = Number(payload?.timeLimitMinutes);
      if (!timeOptionsMin.includes(minutes)) return { ok: false, reason: "Tiempo invalido." };
      this.timeLimitMs = minutes * 60 * 1000;
    }
    return { ok: true };
  }

  startGame(socketId) {
    if (socketId !== this.hostId) return { ok: false, reason: "Solo el host puede iniciar la partida." };
    if (this.state !== "waiting") return { ok: false, reason: "La partida ya esta en curso." };
    if ([...this.players.values()].some((p) => !p.name || !p.name.trim())) {
      return { ok: false, reason: "Todos los jugadores deben tener nombre valido." };
    }
    this.state = "playing";
    this.startTime = Date.now();
    this.gameOver = false;
    return { ok: true };
  }

  applyInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;
    player.applyInput(input);
  }

  changeWeapon(socketId, weaponIndex) {
    const player = this.players.get(socketId);
    if (!player) return { ok: false, reason: "Jugador no encontrado." };
    const candidate = getWeaponByIndex(player, weaponIndex);
    if (!candidate) return { ok: false, reason: "Slot de arma invalido." };
    player.currentWeaponIndex = weaponIndex;
    return { ok: true, weaponId: candidate.weapon.id };
  }

  tryShoot(socketId, angle, now) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) return;
    const currentWeapon = getCurrentWeapon(player);
    if (!currentWeapon) return;
    if (now - player.lastShotAt < currentWeapon.stats.fireRateMs) return;
    const shootAngle = typeof angle === "number" ? angle : player.aimAngle;
    const bullet = new Bullet({
      id: `${this.code}-b-${this.bulletIdCounter++}`,
      ownerId: player.id,
      x: player.x + Math.cos(shootAngle) * (PLAYER_RADIUS + 4),
      y: player.y + Math.sin(shootAngle) * (PLAYER_RADIUS + 4),
      vx: Math.cos(shootAngle) * currentWeapon.stats.bulletSpeed,
      vy: Math.sin(shootAngle) * currentWeapon.stats.bulletSpeed,
      createdAt: now,
      damage: currentWeapon.stats.damage,
    });
    this.bullets.set(bullet.id, bullet);
    player.lastShotAt = now;
  }

  tick(deltaMs, now) {
    if (this.state !== "playing" || this.gameOver) return;
    const dt = deltaMs / 1000;
    this.processRespawns(now);
    this.movePlayers(dt);
    this.spawnZombies(now);
    if (now - this.lastZombieAiAt >= ZOMBIE_AI_TICK_MS) {
      this.updateZombieAI(now);
      this.lastZombieAiAt = now;
    }
    this.moveZombies(dt, now);
    this.moveBullets(dt, now);
    this.processItemPickups();
    this.cleanupWorld();
    this.checkGameOver(now);
  }

  findOpenSpawn(radius) {
    if (Array.isArray(this.world.spawnPoints) && this.world.spawnPoints.length > 0) {
      const point = this.world.spawnPoints[Math.floor(Math.random() * this.world.spawnPoints.length)];
      if (!this.isBlockedPosition(point.x, point.y, radius)) return { x: point.x, y: point.y };
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const spawn = randomSpawn(GAME_WIDTH, GAME_HEIGHT);
      if (!this.isBlockedPosition(spawn.x, spawn.y, radius)) return spawn;
    }
    return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  }

  toCell(x, y) {
    return {
      col: clamp(Math.floor(x / WORLD_CELL_SIZE), 0, WORLD_COLS - 1),
      row: clamp(Math.floor(y / WORLD_CELL_SIZE), 0, WORLD_ROWS - 1),
    };
  }

  cellCenter(col, row) {
    return { x: col * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, y: row * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2 };
  }

  isBlockedCell(col, row) {
    for (const wall of this.world.walls.values()) {
      if (!wall.isAlive) continue;
      if (wall.col === col && wall.row === row) return true;
    }
    for (const barrel of this.world.barrels.values()) {
      if (!barrel.isAlive) continue;
      if (barrel.col === col && barrel.row === row) return true;
    }
    return false;
  }

  isBlockedPosition(x, y, radius) {
    const cell = this.toCell(x, y);
    for (let c = cell.col - 1; c <= cell.col + 1; c += 1) {
      for (let r = cell.row - 1; r <= cell.row + 1; r += 1) {
        if (c < 0 || c >= WORLD_COLS || r < 0 || r >= WORLD_ROWS) continue;
        if (!this.isBlockedCell(c, r)) continue;
        const center = this.cellCenter(c, r);
        const half = WORLD_CELL_SIZE / 2;
        const nearestX = clamp(x, center.x - half, center.x + half);
        const nearestY = clamp(y, center.y - half, center.y + half);
        const dx = x - nearestX;
        const dy = y - nearestY;
        if (dx * dx + dy * dy <= radius * radius) return true;
      }
    }
    return false;
  }

  moveWithCollisions(entity, nextX, nextY, radius) {
    const clampedX = clamp(nextX, radius, GAME_WIDTH - radius);
    const clampedY = clamp(nextY, radius, GAME_HEIGHT - radius);
    if (!this.isBlockedPosition(clampedX, entity.y, radius)) entity.x = clampedX;
    if (!this.isBlockedPosition(entity.x, clampedY, radius)) entity.y = clampedY;
  }

  movePlayers(dt) {
    for (const player of this.players.values()) {
      if (!player.isAlive) continue;
      const horizontal = Number(player.input.right) - Number(player.input.left);
      const vertical = Number(player.input.down) - Number(player.input.up);
      let norm = Math.hypot(horizontal, vertical);
      if (norm === 0) continue;
      norm = 1 / norm;
      this.moveWithCollisions(
        player,
        player.x + horizontal * norm * PLAYER_SPEED * dt,
        player.y + vertical * norm * PLAYER_SPEED * dt,
        PLAYER_RADIUS,
      );
    }
  }

  spawnZombies(now) {
    if (this.players.size === 0) return;
    if (this.zombies.size >= ZOMBIE_MAX_PER_ROOM) return;
    if (now - this.lastZombieSpawnAt < ZOMBIE_SPAWN_INTERVAL_MS) return;
    const spawn = this.findOpenSpawn(ZOMBIE_RADIUS);
    const type = randomZombieType();
    const stats = ZOMBIE_TYPES[type];
    const zombie = new Zombie({
      id: `${this.code}-z-${this.zombieIdCounter++}`,
      x: spawn.x,
      y: spawn.y,
      type,
      hp: stats.hp,
      speed: stats.speed,
      damage: stats.damage,
    });
    this.zombies.set(zombie.id, zombie);
    this.lastZombieSpawnAt = now;
  }

  updateZombieAI(now) {
    const alivePlayers = [...this.players.values()].filter((p) => p.isAlive);
    if (alivePlayers.length === 0) return;
    for (const zombie of this.zombies.values()) {
      if (!zombie.isAlive) continue;
      let target = alivePlayers[0];
      let best = distanceSquared(zombie.x, zombie.y, target.x, target.y);
      for (let i = 1; i < alivePlayers.length; i += 1) {
        const d = distanceSquared(zombie.x, zombie.y, alivePlayers[i].x, alivePlayers[i].y);
        if (d < best) {
          best = d;
          target = alivePlayers[i];
        }
      }
      if (zombie.type === "erratic" && Math.random() < (ZOMBIE_TYPES.erratic.erraticChance || 0.3)) {
        const angle = Math.random() * Math.PI * 2;
        zombie.erraticDirection = { x: Math.cos(angle), y: Math.sin(angle) };
        zombie.erraticUntil = now + 450;
      }
      if (now - zombie.lastPathAt >= ZOMBIE_PATH_RECALC_MS) {
        const start = this.toCell(zombie.x, zombie.y);
        const goal = this.toCell(target.x, target.y);
        zombie.path = findPath(start, goal, (col, row) => this.isBlockedCell(col, row), WORLD_COLS, WORLD_ROWS);
        zombie.pathIndex = 1;
        zombie.lastPathAt = now;
      }
    }
  }

  moveZombies(dt, now) {
    const alivePlayers = [...this.players.values()].filter((p) => p.isAlive);
    if (alivePlayers.length === 0) return;
    for (const zombie of this.zombies.values()) {
      if (!zombie.isAlive) continue;
      let dirX = 0;
      let dirY = 0;
      if (zombie.type === "erratic" && now < zombie.erraticUntil) {
        dirX = zombie.erraticDirection.x;
        dirY = zombie.erraticDirection.y;
      } else if (zombie.path && zombie.pathIndex < zombie.path.length) {
        const waypoint = zombie.path[zombie.pathIndex];
        const center = this.cellCenter(waypoint.col, waypoint.row);
        const dx = center.x - zombie.x;
        const dy = center.y - zombie.y;
        const len = Math.hypot(dx, dy);
        if (len < 6) zombie.pathIndex += 1;
        else {
          dirX = dx / len;
          dirY = dy / len;
        }
      }
      this.moveWithCollisions(
        zombie,
        zombie.x + dirX * zombie.speed * dt,
        zombie.y + dirY * zombie.speed * dt,
        ZOMBIE_RADIUS,
      );

      let closest = alivePlayers[0];
      let minDist = distanceSquared(zombie.x, zombie.y, closest.x, closest.y);
      for (let i = 1; i < alivePlayers.length; i += 1) {
        const d = distanceSquared(zombie.x, zombie.y, alivePlayers[i].x, alivePlayers[i].y);
        if (d < minDist) {
          minDist = d;
          closest = alivePlayers[i];
        }
      }
      const hitRadius = PLAYER_RADIUS + ZOMBIE_RADIUS;
      if (distanceSquared(zombie.x, zombie.y, closest.x, closest.y) <= hitRadius * hitRadius) {
        const last = zombie.lastContactDamageAtByPlayer.get(closest.id) || 0;
        if (now - last >= ZOMBIE_CONTACT_COOLDOWN_MS) {
          closest.hp = Math.max(0, closest.hp - zombie.damage);
          zombie.lastContactDamageAtByPlayer.set(closest.id, now);
          if (closest.hp <= 0) this.handlePlayerDeath(closest, null, "zombie", now);
        }
      }
    }
  }

  applyAreaDamage(center, radius, damage, now, options = {}) {
    const { sourcePlayerId = null, affectPlayers = true, affectZombies = true, affectBarrels = true, affectWalls = true, affectBoxes = true } = options;
    const radiusSq = radius * radius;
    if (affectPlayers) {
      for (const player of this.players.values()) {
        if (!player.isAlive) continue;
        const d = distanceSquared(center.x, center.y, player.x, player.y);
        if (d > radiusSq) continue;
        player.hp = Math.max(0, player.hp - damage);
        if (player.hp <= 0) {
          const killer = sourcePlayerId ? this.players.get(sourcePlayerId) || null : null;
          this.handlePlayerDeath(player, killer, killer ? "player" : "zombie", now);
        }
      }
    }
    if (affectZombies) {
      for (const zombie of this.zombies.values()) {
        if (!zombie.isAlive) continue;
        if (distanceSquared(center.x, center.y, zombie.x, zombie.y) > radiusSq) continue;
        zombie.hp = Math.max(0, zombie.hp - damage);
        if (zombie.hp <= 0) {
          zombie.isAlive = false;
          const killer = sourcePlayerId ? this.players.get(sourcePlayerId) : null;
          if (killer) {
            applyZombieKillScore(killer);
            this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(killer));
          }
        }
      }
    }
    if (affectBarrels) {
      for (const barrel of this.world.barrels.values()) {
        if (!barrel.isAlive) continue;
        if (distanceSquared(center.x, center.y, barrel.x, barrel.y) > radiusSq) continue;
        this.damageBarrel(barrel, damage, now, sourcePlayerId);
      }
    }
    if (affectWalls) {
      for (const wall of this.world.walls.values()) {
        if (!wall.isAlive || !wall.destructible) continue;
        if (distanceSquared(center.x, center.y, wall.x, wall.y) > radiusSq) continue;
        wall.hp = Math.max(0, wall.hp - damage);
        if (wall.hp <= 0) wall.isAlive = false;
      }
    }
    if (affectBoxes) {
      for (const box of this.world.boxes.values()) {
        if (!box.isAlive) continue;
        if (distanceSquared(center.x, center.y, box.x, box.y) > radiusSq) continue;
        this.damageBox(box, damage);
      }
    }
  }

  damageBarrel(barrel, damage, now, sourcePlayerId) {
    if (!barrel.isAlive) return;
    barrel.hp = Math.max(0, barrel.hp - damage);
    if (barrel.hp > 0) return;
    barrel.isAlive = false;
    this.queueEvent("barrelExploded", { roomCode: this.code, barrelId: barrel.id, x: barrel.x, y: barrel.y });
    this.applyAreaDamage({ x: barrel.x, y: barrel.y }, BARREL_EXPLOSION_RADIUS, BARREL_EXPLOSION_DAMAGE, now, {
      sourcePlayerId,
      affectPlayers: true,
      affectZombies: true,
      affectBarrels: true,
      affectWalls: true,
      affectBoxes: true,
    });
  }

  damageBox(box, damage) {
    if (!box.isAlive) return;
    box.hp = Math.max(0, box.hp - damage);
    if (box.hp > 0) return;
    box.isAlive = false;
    this.queueEvent("boxDestroyed", { roomCode: this.code, boxId: box.id, x: box.x, y: box.y });
    const dropType = Math.random() < 0.7 ? "health" : "weapon";
    const item = { id: `${this.code}-i-${this.world.nextItemId++}`, type: dropType, x: box.x, y: box.y, weaponId: "pistol" };
    this.world.items.set(item.id, item);
    this.queueEvent("itemDropped", { roomCode: this.code, item });
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

      const bulletCell = this.toCell(bullet.x, bullet.y);
      for (const wall of this.world.walls.values()) {
        if (!wall.isAlive) continue;
        if (wall.col !== bulletCell.col || wall.row !== bulletCell.row) continue;
        bullet.isAlive = false;
        if (wall.destructible) {
          wall.hp = Math.max(0, wall.hp - bullet.damage);
          if (wall.hp <= 0) wall.isAlive = false;
        }
        break;
      }
      if (!bullet.isAlive) continue;

      for (const barrel of this.world.barrels.values()) {
        if (!barrel.isAlive) continue;
        const hitRadius = BARREL_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, barrel.x, barrel.y) > hitRadius * hitRadius) continue;
        this.damageBarrel(barrel, bullet.damage, now, bullet.ownerId);
        bullet.isAlive = false;
        break;
      }
      if (!bullet.isAlive) continue;

      for (const box of this.world.boxes.values()) {
        if (!box.isAlive) continue;
        const hitRadius = BOX_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, box.x, box.y) > hitRadius * hitRadius) continue;
        this.damageBox(box, bullet.damage);
        bullet.isAlive = false;
        break;
      }
      if (!bullet.isAlive) continue;

      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === bullet.ownerId) continue;
        if (this.mode === "campaign") continue;
        const hitRadius = PLAYER_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, target.x, target.y) > hitRadius * hitRadius) continue;
        target.hp = Math.max(0, target.hp - bullet.damage);
        if (target.hp <= 0) {
          const killer = this.players.get(bullet.ownerId) || null;
          this.handlePlayerDeath(target, killer, "player", now);
        }
        bullet.isAlive = false;
        break;
      }
      if (!bullet.isAlive) continue;

      for (const zombie of this.zombies.values()) {
        if (!zombie.isAlive) continue;
        const hitRadius = ZOMBIE_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, zombie.x, zombie.y) > hitRadius * hitRadius) continue;
        zombie.hp = Math.max(0, zombie.hp - bullet.damage);
        if (zombie.hp <= 0) {
          zombie.isAlive = false;
          const killer = this.players.get(bullet.ownerId);
          if (killer) {
            applyZombieKillScore(killer);
            this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(killer));
          }
        }
        bullet.isAlive = false;
        break;
      }
    }
  }

  processItemPickups() {
    for (const item of this.world.items.values()) {
      for (const player of this.players.values()) {
        if (!player.isAlive) continue;
        const hit = PLAYER_RADIUS + ITEM_PICKUP_RADIUS;
        if (distanceSquared(player.x, player.y, item.x, item.y) > hit * hit) continue;
        if (item.type === "health") {
          player.hp = clamp(player.hp + 20, 0, PLAYER_MAX_HP);
        }
        this.world.items.delete(item.id);
        break;
      }
    }
  }

  cleanupWorld() {
    for (const [id, bullet] of this.bullets.entries()) if (!bullet.isAlive) this.bullets.delete(id);
    for (const [id, zombie] of this.zombies.entries()) if (!zombie.isAlive) this.zombies.delete(id);
    for (const wall of this.world.walls.values()) {
      if (wall.destructible && wall.hp <= 0) wall.isAlive = false;
      if (!wall.destructible) wall.hp = WALL_MAX_HP;
    }
  }

  processRespawns(now) {
    for (const player of this.players.values()) {
      if (this.mode === "campaign") continue;
      if (player.isAlive || !player.respawnAt) continue;
      if (now < player.respawnAt) continue;
      const spawn = this.findOpenSpawn(PLAYER_RADIUS);
      player.x = spawn.x;
      player.y = spawn.y;
      player.hp = PLAYER_MAX_HP;
      player.isAlive = true;
      player.respawnAt = null;
      this.queueEvent("playerRespawn", { roomCode: this.code, playerId: player.id });
    }
  }

  handlePlayerDeath(victim, killer, cause, now) {
    if (!victim.isAlive) return;
    victim.isAlive = false;
    victim.hp = 0;
    victim.respawnAt = this.mode === "campaign" ? null : now + PLAYER_RESPAWN_MS;
    applyPlayerDeathScore({ victim, killer, cause });
    this.queueEvent("playerDied", {
      roomCode: this.code,
      victimId: victim.id,
      killerId: killer?.id || null,
      cause,
      respawnAt: victim.respawnAt,
    });
    this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(victim));
    if (killer && killer.id !== victim.id) this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(killer));
  }

  buildPlayerStatsPayload(player) {
    return {
      roomCode: this.code,
      playerId: player.id,
      score: player.score,
      kills: player.kills,
      killsPlayers: player.killsPlayers,
      killsZombies: player.killsZombies,
      deaths: player.deaths,
    };
  }

  buildRanking() {
    return [...this.players.values()]
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        killsPlayers: p.killsPlayers,
        killsZombies: p.killsZombies,
        deaths: p.deaths,
        killedPlayersList: p.killedPlayersList,
      }))
      .sort((a, b) => b.score - a.score);
  }

  emitGameOver(reason, winnerId = null) {
    this.gameOver = true;
    this.state = "waiting";
    const ranking = this.buildRanking();
    this.queueEvent("gameOver", {
      roomCode: this.code,
      reason,
      mode: this.mode,
      winnerId: winnerId || ranking[0]?.id || null,
      ranking,
      totalScore: ranking.reduce((acc, p) => acc + p.score, 0),
    });
  }

  checkGameOver(now) {
    if (this.mode === "score") {
      const winner = [...this.players.values()].find((p) => p.score >= this.scoreLimit);
      if (winner) this.emitGameOver("score_limit_reached", winner.id);
      return;
    }
    if (this.mode === "time") {
      if (this.startTime && now - this.startTime >= this.timeLimitMs) {
        const ranking = this.buildRanking();
        this.emitGameOver("time_up", ranking[0]?.id || null);
      }
      return;
    }
    if (this.mode === "campaign") {
      const alive = [...this.players.values()].filter((p) => p.isAlive).length;
      if (alive === 0) this.emitGameOver("all_players_dead");
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
      mode: this.mode,
      scoreLimit: this.scoreLimit,
      timeLimitMs: this.timeLimitMs,
      startTime: this.startTime,
      players: this.getLobbyPlayers(),
      maxPlayers: ROOM_MAX_PLAYERS,
    };
  }

  buildState() {
    return {
      roomCode: this.code,
      selectedMap: this.selectedMap,
      mode: this.mode,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        hp: p.hp,
        aimAngle: p.aimAngle,
        isAlive: p.isAlive,
        respawnAt: p.respawnAt,
        score: p.score,
        kills: p.kills,
        killsPlayers: p.killsPlayers,
        killsZombies: p.killsZombies,
        deaths: p.deaths,
        currentWeaponIndex: p.currentWeaponIndex,
        currentWeaponId: getCurrentWeapon(p)?.weapon.id || null,
      })),
      zombies: [...this.zombies.values()].map((z) => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, type: z.type })),
      bullets: [...this.bullets.values()].map((b) => ({ id: b.id, x: b.x, y: b.y })),
      walls: [...this.world.walls.values()].filter((w) => w.isAlive).map((w) => ({ id: w.id, x: w.x, y: w.y, destructible: w.destructible })),
      barrels: [...this.world.barrels.values()].filter((b) => b.isAlive).map((b) => ({ id: b.id, x: b.x, y: b.y, hp: b.hp })),
      boxes: [...this.world.boxes.values()].filter((b) => b.isAlive).map((b) => ({ id: b.id, x: b.x, y: b.y, hp: b.hp })),
      items: [...this.world.items.values()].map((i) => ({ id: i.id, x: i.x, y: i.y, type: i.type })),
    };
  }
}
