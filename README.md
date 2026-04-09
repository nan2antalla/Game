# Boxhead Multiplayer Web Game

Juego web 2D top-down shooter estilo Boxhead con PvP + zombies, con servidor autoritativo.

## Estructura

```text
/client   -> Phaser 3 + Vite
/server   -> Node.js + Express + Socket.IO
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
3. Variables de entorno:
   - `PORT` = `3000`
   - `CLIENT_URL` = URL publica del frontend en Netlify (ejemplo `https://tu-juego.netlify.app`)
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

## Notas tecnicas

- Tick de simulacion en servidor: `30 TPS`.
- Broadcast de estado: `20 por segundo`.
- Cliente renderiza segun snapshots del servidor.
