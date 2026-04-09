import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  constructor(roomClient) {
    super("game-scene");
    this.roomClient = roomClient;
    this.state = { players: [], zombies: [], bullets: [] };
    this.playerSprites = new Map();
    this.zombieSprites = new Map();
    this.bulletSprites = new Map();
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
  }

  update() {
    const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
    const pointer = this.input.activePointer;
    const aimAngle = me ? Phaser.Math.Angle.Between(me.x, me.y, pointer.worldX, pointer.worldY) : 0;

    this.roomClient.sendInput({
      up: this.cursors.w.isDown,
      down: this.cursors.s.isDown,
      left: this.cursors.a.isDown,
      right: this.cursors.d.isDown,
      aimAngle,
    });
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
      },
    );

    this.syncEntities(
      this.zombieSprites,
      this.state.zombies,
      (zombie) => this.add.circle(zombie.x, zombie.y, 14, 0xd65454),
      (sprite, zombie) => {
        sprite.setPosition(zombie.x, zombie.y);
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

    const me = this.state.players.find((p) => p.id === this.roomClient.socketId);
    if (me) this.hpText.setText(`HP: ${me.hp}${me.isAlive ? "" : " (Muerto)"}`);
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
