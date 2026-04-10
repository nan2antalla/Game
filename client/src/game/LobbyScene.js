import Phaser from "phaser";

export class LobbyScene extends Phaser.Scene {
  constructor(roomClient) {
    super("lobby-scene");
    this.roomClient = roomClient;
    this.lobby = null;
  }

  create() {
    this.add.rectangle(600, 400, 1200, 800, 0x111827).setOrigin(0.5);
    this.add.text(600, 70, "Lobby", { color: "#ffffff", fontSize: "42px" }).setOrigin(0.5);

    this.roomCodeText = this.add.text(600, 130, "Sala: ----", { color: "#93c5fd", fontSize: "28px" }).setOrigin(0.5);
    this.stateText = this.add.text(600, 170, "Estado: waiting", { color: "#e5e7eb", fontSize: "22px" }).setOrigin(0.5);
    this.mapText = this.add.text(600, 220, "Mapa: default", { color: "#fef08a", fontSize: "24px" }).setOrigin(0.5);
    this.playersText = this.add.text(600, 330, "Jugadores:\n-", {
      color: "#e5e7eb",
      fontSize: "22px",
      align: "center",
      lineSpacing: 8,
    }).setOrigin(0.5);

    this.mapButton = this.add
      .text(600, 500, "Cambiar mapa: default", { color: "#fde68a", fontSize: "24px", backgroundColor: "#374151", padding: { x: 12, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.startButton = this.add
      .text(600, 570, "Iniciar partida", { color: "#ffffff", fontSize: "30px", backgroundColor: "#2563eb", padding: { x: 16, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.helperText = this.add.text(600, 640, "", { color: "#9ca3af", fontSize: "18px" }).setOrigin(0.5);
    this.modeText = this.add.text(600, 260, "Modo: score", { color: "#fca5a5", fontSize: "24px" }).setOrigin(0.5);
    this.modeDescText = this.add
      .text(600, 292, "", { color: "#cbd5e1", fontSize: "16px", align: "center", wordWrap: { width: 900 } })
      .setOrigin(0.5);

    this.modeButton = this.add
      .text(600, 450, "Modo: score", { color: "#ffffff", fontSize: "22px", backgroundColor: "#475569", padding: { x: 12, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.modeOptionButton = this.add
      .text(600, 530, "Meta: 500", { color: "#ffffff", fontSize: "22px", backgroundColor: "#334155", padding: { x: 12, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.mapButton.on("pointerdown", () => {
      if (!this.lobby) return;
      if (this.lobby.hostId !== this.roomClient.socketId) return;
      this.roomClient.selectMap("default");
    });

    this.startButton.on("pointerdown", () => {
      this.roomClient.startGame();
    });

    this.modeButton.on("pointerdown", () => {
      if (!this.lobby || this.lobby.hostId !== this.roomClient.socketId || this.lobby.state !== "waiting") return;
      const order = ["score", "time", "campaign"];
      const current = order.indexOf(this.lobby.mode || "score");
      const mode = order[(current + 1) % order.length];
      if (mode === "score") this.roomClient.updateMode({ mode, scoreLimit: 500 });
      else if (mode === "time") this.roomClient.updateMode({ mode, timeLimitMinutes: 5 });
      else this.roomClient.updateMode({ mode });
    });

    this.modeOptionButton.on("pointerdown", () => {
      if (!this.lobby || this.lobby.hostId !== this.roomClient.socketId || this.lobby.state !== "waiting") return;
      if (this.lobby.mode === "score") {
        const opts = [250, 500, 1000, 2500, 5000];
        const idx = opts.indexOf(this.lobby.scoreLimit || 500);
        const next = opts[(idx + 1) % opts.length];
        this.roomClient.updateMode({ mode: "score", scoreLimit: next });
      } else if (this.lobby.mode === "time") {
        const opts = [2, 5, 10, 30];
        const currentMin = Math.round((this.lobby.timeLimitMs || 300000) / 60000);
        const idx = opts.indexOf(currentMin);
        const next = opts[(idx + 1) % opts.length];
        this.roomClient.updateMode({ mode: "time", timeLimitMinutes: next });
      }
    });

    this.roomClient.onLobbyUpdate((lobby) => {
      this.lobby = lobby;
      if (this.scene.isActive()) this.renderLobby();
    });

    this.renderLobby();
  }

  renderLobby() {
    const lobby = this.lobby || this.roomClient.lobby;
    if (!lobby) return;

    this.roomCodeText.setText(`Sala: ${lobby.roomCode}`);
    this.stateText.setText(`Estado: ${lobby.state}`);
    this.mapText.setText(`Mapa: ${lobby.selectedMap}`);
    this.modeText.setText(`Modo: ${lobby.mode}`);
    this.modeDescText.setText(this.getModeDescription(lobby.mode));
    this.mapButton.setText(`Cambiar mapa: ${lobby.selectedMap}`);

    const players = lobby.players || [];
    const listText = players
      .map((player, index) => `${index + 1}. ${player.name}${player.isHost ? " (Host)" : ""}${player.id === this.roomClient.socketId ? " (Tu)" : ""}`)
      .join("\n");
    this.playersText.setText(`Jugadores (${players.length}/${lobby.maxPlayers}):\n${listText || "-"}`);

    const isHost = lobby.hostId === this.roomClient.socketId;
    const canStart = isHost && lobby.state === "waiting";

    this.startButton.setVisible(canStart);
    this.mapButton.setVisible(isHost && lobby.state === "waiting");
    this.modeButton.setVisible(isHost && lobby.state === "waiting");
    this.modeOptionButton.setVisible(isHost && lobby.state === "waiting");
    this.modeButton.setText(`Modo: ${lobby.mode}`);
    if (lobby.mode === "score") this.modeOptionButton.setText(`Meta: ${lobby.scoreLimit}`);
    else if (lobby.mode === "time") this.modeOptionButton.setText(`Tiempo: ${Math.round((lobby.timeLimitMs || 300000) / 60000)} min`);
    else this.modeOptionButton.setText("Campaña cooperativa");
    this.helperText.setText(
      canStart
        ? "Solo el host puede iniciar."
        : isHost
          ? "La partida ya esta en curso."
          : "Esperando que el host inicie la partida...",
    );
  }

  getModeDescription(mode) {
    if (mode === "score") return "El primer jugador en alcanzar la puntuacion objetivo gana.";
    if (mode === "time") return "El jugador con mayor puntuacion al finalizar el tiempo gana.";
    return "Sobrevive con tu equipo. No hay respawn. Si todos mueren, pierden.";
  }
}
