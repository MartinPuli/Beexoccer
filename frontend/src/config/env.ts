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
  matchManagerAddress: "0x440DeA5a2801E6caF07574bf4B940df1CdFb2353",

  // URL del servidor de tiempo real (usar localhost para desarrollo, producción para deploy)
  realtimeUrl: "https://beexoccer-production.up.railway.app",
};
