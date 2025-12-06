/**
 * Central place for reading Vite env vars with explicit defaults so local
 * development remains ergonomic.
 */
export const env = {
  xoProjectId: import.meta.env.VITE_XO_CONNECT_PROJECT_ID ?? "demo-project",
  polygonRpc: import.meta.env.VITE_POLYGON_AMOY_RPC ?? "https://polygon-amoy.g.alchemy.com/v2/demo",
  matchManagerAddress:
    import.meta.env.VITE_MATCH_MANAGER_ADDRESS ?? "0x0000000000000000000000000000000000000000",
  realtimeUrl: import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4000"
};
