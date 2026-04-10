import { socket } from "./socket.js";

export class RoomClient {
  constructor() {
    this.lobby = null;
    this.listeners = {
      onLobbyUpdate: () => {},
      onState: () => {},
      onMessage: () => {},
      onGameStarted: () => {},
      onPlayerDied: () => {},
      onPlayerRespawn: () => {},
      onScoreUpdated: () => {},
    };

    socket.on("connect", () => {
      this.listeners.onMessage("Conectado al servidor.", false);
    });

    socket.on("disconnect", () => {
      this.listeners.onMessage("Desconectado del servidor.", true);
      this.lobby = null;
      this.listeners.onLobbyUpdate(null);
    });

    socket.on("connect_error", (error) => {
      this.listeners.onMessage(`Error de conexion con servidor: ${error.message}`, true);
    });

    const handleLobbyPayload = (payload) => {
      this.lobby = payload;
      this.listeners.onLobbyUpdate(payload);
    };

    socket.on("room-created", (payload) => {
      handleLobbyPayload(payload);
      this.listeners.onMessage(`Sala creada: ${payload.roomCode}`, false);
    });
    socket.on("createRoom", handleLobbyPayload);

    socket.on("room-joined", (payload) => {
      handleLobbyPayload(payload);
      this.listeners.onMessage(`Te uniste a la sala ${payload.roomCode}`, false);
    });
    socket.on("joinRoom", handleLobbyPayload);

    socket.on("room-update", handleLobbyPayload);
    socket.on("updateLobby", handleLobbyPayload);

    socket.on("gameStarted", (payload) => {
      handleLobbyPayload(payload);
      this.listeners.onGameStarted(payload);
      this.listeners.onMessage("Partida iniciada.", false);
    });
    socket.on("game-started", (payload) => {
      handleLobbyPayload(payload);
      this.listeners.onGameStarted(payload);
    });

    socket.on("state", (state) => {
      this.listeners.onState(state);
    });

    socket.on("error-message", (message) => {
      this.listeners.onMessage(message, true);
    });

    socket.on("playerDied", (payload) => {
      this.listeners.onPlayerDied(payload);
    });
    socket.on("playerRespawn", (payload) => {
      this.listeners.onPlayerRespawn(payload);
    });
    socket.on("scoreUpdated", (payload) => {
      this.listeners.onScoreUpdated(payload);
    });

    window.addEventListener("beforeunload", () => {
      socket.emit("leaveRoom");
    });
  }

  onLobbyUpdate(cb) {
    this.listeners.onLobbyUpdate = cb;
  }

  onState(cb) {
    this.listeners.onState = cb;
  }

  onMessage(cb) {
    this.listeners.onMessage = cb;
  }

  onGameStarted(cb) {
    this.listeners.onGameStarted = cb;
  }

  onPlayerDied(cb) {
    this.listeners.onPlayerDied = cb;
  }

  onPlayerRespawn(cb) {
    this.listeners.onPlayerRespawn = cb;
  }

  onScoreUpdated(cb) {
    this.listeners.onScoreUpdated = cb;
  }

  createRoom() {
    socket.emit("createRoom");
  }

  joinRoom(roomCode) {
    socket.emit("joinRoom", { roomCode: roomCode.toUpperCase() });
  }

  leaveRoom() {
    socket.emit("leaveRoom");
    this.lobby = null;
    this.listeners.onLobbyUpdate(null);
  }

  selectMap(selectedMap) {
    socket.emit("selectMap", { selectedMap });
  }

  startGame() {
    socket.emit("startGame");
  }

  changeWeapon(weaponIndex) {
    socket.emit("changeWeapon", { weaponIndex });
  }

  sendInput(input) {
    socket.emit("input-update", input);
  }

  shoot(aimAngle) {
    socket.emit("shoot", { aimAngle });
  }

  get socketId() {
    return socket.id;
  }

  get isInRoom() {
    return Boolean(this.lobby?.roomCode);
  }
}
