import { BARREL_MAX_HP, BOX_MAX_HP, WALL_MAX_HP, WORLD_CELL_SIZE } from "../config.js";

export function createWorld() {
  const walls = new Map();
  const barrels = new Map();
  const boxes = new Map();
  let nextId = 1;

  const addWall = (col, row, destructible = false) => {
    const id = `w-${nextId++}`;
    walls.set(id, { id, col, row, x: col * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, y: row * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, destructible, hp: WALL_MAX_HP, isAlive: true });
  };
  const addBarrel = (col, row) => {
    const id = `b-${nextId++}`;
    barrels.set(id, { id, col, row, x: col * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, y: row * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, hp: BARREL_MAX_HP, isAlive: true, exploding: false });
  };
  const addBox = (col, row) => {
    const id = `x-${nextId++}`;
    boxes.set(id, { id, col, row, x: col * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, y: row * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2, hp: BOX_MAX_HP, isAlive: true });
  };

  for (let c = 6; c <= 23; c += 1) {
    addWall(c, 6, true);
    addWall(c, 13, true);
  }
  for (let r = 7; r <= 12; r += 1) {
    addWall(6, r, false);
    addWall(23, r, false);
  }

  addBarrel(10, 9);
  addBarrel(19, 10);
  addBarrel(15, 8);
  addBox(12, 11);
  addBox(17, 9);
  addBox(14, 5);

  return { walls, barrels, boxes, items: new Map(), nextItemId: 1, spawnPoints: [] };
}
