import { promises as fs } from "node:fs";
import path from "node:path";
import { BARREL_MAX_HP, BOX_MAX_HP, WALL_MAX_HP, WORLD_CELL_SIZE } from "../config.js";

function safeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export async function listMaps(mapsDir) {
  let files = [];
  try {
    files = await fs.readdir(mapsDir);
  } catch {
    return [];
  }
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const result = [];
  for (const file of jsonFiles) {
    const filePath = path.join(mapsDir, file);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      const name = safeName(parsed.name || path.basename(file, ".json"));
      result.push({
        id: name,
        name: parsed.name || name,
        width: parsed.width,
        height: parsed.height,
        previewUrl: `/maps/${name}.png`,
        file: `${name}.json`,
      });
    } catch {
      // ignore malformed map
    }
  }
  return result;
}

export async function loadMapById(mapsDir, mapId) {
  const id = safeName(mapId);
  if (!id) return null;
  const filePath = path.join(mapsDir, `${id}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    return parsed;
  } catch {
    return null;
  }
}

export function buildWorldFromMap(mapData) {
  const world = { walls: new Map(), barrels: new Map(), boxes: new Map(), items: new Map(), nextItemId: 1, spawnPoints: [] };
  const objects = Array.isArray(mapData?.objects) ? mapData.objects : [];
  const spawnPoints = Array.isArray(mapData?.spawnPoints) ? mapData.spawnPoints : [];
  let next = 1;
  for (const point of spawnPoints) {
    world.spawnPoints.push({ x: point.x, y: point.y });
  }
  for (const obj of objects) {
    const col = Number(obj.col);
    const row = Number(obj.row);
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    const x = col * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2;
    const y = row * WORLD_CELL_SIZE + WORLD_CELL_SIZE / 2;
    if (obj.type === "wall") {
      const id = `w-${next++}`;
      world.walls.set(id, { id, col, row, x, y, destructible: false, hp: WALL_MAX_HP, isAlive: true });
    } else if (obj.type === "destructibleWall") {
      const id = `w-${next++}`;
      world.walls.set(id, { id, col, row, x, y, destructible: true, hp: WALL_MAX_HP, isAlive: true });
    } else if (obj.type === "barrel") {
      const id = `b-${next++}`;
      world.barrels.set(id, { id, col, row, x, y, hp: BARREL_MAX_HP, isAlive: true });
    } else if (obj.type === "box") {
      const id = `x-${next++}`;
      world.boxes.set(id, { id, col, row, x, y, hp: BOX_MAX_HP, isAlive: true });
    }
  }
  return world;
}
