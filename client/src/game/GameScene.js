import Phaser from "phaser";
import { MapLoader } from "../maps/MapLoader.js";

export class GameScene extends Phaser.Scene {
  constructor(roomClient, options = {}) {
    super("game-scene");
    this.roomClient = roomClient;
    this.isMobile = Boolean(options.isMobile);
    this.state = { players: [], zombies: [], bullets: [], walls: [], barrels: [], boxes: [], items: [] };
    this.playerSprites = new Map();
    this.playerNameTexts = new Map();
    this.zombieSprites = new Map();
    this.bulletSprites = new Map();
    this.wallSprites = new Map();
    this.barrelSprites = new Map();
    this.boxSprites = new Map();
    this.itemSprites = new Map();
    this.lastDeathEvent = null;
    this.mapOverlay = [];
    this.mobileInput = {
      moveX: 0,
      moveY: 0,
      aimingPointerId: null,
      firePointerId: null,
      aimAngle: 0,
      wantWeaponSwap: false,
      shotHeld: false,
      lastShotAt: 0,
    };
    this.mouseShotHeld = false;
    this.lastMouseShotAt = 0;
  }

  create() {
    this.add.rectangle(600, 400, 1200, 800, 0x1a2233).setOrigin(0.5);
    this.cameras.main.setBounds(0, 0, 1200, 800);
    this.cursors = this.isMobile
      ? null
      : {
          w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

    this.hpText = this.add.text(10, 10, "HP: 100", { color: "#ffffff", fontSize: "20px" }).setScrollFactor(0);
    this.scoreText = this.add.text(10, 38, "Score: 0", { color: "#fef08a", fontSize: "20px" }).setScrollFactor(0);
    this.kdText = this.add.text(10, 66, "K/D: 0/0", { color: "#c4b5fd", fontSize: "20px" }).setScrollFactor(0);
    this.weaponText = this.add.text(10, 94, "Arma: pistol", { color: "#86efac", fontSize: "20px" }).setScrollFactor(0);
    this.respawnText = this.add.text(10, 122, "", { color: "#fca5a5", fontSize: "22px" }).setScrollFactor(0);

    this.input.on("pointerdown", () => {
      if (this.isMobile) return;
      const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
      if (!me || !me.isAlive) return;
      const pointer = this.input.activePointer;
      const angle = Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY);
      this.roomClient.shoot(angle);
    });
    this.input.on("pointerdown", () => {
      if (this.isMobile) return;
      this.mouseShotHeld = true;
    });
    this.input.on("pointerup", () => {
      if (this.isMobile) return;
      this.mouseShotHeld = false;
    });
    this.input.on("pointerupoutside", () => {
      if (this.isMobile) return;
      this.mouseShotHeld = false;
    });

    this.roomClient.onState((state) => {
      this.state = state;
      this.renderState();
    });

    this.roomClient.onPlayerDied((event) => {
      this.lastDeathEvent = event;
    });
    this.roomClient.onPlayerRespawn(() => {
      this.lastDeathEvent = null;
    });
    this.roomClient.onScoreUpdated(() => {
      this.renderState();
    });
    this.roomClient.onBarrelExploded((payload) => {
      if (this.isMobile) return;
      const fx = this.add.circle(payload.x, payload.y, 12, 0xff9f43);
      this.tweens.add({
        targets: fx,
        radius: 95,
        alpha: 0,
        duration: 250,
        onComplete: () => fx.destroy(),
      });
    });
    this.roomClient.onBoxDestroyed((payload) => {
      if (this.isMobile) return;
      const fx = this.add.circle(payload.x, payload.y, 10, 0xfbbf24);
      this.tweens.add({
        targets: fx,
        radius: 45,
        alpha: 0,
        duration: 200,
        onComplete: () => fx.destroy(),
      });
    });

    this.setupWeaponHotkeys();
    if (this.isMobile) this.createMobileControls();
    this.loadMapOverlay();
  }

  update() {
    const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
    if (!me || !me.isAlive) {
      this.sendIdleInput();
      this.renderRespawnCountdown(me);
      return;
    }
    const input = this.getInput(me);
    this.roomClient.sendInput(input);
    this.handleAutoFire(me, input);
    if (input.changeWeapon) {
      const nextSlot = ((me.currentWeaponIndex ?? 0) + 1) % 3;
      this.roomClient.changeWeapon(nextSlot);
    }
    this.renderRespawnCountdown(me);
  }

  getInput(me) {
    if (!me) return { up: false, down: false, left: false, right: false, aimAngle: 0, shooting: false, changeWeapon: false };

    if (this.isMobile) {
      const up = this.mobileInput.moveY < -0.3;
      const down = this.mobileInput.moveY > 0.3;
      const left = this.mobileInput.moveX < -0.3;
      const right = this.mobileInput.moveX > 0.3;
      let aimAngle = this.mobileInput.aimAngle;
      if (!this.mobileInput.shotHeld && (up || down || left || right)) {
        aimAngle = Math.atan2(this.mobileInput.moveY, this.mobileInput.moveX);
      }
      const changeWeapon = this.mobileInput.wantWeaponSwap;
      this.mobileInput.wantWeaponSwap = false;
      return { up, down, left, right, aimAngle, shooting: this.mobileInput.shotHeld, changeWeapon };
    }

    const pointer = this.input.activePointer;
    const aimAngle = Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY);
    return {
      up: this.cursors?.w?.isDown ?? false,
      down: this.cursors?.s?.isDown ?? false,
      left: this.cursors?.a?.isDown ?? false,
      right: this.cursors?.d?.isDown ?? false,
      aimAngle,
      shooting: this.mouseShotHeld,
      changeWeapon: false,
    };
  }

  handleAutoFire(me, input) {
    if (!input.shooting) return;
    const now = this.time.now;
    const fireCadenceMs = this.isMobile ? 140 : 110;
    const lastShotAt = this.isMobile ? this.mobileInput.lastShotAt : this.lastMouseShotAt;
    if (now - lastShotAt < fireCadenceMs) return;
    this.roomClient.shoot(input.aimAngle);
    if (this.isMobile) this.mobileInput.lastShotAt = now;
    else this.lastMouseShotAt = now;
  }

  renderState() {
    this.syncEntities(
      this.playerSprites,
      this.state.players,
      (player) => {
        const isMe = player.id === this.roomClient.socketId;
        return this.add.circle(player.x, player.y, 16, isMe ? 0x45d37b : 0x59a7ff);
      },
      (sprite, player) => {
        sprite.setPosition(player.x, player.y);
        const color = player.id === this.roomClient.socketId ? 0x45d37b : 0x59a7ff;
        sprite.setFillStyle(player.isAlive ? color : 0x666666);
        sprite.setVisible(player.isAlive);
      },
    );
    this.syncEntities(
      this.playerNameTexts,
      this.state.players,
      (player) =>
        this.add.text(player.x, player.y - 28, player.name || "Player", {
          color: "#ffffff",
          fontSize: "14px",
          stroke: "#000000",
          strokeThickness: 3,
        }).setOrigin(0.5),
      (text, player) => {
        text.setPosition(player.x, player.y - 28);
        text.setText(player.name || "Player");
        text.setVisible(player.isAlive);
      },
    );

    this.syncEntities(
      this.zombieSprites,
      this.state.zombies,
      (zombie) => this.add.circle(zombie.x, zombie.y, 14, this.zombieColor(zombie.type)),
      (sprite, zombie) => {
        sprite.setPosition(zombie.x, zombie.y);
        sprite.setFillStyle(this.zombieColor(zombie.type));
      },
    );

    this.syncEntities(
      this.bulletSprites,
      this.state.bullets,
      (bullet) => this.add.circle(bullet.x, bullet.y, 4, 0xf9df67),
      (sprite, bullet) => {
        sprite.setPosition(bullet.x, bullet.y);
      },
    );
    this.syncEntities(
      this.wallSprites,
      this.state.walls,
      (wall) => this.add.rectangle(wall.x, wall.y, 40, 40, wall.destructible ? 0x6b7280 : 0x374151),
      (sprite, wall) => {
        sprite.setPosition(wall.x, wall.y);
        sprite.setFillStyle(wall.destructible ? 0x6b7280 : 0x374151);
      },
    );
    this.syncEntities(
      this.barrelSprites,
      this.state.barrels,
      (barrel) => this.add.circle(barrel.x, barrel.y, 14, 0xdc2626),
      (sprite, barrel) => {
        sprite.setPosition(barrel.x, barrel.y);
      },
    );
    this.syncEntities(
      this.boxSprites,
      this.state.boxes,
      (box) => this.add.rectangle(box.x, box.y, 28, 28, 0xb45309),
      (sprite, box) => {
        sprite.setPosition(box.x, box.y);
      },
    );
    this.syncEntities(
      this.itemSprites,
      this.state.items,
      (item) => this.add.circle(item.x, item.y, 8, item.type === "health" ? 0x22c55e : 0x60a5fa),
      (sprite, item) => {
        sprite.setPosition(item.x, item.y);
        sprite.setFillStyle(item.type === "health" ? 0x22c55e : 0x60a5fa);
      },
    );

    const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
    if (me) {
      this.hpText.setText(`HP: ${me.hp}${me.isAlive ? "" : " (Muerto)"}`);
      this.scoreText.setText(`Score: ${me.score ?? 0}`);
      this.kdText.setText(`K/D: ${me.kills ?? 0}/${me.deaths ?? 0}`);
      this.weaponText.setText(`Arma: ${me.currentWeaponId || "pistol"} (slot ${me.currentWeaponIndex ?? 0})`);
      this.cameras.main.startFollow(this.playerSprites.get(me.id), true, 0.18, 0.18);
      this.renderRespawnCountdown(me);
    }
  }

  renderRespawnCountdown(me) {
    if (!me || me.isAlive || !me.respawnAt) {
      this.respawnText.setText("");
      return;
    }
    const remainingMs = Math.max(0, me.respawnAt - Date.now());
    const seconds = Math.ceil(remainingMs / 1000);
    this.respawnText.setText(`Respawn en ${seconds} segundos`);
  }

  sendIdleInput() {
    this.roomClient.sendInput({ up: false, down: false, left: false, right: false, aimAngle: 0 });
  }

  setupWeaponHotkeys() {
    const keyMap = [
      Phaser.Input.Keyboard.KeyCodes.ZERO,
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
    ];
    if (!this.input.keyboard || this.isMobile) return;
    keyMap.forEach((code, index) => {
      const key = this.input.keyboard.addKey(code);
      key.on("down", () => this.roomClient.changeWeapon(index));
    });
  }

  createMobileControls() {
    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;
    const joystickX = 130;
    const joystickY = height - 130;
    const baseRadius = 74;
    const stickRadius = 36;

    this.joystickBase = this.add.circle(joystickX, joystickY, baseRadius, 0x334155, 0.35).setScrollFactor(0);
    this.joystickStick = this.add.circle(joystickX, joystickY, stickRadius, 0x60a5fa, 0.7).setScrollFactor(0);
    this.fireButton = this.add
      .circle(width - 120, height - 120, 62, 0xef4444, 0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    this.fireLabel = this.add
      .text(width - 120, height - 120, "FIRE", { color: "#ffffff", fontSize: "20px", fontStyle: "bold" })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.weaponButton = this.add
      .circle(width - 245, height - 200, 44, 0x22c55e, 0.45)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    this.weaponLabel = this.add
      .text(width - 245, height - 200, "ARMA", { color: "#ffffff", fontSize: "12px" })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const joystickHit = this.add.circle(joystickX, joystickY, baseRadius + 25, 0x000000, 0.001).setScrollFactor(0).setInteractive();

    const setJoystickFromPointer = (pointer) => {
      const dx = pointer.x - joystickX;
      const dy = pointer.y - joystickY;
      const distance = Math.hypot(dx, dy);
      const clamped = Math.min(distance, baseRadius);
      const nx = distance > 0 ? dx / distance : 0;
      const ny = distance > 0 ? dy / distance : 0;
      this.mobileInput.moveX = nx * (clamped / baseRadius);
      this.mobileInput.moveY = ny * (clamped / baseRadius);
      this.joystickStick.setPosition(joystickX + nx * clamped, joystickY + ny * clamped);
    };

    joystickHit.on("pointerdown", (pointer) => {
      this.mobileInput.aimingPointerId = pointer.id;
      setJoystickFromPointer(pointer);
    });
    this.input.on("pointermove", (pointer) => {
      if (this.mobileInput.aimingPointerId === pointer.id) {
        setJoystickFromPointer(pointer);
      }
      if (this.mobileInput.firePointerId === pointer.id) {
        const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
        if (me) {
          this.mobileInput.aimAngle = Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY);
        }
      }
    });
    this.input.on("pointerup", (pointer) => {
      if (this.mobileInput.aimingPointerId === pointer.id) {
        this.mobileInput.aimingPointerId = null;
        this.mobileInput.moveX = 0;
        this.mobileInput.moveY = 0;
        this.joystickStick.setPosition(joystickX, joystickY);
      }
      if (this.mobileInput.firePointerId === pointer.id) {
        this.mobileInput.firePointerId = null;
        this.mobileInput.shotHeld = false;
        this.fireButton.setFillStyle(0xef4444, 0.5);
      }
    });
    this.input.on("pointerupoutside", (pointer) => {
      if (this.mobileInput.aimingPointerId === pointer.id || this.mobileInput.firePointerId === pointer.id) {
        this.mobileInput.aimingPointerId = null;
        this.mobileInput.firePointerId = null;
        this.mobileInput.shotHeld = false;
        this.mobileInput.moveX = 0;
        this.mobileInput.moveY = 0;
        this.fireButton.setFillStyle(0xef4444, 0.5);
        this.joystickStick.setPosition(joystickX, joystickY);
      }
    });
    this.fireButton.on("pointerdown", (pointer) => {
      this.mobileInput.firePointerId = pointer.id;
      this.mobileInput.shotHeld = true;
      this.fireButton.setFillStyle(0xf97316, 0.72);
      const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
      if (me) {
        this.mobileInput.aimAngle = Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY);
      }
    });
    this.weaponButton.on("pointerdown", () => {
      this.mobileInput.wantWeaponSwap = true;
    });
  }

  zombieColor(type) {
    if (type === "fast") return 0xf59e0b;
    if (type === "tank") return 0x7c3aed;
    if (type === "erratic") return 0x06b6d4;
    return 0xd65454;
  }

  async loadMapOverlay() {
    try {
      const mapId = this.roomClient.lobby?.selectedMap || "default";
      const map = await MapLoader.fetchMap(mapId);
      this.clearMapOverlay();
      for (const obj of map.objects || []) {
        const x = obj.col * 40 + 20;
        const y = obj.row * 40 + 20;
        let shape = null;
        if (obj.type === "wall") shape = this.add.rectangle(x, y, 40, 40, 0x475569, 0.22);
        else if (obj.type === "destructibleWall") shape = this.add.rectangle(x, y, 40, 40, 0x94a3b8, 0.22);
        else if (obj.type === "barrel") shape = this.add.circle(x, y, 14, 0xdc2626, 0.22);
        else if (obj.type === "box") shape = this.add.rectangle(x, y, 28, 28, 0xb45309, 0.22);
        if (shape) this.mapOverlay.push(shape);
      }
    } catch {
      // Si falla carga del JSON, no bloqueamos la escena.
    }
  }

  clearMapOverlay() {
    this.mapOverlay.forEach((shape) => shape.destroy());
    this.mapOverlay = [];
  }

  syncEntities(store, entities, createFn, updateFn) {
    const currentIds = new Set(entities.map((e) => e.id));

    for (const [id, sprite] of store.entries()) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        store.delete(id);
      }
    }

    for (const entity of entities) {
      let sprite = store.get(entity.id);
      if (!sprite) {
        sprite = createFn(entity);
        store.set(entity.id, sprite);
      }
      updateFn(sprite, entity);
    }
  }
}
