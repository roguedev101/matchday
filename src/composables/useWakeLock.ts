import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Holds a screen wake lock so the wall TV never sleeps while the board is up.
 *
 * The browser releases the lock whenever the tab is hidden (and on some
 * platforms when the user switches apps), so we re-acquire it every time the
 * page becomes visible again. Best-effort: if the API is missing or the request
 * is rejected, the board still runs — the screen just falls back to its OS
 * sleep timer.
 */
export function useWakeLock(): void {
  let sentinel: WakeLockSentinel | undefined

  async function acquire() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch {
      // Denied or transient failure — leave the OS sleep timer in charge.
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') acquire()
  }

  onMounted(() => {
    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    sentinel?.release().catch(() => {})
    sentinel = undefined
  })
}
