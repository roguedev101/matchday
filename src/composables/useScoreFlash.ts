import { onBeforeUnmount, ref, watch } from 'vue'

// Slightly longer than the CSS animation (3 × 0.9s) so the class outlives it.
const FLASH_MS = 2800

/** Turns true for a moment whenever the watched score changes, driving the goal-flash animation. */
export function useScoreFlash(score: () => string) {
  const flashing = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(score, (next, prev) => {
    if (next === prev) return
    flashing.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      flashing.value = false
    }, FLASH_MS)
  })

  onBeforeUnmount(() => clearTimeout(timer))

  return flashing
}
