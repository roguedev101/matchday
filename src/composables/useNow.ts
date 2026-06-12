import { onBeforeUnmount, ref, type Ref } from 'vue'

const now = ref(Date.now())
let subscribers = 0
let timer: ReturnType<typeof setInterval> | undefined

/**
 * Shared once-per-second timestamp driving the live clock, countdowns, and the
 * featured-match driver. One interval no matter how many components subscribe.
 */
export function useNow(): Ref<number> {
  if (subscribers++ === 0) {
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
  onBeforeUnmount(() => {
    if (--subscribers === 0) clearInterval(timer)
  })
  return now
}
