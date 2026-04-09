import { socket } from "./socket.js";

export class RoomClient {
  constructor() {
    this.roomCode = null;
    this.players = [];
    this.listeners = {
      onRoomUpdate: () => {},
      onState: () => {},
      onMessage: () => {},
    };

    socket.on("connect", () => {
      this.listeners.onMessage("Conectado al servidor.", false);
    });

    socket.on("disconnect", () => {
      this.listeners.onMessage("Desconectado del servidor.", true);
      this.roomCode = null;
      this.players = [];
      this.listeners.onRoomUpdate({ roomCode: null, players: [] });
    });

    socket.on("connect_error", (error) => {
      this.listeners.onMessage(`Error de conexion con servidor: ${error.message}`, true);
    });

    socket.on("room-created", ({ roomCode, players }) => {
      this.roomCode = roomCode;
      this.players = players;
      this.listeners.onRoomUpdate({ roomCode, players });
      this.listeners.onMessage(`Sala creada: ${roomCode}`, false);
    });

    socket.on("room-joined", ({ roomCode, players }) => {
      this.roomCode = roomCode;
      this.players = players;
      this.listeners.onRoomUpdate({ roomCode, players });
      this.listeners.onMessage(`Te uniste a la sala ${roomCode}`, false);
    });

    socket.on("room-update", ({ roomCode, players }) => {
      this.roomCode = roomCode;
      this.players = players;
      this.listeners.onRoomUpdate({ roomCode, players });
    });

    socket.on("state", (state) => {
      this.listeners.onState(state);
    });

    socket.on("error-message", (message) => {
      this.listeners.onMessage(message, true);
    });
  }

  onRoomUpdate(cb) {
    this.listeners.onRoomUpdate = cb;
  }

  onState(cb) {
    this.listeners.onState = cb;
  }

  onMessage(cb) {
    this.listeners.onMessage = cb;
  }

  createRoom() {
    socket.emit("create-room");
  }

  joinRoom(roomCode) {
    socket.emit("join-room", { roomCode: roomCode.toUpperCase() });
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
}
