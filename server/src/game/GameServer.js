import { STATE_BROADCAST_RATE, TICK_RATE } from "../config.js";
import { generateRoomCode } from "../utils/helpers.js";
import { Room } from "./Room.js";

export class GameServer {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRoomBySocket = new Map();
    this.lastTickAt = Date.now();
    this.lastBroadcastAt = Date.now();
    this.tickInterval = setInterval(() => this.tick(), Math.floor(1000 / TICK_RATE));
  }

  stop() {
    clearInterval(this.tickInterval);
  }

  onConnection(socket) {
    socket.on("create-room", (payload) => this.handleCreateRoom(socket, payload));
    socket.on("createRoom", (payload) => this.handleCreateRoom(socket, payload));
    socket.on("join-room", (payload) => this.handleJoinRoom(socket, payload));
    socket.on("joinRoom", (payload) => this.handleJoinRoom(socket, payload));
    socket.on("leaveRoom", () => this.handleLeaveRoom(socket));
    socket.on("leave-room", () => this.handleLeaveRoom(socket));
    socket.on("startGame", () => this.handleStartGame(socket));
    socket.on("selectMap", (payload) => this.handleSelectMap(socket, payload));
    socket.on("updateMode", (payload) => this.handleUpdateMode(socket, payload));
    socket.on("changeWeapon", (payload) => this.handleChangeWeapon(socket, payload));
    socket.on("input-update", (input) => this.handleInput(socket, input));
    socket.on("shoot", (payload) => this.handleShoot(socket, payload));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  handleCreateRoom(socket, payload) {
    if (this.playerRoomBySocket.has(socket.id)) {
      socket.emit("error-message", "Ya estas dentro de una sala.");
      return;
    }

    const roomCode = generateRoomCode(new Set(this.rooms.keys()));
    const room = new Room(roomCode);
    this.rooms.set(roomCode, room);

    const playerName = String(payload?.playerName || "").trim();
    const nameValidation = room.validatePlayerName(playerName);
    if (!nameValidation.ok) {
      socket.emit("error-message", nameValidation.reason);
      this.rooms.delete(roomCode);
      return;
    }

    const createdPlayer = room.addPlayer(socket.id, playerName);
    if (!createdPlayer) {
      socket.emit("error-message", "No se pudo crear el jugador en la sala.");
      this.rooms.delete(roomCode);
      return;
    }
    this.playerRoomBySocket.set(socket.id, roomCode);
    socket.join(roomCode);

    socket.emit("room-created", room.buildLobbyData());
    socket.emit("createRoom", room.buildLobbyData());
    this.broadcastLobby(roomCode);
  }

  handleJoinRoom(socket, payload) {
    if (this.playerRoomBySocket.has(socket.id)) {
      socket.emit("error-message", "Ya estas dentro de una sala.");
      return;
    }

    const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
    const room = this.rooms.get(roomCode);
    if (!room) {
      socket.emit("error-message", "Sala no encontrada.");
      return;
    }
    if (room.state !== "waiting") {
      socket.emit("error-message", "La partida ya inicio. No se puede unir.");
      return;
    }
    if (!room.canJoin) {
      socket.emit("error-message", "La sala esta llena (4/4).");
      return;
    }

    const playerName = String(payload?.playerName || "").trim();
    const nameValidation = room.validatePlayerName(playerName);
    if (!nameValidation.ok) {
      socket.emit("error-message", nameValidation.reason);
      return;
    }

    const joinedPlayer = room.addPlayer(socket.id, playerName);
    if (!joinedPlayer) {
      socket.emit("error-message", "No se pudo unir a la sala.");
      return;
    }
    this.playerRoomBySocket.set(socket.id, roomCode);
    socket.join(roomCode);

    socket.emit("room-joined", room.buildLobbyData());
    socket.emit("joinRoom", room.buildLobbyData());
    this.broadcastLobby(roomCode);
  }

  handleLeaveRoom(socket) {
    this.removeFromRoom(socket.id);
  }

  handleSelectMap(socket, payload) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;

    const selectedMap = payload?.selectedMap || "default";
    const result = room.setSelectedMap(socket.id, selectedMap);
    if (!result.ok) {
      socket.emit("error-message", result.reason);
      return;
    }

    this.broadcastLobby(room.code);
  }

  handleUpdateMode(socket, payload) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;
    const result = room.setModeSettings(socket.id, payload);
    if (!result.ok) {
      socket.emit("error-message", result.reason);
      return;
    }
    this.broadcastLobby(room.code);
  }

  handleStartGame(socket) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;

    const result = room.startGame(socket.id);
    if (!result.ok) {
      socket.emit("error-message", result.reason);
      return;
    }

    const payload = room.buildLobbyData();
    this.io.to(room.code).emit("gameStarted", payload);
    this.io.to(room.code).emit("game-started", payload);
    this.broadcastLobby(room.code);
  }

  handleInput(socket, input) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;
    room.applyInput(socket.id, input);
  }

  handleShoot(socket, payload) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;
    room.tryShoot(socket.id, payload?.aimAngle, Date.now());
  }

  handleChangeWeapon(socket, payload) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;
    const weaponIndex = Number(payload?.weaponIndex);
    const result = room.changeWeapon(socket.id, weaponIndex);
    if (!result.ok) {
      socket.emit("error-message", result.reason);
    }
  }

  handleDisconnect(socket) {
    this.removeFromRoom(socket.id);
  }

  getRoomForSocket(socketId) {
    const roomCode = this.playerRoomBySocket.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  broadcastLobby(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const payload = room.buildLobbyData();
    this.io.to(roomCode).emit("room-update", payload);
    this.io.to(roomCode).emit("updateLobby", payload);
  }

  removeFromRoom(socketId) {
    const roomCode = this.playerRoomBySocket.get(socketId);
    if (!roomCode) return;

    this.playerRoomBySocket.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.removePlayer(socketId);
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return;
    }

    this.broadcastLobby(roomCode);
  }

  tick() {
    const now = Date.now();
    const delta = now - this.lastTickAt;
    this.lastTickAt = now;

    for (const room of this.rooms.values()) {
      room.tick(delta, now);
    }

    if (now - this.lastBroadcastAt >= 1000 / STATE_BROADCAST_RATE) {
      for (const room of this.rooms.values()) {
        const events = room.consumeEvents();
        for (const event of events) {
          this.io.to(room.code).emit(event.type, event.payload);
        }
        if (room.state !== "playing") continue;
        this.io.to(room.code).emit("state", room.buildState());
      }
      this.lastBroadcastAt = now;
    }
  }
}
