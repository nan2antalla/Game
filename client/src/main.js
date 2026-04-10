import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";
import { GameScene } from "./game/GameScene.js";
import { LobbyScene } from "./game/LobbyScene.js";
import { RoomClient } from "./network/RoomClient.js";

const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinRoomInput = document.getElementById("join-room-input");
const messageText = document.getElementById("message");
const gameRoot = document.getElementById("game-root");
const lobbyContainer = document.getElementById("lobby");

const roomClient = new RoomClient();
let phaserGame = null;

function ensureGame() {
  if (phaserGame) return;
  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: gameRoot,
    backgroundColor: "#111827",
    scene: [new LobbyScene(roomClient), new GameScene(roomClient)],
  });
}

function renderLobbyState(lobbyState) {
  const inRoom = Boolean(lobbyState?.roomCode);
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  joinRoomInput.disabled = inRoom;
  lobbyContainer.style.display = inRoom ? "none" : "block";

  if (inRoom) {
    ensureGame();
    if (phaserGame?.scene?.isActive("game-scene")) return;
    if (lobbyState.state === "playing") {
      phaserGame.scene.start("game-scene");
    } else {
      phaserGame.scene.start("lobby-scene");
    }
  } else if (phaserGame) {
    phaserGame.destroy(true);
    phaserGame = null;
  }
}

function renderMessage(message, isError) {
  messageText.textContent = message;
  messageText.className = isError ? "error" : "status";
}

roomClient.onLobbyUpdate(renderLobbyState);
roomClient.onMessage(renderMessage);
roomClient.onGameStarted(() => {
  if (!phaserGame) return;
  phaserGame.scene.start("game-scene");
});

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

renderLobbyState(null);
