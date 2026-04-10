# Boxhead Multiplayer Web Game

Juego web 2D top-down shooter estilo Boxhead con PvP + zombies, con servidor autoritativo.

## Estructura

```text
/client   -> Phaser 3 + Vite
/server   -> Node.js + Express + Socket.IO
/map-editor -> Herramienta web para crear mapas
/maps -> Mapas JSON + miniaturas PNG
```

## Funcionalidades implementadas

- Salas de 4 letras (crear/unirse), maximo 4 jugadores por sala.
- Lista de jugadores conectados en lobby.
- Sincronizacion en tiempo real via WebSockets.
- Estado autoritativo en servidor:
  - Posicion de jugadores.
  - Vida, direccion y disparos.
  - Colisiones de balas contra jugadores.
- Zombies gestionados por servidor:
  - Spawn periodico.
  - Persiguen al jugador vivo mas cercano.
  - Danio por contacto con cooldown.
- Manejo de desconexion:
  - El jugador se elimina de la sala.
  - Sala se destruye si queda vacia.
- Cliente no controla estado global, solo envia input/acciones.

## Requisitos

- Node.js 18+ (recomendado 20+)

## Como correr backend (local)

1. Ir a la carpeta servidor:
   ```bash
   cd server
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Crear archivo `.env` desde ejemplo:
   - Copiar `server/.env.example` a `server/.env`
4. Levantar servidor:
   ```bash
   npm run dev
   ```
5. Backend disponible en:
   - `http://localhost:3000`
   - health check: `http://localhost:3000/health`

## Como correr frontend (local)

1. Ir a la carpeta cliente:
   ```bash
   cd client
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Crear `.env` desde ejemplo:
   - Copiar `client/.env.example` a `client/.env`
4. Levantar frontend:
   ```bash
   npm run dev
   ```
5. Abrir URL de Vite (normalmente `http://localhost:5173`).

## Deploy backend en Render

1. Crear un nuevo **Web Service** en Render apuntando a repo/carpeta `server`.
2. Configurar:
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Variables de entorno (obligatorio para que Netlify pueda conectar Socket.IO):
   - `CLIENT_URL` = URL exacta del sitio en Netlify, sin barra final (ejemplo `https://tu-juego.netlify.app`).
     Si dejas `http://localhost:5173` en Render, el servidor en produccion rechaza el origen de Netlify y veras errores `WebSocket connection failed` en la consola.
   - `PORT`: en Render no hace falta fijarlo; Render asigna `PORT` automaticamente (el codigo ya usa `process.env.PORT`).
   - Opcional: usa **npm** en Render (`npm install` / `npm start`) y evita mezclar `yarn` con `package-lock.json` para no tener advertencias de lockfiles.
4. Desplegar y copiar la URL publica del backend.

## Deploy frontend en Netlify

1. Crear sitio en Netlify apuntando a carpeta `client`.
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Definir variable de entorno:
   - `VITE_SERVER_URL` = URL publica del backend Render.
4. Redeploy.

## Controles

- `WASD`: mover
- Mouse: apuntar
- Click izquierdo: disparar

## Editor de mapas

1. Abre `map-editor/index.html` en el navegador (doble clic). El script **no** usa `type="module"` para que funcione con `file://`.
   - Si aun asi prefieres HTTP: desde la raiz del repo ejecuta `npx --yes serve map-editor -p 5500` y entra a `http://localhost:5500`.
2. Selecciona herramienta (pared, barril, caja, pared destructible, spawn, borrar).
3. Diseña el grid 20x15.
4. Usa:
   - `Exportar JSON` -> genera `nombre.json`
   - `Generar preview PNG` -> genera `nombre.png`
5. Copia ambos archivos en `/maps`.
6. Reinicia backend para que aparezca en el lobby.

## Notas tecnicas

- Tick de simulacion en servidor: `30 TPS`.
- Broadcast de estado: `20 por segundo`.
- Cliente renderiza segun snapshots del servidor.
