const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateRoomCode(existingCodes = new Set()) {
  let code = "";
  do {
    code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
  } while (existingCodes.has(code));

  return code;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function randomSpawn(width, height, margin = 60) {
  return {
    x: margin + Math.random() * (width - margin * 2),
    y: margin + Math.random() * (height - margin * 2),
  };
}
