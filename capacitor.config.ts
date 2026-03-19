import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.josephine.dashboard',
  appName: 'Josephine',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d1117',
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 3000,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      backgroundColor: '#0d1117',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;
