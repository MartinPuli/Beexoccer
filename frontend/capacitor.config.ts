import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beexoccer.app',
  appName: 'Beexoccer',
  webDir: 'dist',
  server: {
    // Permite conexiones a tu servidor de producción
    allowNavigation: ['*'],
    cleartext: true // Permite HTTP para desarrollo
  },
  android: {
    allowMixedContent: true // Permite HTTP y HTTPS
  }
};

export default config;
