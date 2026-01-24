# TournamentManager Smart Contract Documentation

## Overview

`TournamentManager.sol` es un contrato inteligente que facilita torneos de fútbol con apuestas reales en Polygon. Cada jugador paga una cuota de inscripción, todos los fondos se retienen en depósito (escrow), y los premios se distribuyen automáticamente según los resultados del torneo.

**Red Recomendada**: Polygon Mainnet (137)  
**Versión Solidity**: ^0.8.24  
**Estándar de Seguridad**: OpenZeppelin ReentrancyGuard + SafeERC20

---

## Características de Seguridad

### 1. **ReentrancyGuard**
- Protege funciones críticas (`joinTournament`, `completeTournament`)
- Previene ataques de reentrada durante transferencias

### 2. **SafeERC20**
- Transferencias seguras para cualquier token ERC20
- Manejo correcto de tokens que no devuelven `true`
- Soporte dual: MATIC nativo + tokens ERC20

### 3. **Validaciones Exhaustivas**
- Verificación de estado del torneo antes de cada operación
- Validación de ganadores (existencia, duplicados, no-zero)
- Verificación de integridad del pool de premios
- Prevención de rejoin mediante mapeo `playerJoined`

### 4. **Control de Acceso**
- Solo el creador puede iniciar/completar torneos
- Solo el owner puede hacer withdraws de emergencia
- Roles claros y verificados en cada función

---

## Estructura de Torneos

### Tamaños Disponibles
```solidity
enum TournamentSize {
    Four,   // 4 jugadores
    Eight,  // 8 jugadores
    Sixteen // 16 jugadores
}
```

### Estados del Torneo
```solidity
enum TournamentStatus {
    Open,       // 0: Aceptando jugadores
    Full,       // 1: Slots llenos, esperando inicio
    InProgress, // 2: Torneo comenzó
    Completed   // 3: Premios distribuidos
}
```

### Distribución de Premios (Predeterminada)
- **4 jugadores**: 75% (1er) + 25% (2do)
- **8 jugadores**: 75% (1er) + 25% (2do)
- **16 jugadores**: 70% (1er) + 20% (2do) + 10% (3er)

*Nota: Los porcentajes son configurables por el creador al crear el torneo*

---

## API Pública

### Crear Torneo

```solidity
function createTournament(
    TournamentSize size,
    uint256 entryFee,
    address entryToken,
    uint8 firstPlacePct,
    uint8 secondPlacePct,
    uint8 thirdPlacePct
) external returns (uint256 tournamentId)
```

**Parámetros:**
- `size`: Número de jugadores (0=4, 1=8, 2=16)
- `entryFee`: Cantidad que cada jugador debe depositar (en wei)
- `entryToken`: Dirección del token (0x0 para MATIC nativo)
- `firstPlacePct`, `secondPlacePct`, `thirdPlacePct`: Porcentajes de premios

**Eventos:**
- `TournamentCreated(tournamentId, creator, size, entryFee, entryToken)`

**Ejemplo (JavaScript):**
```javascript
const tx = await tournamentManager.createTournament(
  0,                                    // 4-player
  ethers.parseEther("1.0"),             // 1 MATIC por jugador
  ethers.ZeroAddress,                   // MATIC nativo
  75, 25, 0                             // 75%/25% split
);
const { events } = await tx.wait();
const tournamentId = events[0].args.tournamentId;
```

---

### Unirse a Torneo

```solidity
function joinTournament(uint256 tournamentId) external payable nonReentrant
```

**Parámetros:**
- `tournamentId`: ID del torneo
- `msg.value`: Debe ser exacto al `entryFee` (solo para MATIC nativo)

**Validaciones:**
- El torneo debe estar `Open` o `Full`
- El jugador no debe haber unido anteriormente
- El torneo no puede estar lleno
- El fee debe ser exacto

**Eventos:**
- `PlayerJoined(tournamentId, player, currentPlayers, maxPlayers)`

**Cambios de Estado Automáticos:**
- Cuando se llena el torneo, pasa a estado `Full` automáticamente

**Ejemplo:**
```javascript
const entryFee = ethers.parseEther("1.0");
await tournamentManager.joinTournament(1, { value: entryFee });
```

---

### Iniciar Torneo

```solidity
function startTournament(uint256 tournamentId) external
```

**Requerimientos:**
- Solo el creador puede llamar
- El torneo debe estar `Full` (4, 8 o 16 jugadores unidos)

**Eventos:**
- `TournamentStarted(tournamentId)`

**Ejemplo:**
```javascript
await tournamentManager.connect(creator).startTournament(1);
```

---

### Completar Torneo (Distribuir Premios)

```solidity
function completeTournament(
    uint256 tournamentId,
    address firstPlace,
    address secondPlace,
    address thirdPlace
) external nonReentrant
```

**Requerimientos:**
- Solo el creador puede llamar
- El torneo debe estar `InProgress`
- Los ganadores deben ser participantes válidos
- No puede haber ganadores duplicados
- Para 4/8 jugadores: `thirdPlace` debe ser `0x0`
- Para 16 jugadores: Los 3 ganadores son requeridos

**Lógica de Distribución:**
1. Calcula premios: `(totalPool * percentage) / 100`
2. Verifica que la suma ≤ totalPool
3. Transfiere fondos a los ganadores
4. Emite eventos de distribución

**Eventos:**
- `PrizeDistributed(tournamentId, recipient, amount, place)` (3x)
- `TournamentCompleted(tournamentId, firstPlace, secondPlace, thirdPlace, ...)`

**Ejemplo (16-player):**
```javascript
await tournamentManager.connect(creator).completeTournament(
  1,
  winner1.address,  // 70% del pool
  winner2.address,  // 20% del pool
  winner3.address   // 10% del pool
);
```

---

### Funciones de Lectura

#### `getTournament(uint256 tournamentId)`
Devuelve información del torneo:
```solidity
(
    address creator,
    uint256 createdAt,
    TournamentSize size,
    TournamentStatus status,
    uint256 entryFee,
    address entryToken,
    uint256 playerCount,
    uint256 totalPrizePool
)
```

#### `getTournamentResults(uint256 tournamentId)`
Devuelve ganadores:
```solidity
(address firstPlace, address secondPlace, address thirdPlace)
```

#### `getTournamentPlayers(uint256 tournamentId)`
Devuelve array de todos los jugadores:
```solidity
address[] memory
```

#### `hasPlayerJoined(uint256 tournamentId, address player)`
Verifica si un jugador está en el torneo:
```solidity
bool
```

#### `calculatePrizes(uint256 tournamentId)`
Calcula los premios para cada posición:
```solidity
(uint256 firstPrize, uint256 secondPrize, uint256 thirdPrize)
```

---

## Gestión de Errores

El contrato utiliza custom errors para ahorrar gas y claridad:

```solidity
error TM_InvalidSize();              // Tamaño de torneo inválido
error TM_InvalidFeeCombo();          // Combinación de fee/msg.value inválida
error TM_InvalidPrizeDistribution(); // Porcentajes no suman 100%
error TM_TournamentClosed();         // Torneo cerrado o lleno
error TM_AlreadyJoined();            // Jugador ya se unió
error TM_NotCreator();               // Solo creador puede hacer esto
error TM_InvalidWinner();            // Ganador no es participante
error TM_AlreadyCompleted();         // Torneo ya completado
error TM_NoZeroAddress();            // No se permite address(0)
error TM_DuplicateWinner();          // Mismo ganador en múltiples posiciones
error TM_InvalidPrizePool();         // Cálculo de premios fallido
error TM_TransferFailed();           // Transferencia de fondos falló
```

---

## Ejemplos Completos

### Flujo de 4-Player Tournament

```javascript
const entryFee = ethers.parseEther("1.0");

// 1. Crear torneo (por el organizador)
const createTx = await tournamentManager.connect(organizer).createTournament(
  0,                 // 4 jugadores
  entryFee,
  ethers.ZeroAddress, // MATIC
  75, 25, 0          // 75%/25%
);
await createTx.wait();

// 2. 4 Jugadores se unen
for (let i = 0; i < 4; i++) {
  await tournamentManager
    .connect(players[i])
    .joinTournament(1, { value: entryFee });
}

// Verificar que está full
const tournament = await tournamentManager.getTournament(1);
console.log("Status:", tournament.status); // 1 = Full
console.log("Prize Pool:", tournament.totalPrizePool); // 4 MATIC

// 3. Iniciar
await tournamentManager.connect(organizer).startTournament(1);

// 4. Después del torneo, reportar resultados
const prizes = await tournamentManager.calculatePrizes(1);
console.log("First Prize:", prizes.firstPrize);   // 3 MATIC
console.log("Second Prize:", prizes.secondPrize); // 1 MATIC

await tournamentManager.connect(organizer).completeTournament(
  1,
  players[0].address, // Ganador
  players[1].address, // Runner-up
  ethers.ZeroAddress  // Sin 3er lugar
);

// Verificar resultados
const results = await tournamentManager.getTournamentResults(1);
console.log("Champion:", results.firstPlace);
```

---

## Deployments

### Red Polygon Mainnet (137)
Para desplegar a mainnet:

```bash
npx hardhat run scripts/deployTournamentManager.ts --network polygon
```

Requiere en `.env`:
```
POLYGON_RPC=https://rpc.ankr.com/polygon
PRIVATE_KEY=<your-private-key>
```

### Red Amoy (Testnet)
Para probar primero:

```bash
npx hardhat run scripts/deployTournamentManager.ts --network polygonAmoy
```

---

## Gas Optimization

El contrato está optimizado para:
- **Storage**: Packing eficiente de structs
- **Function Calls**: Uso de custom errors (vs require strings)
- **Prize Distribution**: Cálculos inline, sin loops

Gas esperado (aproximado, Polygon):
- `createTournament`: ~80,000 - 120,000
- `joinTournament`: ~100,000 - 150,000 (primera vez), ~80,000 siguientes
- `completeTournament`: ~200,000 - 300,000 (depende del token)

---

## Auditoría y Testing

El contrato fue testeado con:
- ✅ 13 test cases cobriendo todos los flujos principales
- ✅ Validación de edge cases (duplicates, invalid percentages, etc.)
- ✅ Verificación de distribución de premios correcta
- ✅ Pruebas de control de acceso
- ✅ Pruebas de 4, 8, y 16-player tournaments

Ejecutar tests:
```bash
npx hardhat test test/TournamentManager.test.ts
```

---

## Funciones de Emergencia

```solidity
function emergencyWithdraw(uint256 tournamentId) external onlyOwner nonReentrant
```

**Solo para usar si:**
- Hubo un error en la distribución automática
- El torneo está en estado `Completed`

**Qué hace:**
- Extrae todos los fondos del torneo
- Los envía al owner
- Limpia el pool

**Uso:**
```javascript
await tournamentManager.emergencyWithdraw(tournamentId);
```

---

## Consideraciones de Seguridad

### Para Operadores del Servicio:
1. **Validar ganadores off-chain** antes de llamar `completeTournament()`
2. **Mantener logs de auditoría** de todos los torneos
3. **Usar acceso multisig** en operaciones críticas
4. **Monitorear eventos** en tiempo real para transacciones sospechosas

### Para Usuarios:
1. **Verificar fee exacto** antes de `joinTournament()`
2. **Confirmar dirección del torneo** (posible phishing)
3. **Guardar direcciones de ganadores** para auditoría posterior

### Limitaciones Conocidas:
- No hay refund automático si el torneo no se completa
- No hay timeout configurable (está hardcodeado en server-side)
- El creador es de confianza (puede reportar ganadores falsos)

---

## Roadmap Futuro

- [ ] DAO governance para cambiar porcentajes de premios
- [ ] Sistema de appeals para disputar resultados
- [ ] Soporte para torneos knockout múltiple-ronda
- [ ] Integración con chainlink VRF para bracket aleatorio
- [ ] Protocolo de compartir-ganancias (rakeback para el protocolo)

---

## Contacto & Soporte

Para bugs o preguntas sobre la implementación, verificar:
- Código: `contracts/TournamentManager.sol`
- Tests: `test/TournamentManager.test.ts`
- Deployment: `scripts/deployTournamentManager.ts`
