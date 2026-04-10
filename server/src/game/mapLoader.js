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
    const stem = path.basename(file, ".json");
    const id = safeName(stem);
    if (!id) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      const displayName =
        typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : stem;
      result.push({
        id,
        name: displayName,
        width: parsed.width,
        height: parsed.height,
        previewUrl: `/maps/${id}.png`,
        file,
      });
    } catch {
      // ignore malformed map
    }
  }
  return result;
}

/** Carga un mapa por el nombre real del archivo en disco (ej. "The House.json"). */
export async function loadMapFile(mapsDir, fileName) {
  const safe = path.basename(fileName);
  if (!safe.endsWith(".json")) return null;
  const filePath = path.join(mapsDir, safe);
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function loadMapById(mapsDir, mapId) {
  const id = safeName(mapId);
  if (!id) return null;
  const list = await listMaps(mapsDir);
  const entry = list.find((m) => m.id === id);
  if (!entry) return null;
  return loadMapFile(mapsDir, entry.file);
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
