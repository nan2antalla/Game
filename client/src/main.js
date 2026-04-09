import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";
import { GameScene } from "./game/GameScene.js";
import { RoomClient } from "./network/RoomClient.js";

const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinRoomInput = document.getElementById("join-room-input");
const roomCodeText = document.getElementById("room-code");
const playersList = document.getElementById("players-list");
const messageText = document.getElementById("message");
const gameRoot = document.getElementById("game-root");

const roomClient = new RoomClient();
let phaserGame = null;

function renderLobby({ roomCode, players }) {
  roomCodeText.textContent = roomCode ? `Sala actual: ${roomCode}` : "No estas en una sala.";
  playersList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.id === roomClient.socketId ? `${player.name} (tu)` : player.name;
    playersList.appendChild(li);
  });

  const inRoom = Boolean(roomCode);
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  joinRoomInput.disabled = inRoom;

  if (inRoom && !phaserGame) {
    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: gameRoot,
      backgroundColor: "#111827",
      scene: [new GameScene(roomClient)],
    });
  }
}

function renderMessage(message, isError) {
  messageText.textContent = message;
  messageText.className = isError ? "error" : "status";
}

roomClient.onRoomUpdate(renderLobby);
roomClient.onMessage(renderMessage);

createRoomBtn.addEventListener("click", () => {
  roomClient.createRoom();
});

joinRoomBtn.addEventListener("click", () => {
  const roomCode = joinRoomInput.value.trim().toUpperCase();
  if (roomCode.length !== 4) {
    renderMessage("El codigo debe tener 4 letras.", true);
    return;
  }
  roomClient.joinRoom(roomCode);
});

joinRoomInput.addEventListener("input", () => {
  joinRoomInput.value = joinRoomInput.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
});

renderLobby({ roomCode: null, players: [] });
