import { SERVER_URL } from "../config.js";

export class MapLoader {
  static async fetchMaps() {
    const response = await fetch(`${SERVER_URL}/maps/index`);
    if (!response.ok) throw new Error("No se pudieron cargar mapas");
    return response.json();
  }

  static async fetchMap(mapId) {
    const response = await fetch(`${SERVER_URL}/maps/${mapId}.json`);
    if (!response.ok) throw new Error("No se pudo cargar JSON del mapa");
    return response.json();
  }
}
