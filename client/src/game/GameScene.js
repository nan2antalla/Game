import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  constructor(roomClient) {
    super("game-scene");
    this.roomClient = roomClient;
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
  }

  create() {
    this.add.rectangle(600, 400, 1200, 800, 0x1a2233).setOrigin(0.5);
    this.cursors = {
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
      const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
      if (!me || !me.isAlive) return;
      const pointer = this.input.activePointer;
      const angle = Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY);
      this.roomClient.shoot(angle);
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
  }

  update() {
    const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
    if (!me || !me.isAlive) {
      this.sendIdleInput();
      this.renderRespawnCountdown(me);
      return;
    }
    const pointer = this.input.activePointer;
    const aimAngle = me ? Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY) : 0;

    this.roomClient.sendInput({
      up: this.cursors.w.isDown,
      down: this.cursors.s.isDown,
      left: this.cursors.a.isDown,
      right: this.cursors.d.isDown,
      aimAngle,
    });
    this.renderRespawnCountdown(me);
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
    this.roomClient.sendInput({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: 0,
    });
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
    keyMap.forEach((code, index) => {
      const key = this.input.keyboard.addKey(code);
      key.on("down", () => this.roomClient.changeWeapon(index));
    });
  }

  zombieColor(type) {
    if (type === "fast") return 0xf59e0b;
    if (type === "tank") return 0x7c3aed;
    if (type === "erratic") return 0x06b6d4;
    return 0xd65454;
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
