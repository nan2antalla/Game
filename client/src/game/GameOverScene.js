import Phaser from "phaser";

export class GameOverScene extends Phaser.Scene {
  constructor(roomClient) {
    super("game-over-scene");
    this.roomClient = roomClient;
    this.lastResult = null;
  }

  init(data) {
    this.lastResult = data?.result || null;
  }

  create() {
    this.add.rectangle(600, 400, 1200, 800, 0x0b1020).setOrigin(0.5);
    this.add.text(600, 60, "Resultados finales", { color: "#ffffff", fontSize: "42px" }).setOrigin(0.5);

    const result = this.lastResult || { ranking: [], winnerId: null, mode: "score", reason: "-" };
    const meId = this.roomClient.socketId;
    const won = result.winnerId && result.winnerId === meId;

    this.add
      .text(600, 110, won ? "GANASTE" : "PERDISTE", { color: won ? "#4ade80" : "#f87171", fontSize: "34px" })
      .setOrigin(0.5);
    this.add.text(600, 145, `Modo: ${result.mode} | Motivo: ${result.reason}`, { color: "#cbd5e1", fontSize: "18px" }).setOrigin(0.5);

    const rankingLines = result.ranking.map((p, i) => {
      const names = p.killedPlayersList?.length ? p.killedPlayersList.join(", ") : "-";
      return `${i + 1}. ${p.name} | Score ${p.score} | KP ${p.killsPlayers} | KZ ${p.killsZombies} | D ${p.deaths} | Mató: ${names}`;
    });
    this.resultsText = this.add
      .text(60, 200, rankingLines.join("\n"), { color: "#e2e8f0", fontSize: "20px", wordWrap: { width: 1080 } })
      .setOrigin(0, 0);

    this.downloadBtn = this.add
      .text(600, 740, "Descargar resultados (PNG)", {
        color: "#ffffff",
        fontSize: "24px",
        backgroundColor: "#2563eb",
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.downloadBtn.on("pointerdown", () => {
      this.game.renderer.snapshot((image) => {
        const a = document.createElement("a");
        a.download = `resultados-${Date.now()}.png`;
        a.href = image.src;
        a.click();
      });
    });
  }
}
