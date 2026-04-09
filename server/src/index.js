import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameServer } from "./game/GameServer.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const normalizeOrigin = (value) => value.replace(/\/+$/, "");

const allowedOrigins = CLIENT_URL.split(",")
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean);

const strictCors = process.env.STRICT_CORS === "1" || process.env.STRICT_CORS === "true";

function isHttpsNetlifyOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.hostname.endsWith(".netlify.app");
  } catch {
    return false;
  }
}

const isAllowedOrigin = (origin) => {
  // En desarrollo permitimos acceso flexible para evitar bloqueos de CORS.
  if (process.env.NODE_ENV !== "production") return true;
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.some((allowed) => allowed === normalized)) return true;
  // Netlify siempre usa https://algo.netlify.app; evita fallos si CLIENT_URL no coincide al caracter.
  if (!strictCors && isHttpsNetlifyOrigin(origin)) return true;
  return false;
};

const corsOriginCallback = (origin, callback) => {
  if (isAllowedOrigin(origin)) return callback(null, true);
  return callback(null, false);
};

const app = express();
app.use(
  cors({
    origin: corsOriginCallback,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "boxhead-server" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCallback,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  },
  allowEIO3: true,
});

const gameServer = new GameServer(io);

io.on("connection", (socket) => {
  gameServer.onConnection(socket);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed client origin(s): ${allowedOrigins.join(", ")}`);
  if (process.env.NODE_ENV === "production" && allowedOrigins.some((o) => o.includes("localhost"))) {
    console.warn(
      "[boxhead-server] CLIENT_URL incluye localhost en produccion. Configura en Render la URL publica de Netlify (ej. https://tu-sitio.netlify.app) o el handshake Socket.IO fallara.",
    );
  }
});
