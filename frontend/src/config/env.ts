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
  matchManagerAddress: "0x8087441101595dd8FEcA1f02179a74ec2A1FeBBf",
  tournamentManagerAddress: "0x5D8c3f1310D881b7C11bCca47DAd0fD39c1A0B44", // Update after deploy

  // URL del servidor de tiempo real (usar localhost para desarrollo, producción para deploy)
  realtimeUrl: "https://beexoccer-production.up.railway.app",
};
 