import {
  BULLET_LIFETIME_MS,
  BULLET_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_RESPAWN_MS,
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
import { getCurrentWeapon, getWeaponByIndex } from "./weapons.js";
import { applyPlayerDeathScore, applyZombieKillScore } from "./scoring.js";

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
    this.lastZombieSpawnAt = 0;
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

    const spawn = randomSpawn(GAME_WIDTH, GAME_HEIGHT);
    const player = new Player({ id: socketId, name: nameCheck.name, x: spawn.x, y: spawn.y });
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
    if ([...this.players.values()].some((p) => !p.name || !p.name.trim())) {
      return { ok: false, reason: "Todos los jugadores deben tener nombre valido." };
    }
    this.state = "playing";
    this.startTime = Date.now();
    this.gameOver = false;
    return { ok: true };
  }

  setModeSettings(socketId, payload) {
    if (socketId !== this.hostId) return { ok: false, reason: "Solo el host puede cambiar el modo." };
    if (this.state !== "waiting") return { ok: false, reason: "No se puede cambiar modo durante la partida." };

    const mode = payload?.mode;
    if (!["score", "time", "campaign"].includes(mode)) {
      return { ok: false, reason: "Modo invalido." };
    }

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
    const vx = Math.cos(shootAngle) * currentWeapon.stats.bulletSpeed;
    const vy = Math.sin(shootAngle) * currentWeapon.stats.bulletSpeed;
    const bullet = new Bullet({
      id: `${this.code}-b-${this.bulletIdCounter++}`,
      ownerId: player.id,
      x: player.x + Math.cos(shootAngle) * (PLAYER_RADIUS + 4),
      y: player.y + Math.sin(shootAngle) * (PLAYER_RADIUS + 4),
      vx,
      vy,
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
    this.moveZombies(dt, now);
    this.moveBullets(dt, now);
    this.checkGameOver(now);
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
          if (closest.hp <= 0) {
            this.handlePlayerDeath(closest, null, "zombie", now);
          }
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
        if (this.mode === "campaign") continue;
        const hitRadius = PLAYER_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, target.x, target.y) <= hitRadius * hitRadius) {
          target.hp = Math.max(0, target.hp - bullet.damage);
          if (target.hp <= 0) {
            const killer = this.players.get(bullet.ownerId) || null;
            this.handlePlayerDeath(target, killer, "player", now);
          }
          bullet.isAlive = false;
          break;
        }
      }

      if (!bullet.isAlive) continue;

      for (const zombie of this.zombies.values()) {
        const hitRadius = ZOMBIE_RADIUS + BULLET_RADIUS;
        if (distanceSquared(bullet.x, bullet.y, zombie.x, zombie.y) <= hitRadius * hitRadius) {
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

    for (const [id, bullet] of this.bullets.entries()) {
      if (!bullet.isAlive) this.bullets.delete(id);
    }

    for (const [id, zombie] of this.zombies.entries()) {
      if (!zombie.isAlive) this.zombies.delete(id);
    }
  }

  processRespawns(now) {
    for (const player of this.players.values()) {
      if (this.mode === "campaign") continue;
      if (player.isAlive || !player.respawnAt) continue;
      if (now < player.respawnAt) continue;
      const spawn = randomSpawn(GAME_WIDTH, GAME_HEIGHT);
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
    victim.respawnAt = now + PLAYER_RESPAWN_MS;

    applyPlayerDeathScore({ victim, killer, cause });
    this.queueEvent("playerDied", {
      roomCode: this.code,
      victimId: victim.id,
      killerId: killer?.id || null,
      cause,
      respawnAt: victim.respawnAt,
    });
    this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(victim));
    if (killer && killer.id !== victim.id) {
      this.queueEvent("scoreUpdated", this.buildPlayerStatsPayload(killer));
    }
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
      if (alive === 0) this.emitGameOver("all_players_dead", null);
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
