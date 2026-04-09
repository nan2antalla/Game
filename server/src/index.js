import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameServer } from "./game/GameServer.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = CLIENT_URL.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  // En desarrollo permitimos acceso flexible para evitar bloqueos de CORS.
  if (process.env.NODE_ENV !== "production") return true;
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("CORS bloqueado para este origen"));
    },
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "boxhead-server" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("CORS bloqueado para este origen"));
    },
    methods: ["GET", "POST"],
  },
});

const gameServer = new GameServer(io);

io.on("connection", (socket) => {
  gameServer.onConnection(socket);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed client origin(s): ${allowedOrigins.join(", ")}`);
});
