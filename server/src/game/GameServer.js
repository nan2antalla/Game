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
    socket.on("create-room", () => this.handleCreateRoom(socket));
    socket.on("join-room", (payload) => this.handleJoinRoom(socket, payload));
    socket.on("input-update", (input) => this.handleInput(socket, input));
    socket.on("shoot", (payload) => this.handleShoot(socket, payload));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  handleCreateRoom(socket) {
    if (this.playerRoomBySocket.has(socket.id)) {
      socket.emit("error-message", "Ya estas dentro de una sala.");
      return;
    }

    const roomCode = generateRoomCode(new Set(this.rooms.keys()));
    const room = new Room(roomCode);
    this.rooms.set(roomCode, room);

    room.addPlayer(socket.id);
    this.playerRoomBySocket.set(socket.id, roomCode);
    socket.join(roomCode);

    socket.emit("room-created", { roomCode, players: room.getLobbyPlayers() });
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
    if (!room.canJoin) {
      socket.emit("error-message", "La sala esta llena (4/4).");
      return;
    }

    room.addPlayer(socket.id);
    this.playerRoomBySocket.set(socket.id, roomCode);
    socket.join(roomCode);

    socket.emit("room-joined", { roomCode, players: room.getLobbyPlayers() });
    this.broadcastLobby(roomCode);
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

  handleDisconnect(socket) {
    const roomCode = this.playerRoomBySocket.get(socket.id);
    if (!roomCode) return;

    this.playerRoomBySocket.delete(socket.id);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.removePlayer(socket.id);
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return;
    }

    this.broadcastLobby(roomCode);
  }

  getRoomForSocket(socketId) {
    const roomCode = this.playerRoomBySocket.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  broadcastLobby(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    this.io.to(roomCode).emit("room-update", { roomCode, players: room.getLobbyPlayers() });
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
        this.io.to(room.code).emit("state", room.buildState());
      }
      this.lastBroadcastAt = now;
    }
  }
}
