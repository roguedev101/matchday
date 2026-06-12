import { onBeforeUnmount, onMounted, ref } from 'vue'

const CHECK_MS = 300_000
const APPLY_CHECK_MS = 60_000

/**
 * A Board runs unattended for weeks, so deploys must reach it on their own:
 * poll the build stamp and reload — but only at a Safe Moment (the caller
 * decides), never mid-match.
 */
export function useAppUpdate(safeToReload: () => boolean) {
  const updateAvailable = ref(false)
  if (import.meta.env.DEV) return { updateAvailable }

  let checkTimer: ReturnType<typeof setInterval> | undefined
  let applyTimer: ReturnType<typeof setInterval> | undefined

  async function check() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}version.json?_=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) return
      const data = (await response.json()) as { buildId?: string }
      if (data.buildId && data.buildId !== __BUILD_ID__) updateAvailable.value = true
    } catch {
      // Offline or host hiccup; the next check will try again.
    }
  }

  onMounted(() => {
    checkTimer = setInterval(check, CHECK_MS)
    applyTimer = setInterval(() => {
      if (updateAvailable.value && safeToReload()) window.location.reload()
    }, APPLY_CHECK_MS)
  })

  onBeforeUnmount(() => {
    clearInterval(checkTimer)
    clearInterval(applyTimer)
  })

  return { updateAvailable }
}
