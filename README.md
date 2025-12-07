# Beexoccer

Beexoccer is a turn-based tactical mini soccer experience that blends arcade rebounds with lightweight strategy. Matches feel like a polished tabletop game: you drag circular tokens representing each player, bounce the ball off the walls, and race to score before the shot clock expires. The project ships with a Hardhat smart-contract workspace plus a React + TypeScript frontend styled after the metallic green Beexo identity.

## Visual Identity

![Beexoccer Logo Placeholder](./frontend/src/assets/logo-placeholder.svg)

- **Field**: bright top-down “Soccer de Plato” pitch with alternating green bands, sharp white lines, and stylized stands.
- **UI**: dark neutral base (#050607–#111) contrasted with Beexo metallic greens (#1E8F32 / #00B870), neon accents, and bold typography (Chakra Petch).
- **Highlights**: amber/orange halos indicate active turns; red signals alerts or forfeits.

## Gameplay Snapshot

- Drag-and-release disks to strike a shared ball with light physics and wall rebounds.
- Alternating 15-second turns; missed turns are skipped.
- Two modes at launch: fast bot scrimmage (off-chain) and wagered PvP via XO-CONNECT + Polygon escrow.
- Each match ends when a player reaches the configured goal count (2 / 3 / 5).

## Repository Layout

```
Beexoccer
├── README.md
├── .gitignore
├── package.json           # Hardhat toolchain + scripts
├── tsconfig.json          # Hardhat TypeScript settings
├── hardhat.config.ts      # Polygon Amoy + local networks
├── contracts/MatchManager.sol
├── scripts/deploy.ts      # Deploy helper for Polygon testnet
├── frontend/              # React + Vite UI
│   ├── package.json
│   ├── tsconfig*.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── views/
│       ├── services/
│       ├── hooks/
│       ├── config/
│       └── styles/
└── .env.example
```

## Prerequisites

- Node.js 18+
- npm 9+
- Foundry or Hardhat-compatible wallet for contract interactions
- Polygon Amoy/Mumbai RPC URL + funded test account for deployments
- XO-CONNECT compatible Beexo Wallet for alias + signature flows

## Environment Setup

1. **Clone and install root dependencies**

   ```powershell
   git clone <repo>
   cd Beexoccer
   npm install
   ```

2. **Install frontend**

   ```powershell
   cd frontend
   npm install
   ```

3. **Copy env templates**

   ```powershell
   Copy-Item .env.example .env
   cd frontend
   Copy-Item .env.example .env.local
   ```

### Root `.env`

```env
POLYGON_AMOY_RPC=
PRIVATE_KEY=
STABLE_TOKEN_ADDRESS=
```

### Frontend `.env`

```env
VITE_XO_CONNECT_PROJECT_ID=
VITE_POLYGON_AMOY_RPC=
VITE_MATCH_MANAGER_ADDRESS=
```

## Running the Frontend

```powershell
cd frontend
npm run dev
```

This spins up Vite with hot reload plus mock data for aliases/balances when XO-CONNECT is not yet available.

## Realtime Server + Frontend Smoke Test

1. Install realtime server deps (one-time):
   
   ```powershell
   cd server
   npm install
   ```

2. Start the socket server (default :4000):
   
   ```powershell
   npm run dev
   ```

3. In another terminal, start the frontend with the realtime URL set (defaults to `http://localhost:4000`):
   
   ```powershell
   cd frontend
   $Env:VITE_REALTIME_URL="http://localhost:4000"; npm run dev
   ```

4. Open the app (default Vite port 5173) and play the demo match. The server emits snapshots/events; dragging a chip will move physics on the server and stream back to the UI. Use two browser tabs to see synchronized state.

## Deploying the Smart Contract

1. Fund the deploying address with Amoy test MATIC.
2. Set RPC + private key inside `.env`.
3. Run Hardhat deploy script:

   ```powershell
   npx hardhat run scripts/deploy.ts --network polygonAmoy
   ```

4. Copy the emitted contract address into `frontend/.env` as `VITE_MATCH_MANAGER_ADDRESS`.

## XO-CONNECT Integration Overview

- `frontend/src/services/xoConnectService.ts` initializes the SDK, fetches the user alias, and exposes provider/signer objects.
- UI components call `useXoConnect` hook to read alias, authenticated balance, and signature helpers.
- When XO-CONNECT is unavailable (dev mode), the service falls back to deterministic mocks so screens remain testable.

## Smart Contract Summary

`MatchManager.sol` handles creation, escrow, and settlement:

- `createMatch(goals, isFree, stakeAmount, stakeToken)` registers lobbies.
- `joinMatch(matchId)` lets challengers lock stakes if required.
- `reportResult(matchId, winner)` distributes escrow and marks match ended.
- All state transitions are thoroughly documented to simplify audits.

## Roadmap (V2+)

1. **Advanced Physics** – Spin, multi-collision resolution, and spectator replay.
2. **Power Plays** – One-off boosts purchased with Beexo credits.
3. **Season Pass** – Ranked ladder and cosmetic unlocks.
4. **Cross-Platform** – Capacitor mobile wrappers + haptics.
5. **Analytics** – Match history, heat maps, rage-quit detection.

## Best Practices Followed

- Strong TypeScript typing for services, hooks, and match DTOs.
- Modular UI architecture: screens compose smaller controls (buttons, stat cards, field canvas).
- Environment-driven configuration with zero hard-coded RPC endpoints.
- Explicit TODO markers for future physics, matchmaking, AI, and blockchain enhancements.
- Exhaustive comments explaining gameplay, blockchain steps, and UX intentions.

## Contributing

1. Fork
2. Create a feature branch
3. Add or update tests (smart contract unit tests or UI spec tests when applicable)
4. Submit PR with screenshots or screen recordings for UI tweaks

---

## 🚀 Despliegue en Producción

### Frontend → Vercel

1. **Conectar repositorio a Vercel:**
   - Ve a [vercel.com](https://vercel.com)
   - Importa tu repositorio de GitHub
   - Configura:
     - **Root Directory:** `frontend`
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`

2. **Variables de entorno en Vercel:**
   ```
   VITE_POLYGON_AMOY_RPC=https://polygon-amoy.drpc.org
   VITE_MATCH_MANAGER_ADDRESS=0x9197Aa4F607fC2e245411eb69ab2d72CDa02CC2b
   VITE_REALTIME_URL=https://tu-server.railway.app
   VITE_ENABLE_REALTIME=true
   ```

3. **Deploy:** Vercel construirá automáticamente en cada push a main.

### Server (WebSocket) → Railway

Vercel no soporta WebSockets persistentes. Usa Railway, Render, o Fly.io:

**Railway:**
1. Ve a [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Configura:
   - **Root Directory:** `server`
   - **Start Command:** `npm run build && npm start`
4. Variables de entorno:
   ```
   PORT=4000
   ```
5. Railway te dará una URL como `https://beexoccer-server.up.railway.app`
6. Copia esa URL a `VITE_REALTIME_URL` en Vercel

**Render (alternativa):**
1. Ve a [render.com](https://render.com)
2. New → Web Service → Connect repo
3. Configura:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Render te dará una URL para usar en `VITE_REALTIME_URL`

### Smart Contract (ya desplegado)

El contrato `MatchManager` está en Polygon Amoy:
```
0x9197Aa4F607fC2e245411eb69ab2d72CDa02CC2b
```

Para redesplegar:
```powershell
npx hardhat run scripts/deploy.ts --network polygonAmoy
```

---

## License

MIT-style placeholder; update when product charter finalizes.
