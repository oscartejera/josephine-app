/**
 * Capacitor native platform utilities.
 *
 * - Detects iOS / Android vs web
 * - Initialises status-bar, splash-screen, back-button, keyboard
 * - Bridges Network plugin → TanStack Query onlineManager
 *
 * Called once from main.tsx after React mounts.
 */
import { Capacitor } from '@capacitor/core';

/** true when running inside a Capacitor native shell (iOS / Android) */
export const isNative = Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const platform = Capacitor.getPlatform();

/**
 * Initialise every native plugin the app needs.
 * Safe to call on web — it short-circuits immediately.
 */
export async function initNativePlugins(): Promise<void> {
  if (!isNative) return;

  // ── Status bar ──────────────────────────────
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0d1117' });
    }
  } catch (e) {
    console.warn('[native] StatusBar init failed', e);
  }

  // ── Splash screen ──────────────────────────
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch (e) {
    console.warn('[native] SplashScreen hide failed', e);
  }

  // ── Android hardware back button ───────────
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });
  } catch (e) {
    console.warn('[native] App back-button failed', e);
  }

  // ── Network → TanStack Query onlineManager ─
  try {
    const { Network } = await import('@capacitor/network');
    const { onlineManager } = await import('@tanstack/react-query');

    const status = await Network.getStatus();
    onlineManager.setOnline(status.connected);

    Network.addListener('networkStatusChange', (s) => {
      onlineManager.setOnline(s.connected);
    });
  } catch (e) {
    console.warn('[native] Network bridge failed', e);
  }
}
