import { socket } from "./socket.js";

export class RoomClient {
  constructor() {
    this.lobby = null;
    this.lobbyUpdateListeners = [];
    this.listeners = {
      onLobbyUpdate: () => {},
      onState: () => {},
      onMessage: () => {},
      onGameStarted: () => {},
      onPlayerDied: () => {},
      onPlayerRespawn: () => {},
      onScoreUpdated: () => {},
      onGameOver: () => {},
      onBarrelExploded: () => {},
      onBoxDestroyed: () => {},
      onItemDropped: () => {},
      onMapsList: () => {},
    };

    socket.on("connect", () => {
      this.listeners.onMessage("Conectado al servidor.", false);
    });

    socket.on("disconnect", () => {
      this.listeners.onMessage("Desconectado del servidor.", true);
      this.lobby = null;
      this.notifyLobbyUpdate(null);
    });

    socket.on("connect_error", (error) => {
      this.listeners.onMessage(`Error de conexion con servidor: ${error.message}`, true);
    });

    const handleLobbyPayload = (payload) => {
      this.lobby = payload;
      this.notifyLobbyUpdate(payload);
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
    socket.on("gameOver", (payload) => {
      this.listeners.onGameOver(payload);
    });
    socket.on("barrelExploded", (payload) => {
      this.listeners.onBarrelExploded(payload);
    });
    socket.on("boxDestroyed", (payload) => {
      this.listeners.onBoxDestroyed(payload);
    });
    socket.on("itemDropped", (payload) => {
      this.listeners.onItemDropped(payload);
    });
    socket.on("mapsList", (payload) => {
      this.listeners.onMapsList(payload);
    });

    window.addEventListener("beforeunload", () => {
      socket.emit("leaveRoom");
    });
  }

  notifyLobbyUpdate(payload) {
    this.listeners.onLobbyUpdate(payload);
    for (const cb of this.lobbyUpdateListeners) {
      try {
        cb(payload);
      } catch {
        /* ignore */
      }
    }
  }

  /** Registra un callback adicional (no sustituye al de main.js). */
  onLobbySceneUpdate(cb) {
    this.lobbyUpdateListeners.push(cb);
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

  onGameOver(cb) {
    this.listeners.onGameOver = cb;
  }

  onBarrelExploded(cb) {
    this.listeners.onBarrelExploded = cb;
  }

  onBoxDestroyed(cb) {
    this.listeners.onBoxDestroyed = cb;
  }

  onItemDropped(cb) {
    this.listeners.onItemDropped = cb;
  }

  onMapsList(cb) {
    this.listeners.onMapsList = cb;
  }

  createRoom(playerName) {
    socket.emit("createRoom", { playerName });
  }

  joinRoom(roomCode, playerName) {
    socket.emit("joinRoom", { roomCode: roomCode.toUpperCase(), playerName });
  }

  leaveRoom() {
    socket.emit("leaveRoom");
    this.lobby = null;
    this.notifyLobbyUpdate(null);
  }

  selectMap(selectedMap) {
    socket.emit("selectMap", { selectedMap });
  }

  startGame() {
    socket.emit("startGame");
  }

  updateMode(modePayload) {
    socket.emit("updateMode", modePayload);
  }

  requestMaps() {
    socket.emit("requestMaps");
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
