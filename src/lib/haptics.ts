/**
 * Haptic Feedback Utility
 * iOS-native haptic feedback via Capacitor Haptics plugin.
 * All methods are safe to call on web — they silently no-op when not native.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

/** Light tap — use for button presses, sidebar nav, tab switches */
export async function hapticLight() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Silently fail — haptics not available on all devices
  }
}

/** Medium tap — use for toggle switches, drag-drop placement */
export async function hapticMedium() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

/** Heavy tap — use for destructive confirmations, long-press actions */
export async function hapticHeavy() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}
}

/** Success notification — use for login success, save complete, order confirmed */
export async function hapticSuccess() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

/** Warning notification — use for validation warnings, low stock alerts */
export async function hapticWarning() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
}

/** Error notification — use for login failed, payment error, form validation error */
export async function hapticError() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

/** Selection tick — use for picker scrolling, list item selection */
export async function hapticSelection() {
  if (!isNative) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {}
}
