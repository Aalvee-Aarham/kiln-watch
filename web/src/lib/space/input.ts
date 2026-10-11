/**
 * What a wheel event means on the globe, the Google Maps way on a touchpad:
 *   pinch (browsers report a touchpad pinch as Ctrl + wheel) → zoom;
 *   two-finger swipe, any direction → move the globe;
 *   mouse wheel (a mouse has no pinch) → zoom.
 * Browsers do not say which device sent a wheel event, so the touchpad is recognised by its events: sideways movement,
 * fractional or small steps, or Chromium's touchpad signature (wheelDeltaY = −3 × deltaY). A mouse notch is a whole step
 * of 100 or more. One swipe keeps its meaning for a moment, even if a single step in it is large.
 */
export type WheelIntent = 'pinch' | 'pan' | 'zoom'
export interface WheelLike { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean; wheelDeltaY?: number }

export function looksLikeTouchpad(e: WheelLike): boolean {
  if (e.deltaMode !== 0) return false                      // lines or pages: a mouse wheel
  if (e.deltaX !== 0) return true
  if (!Number.isInteger(e.deltaY)) return true
  if (e.wheelDeltaY !== undefined && e.wheelDeltaY !== 0 && e.wheelDeltaY === -3 * e.deltaY) return true
  return Math.abs(e.deltaY) < 50
}

export function wheelIntent(e: WheelLike, prev?: { intent: WheelIntent; t: number }, t = 0): WheelIntent {
  if (e.ctrlKey || e.metaKey) return 'pinch'
  if (prev?.intent === 'pan' && t - prev.t < 350) return 'pan'
  return looksLikeTouchpad(e) ? 'pan' : 'zoom'
}
