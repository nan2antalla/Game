import { io } from "socket.io-client";
import { SERVER_URL } from "../config.js";

export const socket = io(SERVER_URL, {
  transports: ["websocket"],
});
