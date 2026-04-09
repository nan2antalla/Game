import { io } from "socket.io-client";
import { SERVER_URL } from "../config.js";

// Defecto de engine.io: polling y luego upgrade a websocket (mejor detras de proxies como Render).
export const socket = io(SERVER_URL);
