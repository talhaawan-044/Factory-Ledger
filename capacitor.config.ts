import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coalledger.app',
  appName: 'Factory Ledger',
  webDir: 'dist',
  backgroundColor: '#0E0E10',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#0E0E10',
      style: 'DARK'
    }
  }
};

export default config;
