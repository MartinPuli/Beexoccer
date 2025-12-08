/**
 * Configuración de producción para Beexoccer
 */
export const env = {
  // Red Polygon Mainnet
  polygonRpc: "https://polygon.drpc.org",
  
  // Chain ID de Polygon Mainnet
  chainId: 137,
  chainIdHex: "0x89",
  
  // Dirección del contrato MatchManager en Polygon Mainnet (se actualizará después del deploy)
  matchManagerAddress: "0xad6715C528F092D31010407C1D9Eb961A1aB545C",
  
  // URL del servidor de tiempo real (usar localhost para desarrollo, producción para deploy)
  realtimeUrl: "https://beexoccer-production.up.railway.app"
};
