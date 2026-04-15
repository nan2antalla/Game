import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";
import { GameScene } from "./game/GameScene.js";
import { GameOverScene } from "./game/GameOverScene.js";
import { LobbyScene } from "./game/LobbyScene.js";
import { RoomClient } from "./network/RoomClient.js";
import { isMobileDevice, isPortraitOrientation } from "./utils/device.js";

const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const joinRoomInput = document.getElementById("join-room-input");
const playerNameInput = document.getElementById("player-name-input");
const messageText = document.getElementById("message");
const gameRoot = document.getElementById("game-root");
const lobbyContainer = document.getElementById("lobby");
const orientationLock = document.getElementById("orientation-lock");

const roomClient = new RoomClient();
const isMobile = isMobileDevice();
let phaserGame = null;

async function requestMobileFullscreen() {
  if (!isMobile) return;
  if (document.fullscreenElement) return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch {
    // Algunos navegadores solo permiten fullscreen en gestos directos.
  }
}

function ensureGame() {
  if (phaserGame) return;
  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: gameRoot,
    backgroundColor: "#111827",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new LobbyScene(roomClient), new GameScene(roomClient, { isMobile }), new GameOverScene(roomClient)],
  });
}

function applyMobileOrientationLock() {
  if (!isMobile) return;
  const isPortrait = isPortraitOrientation();
  orientationLock.style.display = isPortrait ? "flex" : "none";
  gameRoot.style.display = isPortrait ? "none" : "block";
}

function renderLobbyState(lobbyState) {
  const inRoom = Boolean(lobbyState?.roomCode);
  createRoomBtn.disabled = inRoom;
  joinRoomBtn.disabled = inRoom;
  joinRoomInput.disabled = inRoom;
  playerNameInput.disabled = inRoom;
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
  requestMobileFullscreen();
  if (!phaserGame) return;
  phaserGame.scene.start("game-scene");
});
roomClient.onGameOver((result) => {
  if (!phaserGame) return;
  phaserGame.scene.start("game-over-scene", { result });
});

function getPlayerName() {
  const value = playerNameInput.value.trim();
  if (!value) {
    renderMessage("Debes ingresar un nombre.", true);
    return null;
  }
  if (value.length > 12) {
    renderMessage("El nombre debe tener maximo 12 caracteres.", true);
    return null;
  }
  return value;
}

createRoomBtn.addEventListener("click", () => {
  requestMobileFullscreen();
  const playerName = getPlayerName();
  if (!playerName) return;
  roomClient.createRoom(playerName);
});

joinRoomBtn.addEventListener("click", () => {
  requestMobileFullscreen();
  const roomCode = joinRoomInput.value.trim().toUpperCase();
  if (roomCode.length !== 4) {
    renderMessage("El codigo debe tener 4 letras.", true);
    return;
  }
  const playerName = getPlayerName();
  if (!playerName) return;
  roomClient.joinRoom(roomCode, playerName);
});

joinRoomInput.addEventListener("input", () => {
  joinRoomInput.value = joinRoomInput.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
});
playerNameInput.addEventListener("input", () => {
  playerNameInput.value = playerNameInput.value.slice(0, 12);
});

renderLobbyState(null);
applyMobileOrientationLock();
window.addEventListener("resize", applyMobileOrientationLock);
window.addEventListener("orientationchange", applyMobileOrientationLock);
