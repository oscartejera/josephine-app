import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.josephine.dashboard',
  appName: 'Josephine',
  webDir: 'dist',
  server: {
    url: 'https://www.josephine-ai.com',
  },
};

export default config;
