import { computed, ref, watch, type Ref } from 'vue'

import type { Match } from '@/composables/useScoreboard'

// ADR-0001: the Board drives the Featured slot itself. Live matches rotate,
// goals seize the slot with a Pin, full-time gets a Linger, and a human click
// is an Override that releases when its match concludes.
const ROTATE_MS = 60_000
const PIN_MS = 120_000
const POST_OVERRIDE_MS = 600_000

interface Hold {
  id: string
  /** Expiry for holds that can never conclude on their own; null = match-aware. */
  until: number | null
}

export function useFeaturedDriver(matches: Ref<Match[]>, now: Ref<number>) {
  const featuredId = ref<string | null>(null)
  /** True while an Override or Pin is holding the slot (blocks Safe Moments). */
  const holdActive = ref(false)

  let manual: Hold | null = null
  let pin: { id: string; until: number } | null = null
  let rotateAt = 0
  const scoreSignatures = new Map<string, string>()
  const prevStates = new Map<string, Match['state']>()

  // Shootout kicks count as score changes so a shootout keeps re-pinning itself.
  function signature(match: Match): string {
    return `${match.home.score}-${match.away.score}/${match.home.shootout ?? ''}-${match.away.shootout ?? ''}`
  }

  function update() {
    const list = matches.value
    const t = now.value
    const byId = new Map(list.map((match) => [match.id, match]))

    // Detect transitions before touching the slot.
    let seizedId: string | null = null
    let finishedFeatured = false
    for (const match of list) {
      const sig = signature(match)
      const prevSig = scoreSignatures.get(match.id)
      if (prevSig !== undefined && prevSig !== sig && match.state === 'in') seizedId = match.id
      scoreSignatures.set(match.id, sig)

      const prevState = prevStates.get(match.id)
      if (prevState === 'in' && match.state === 'post' && featuredId.value === match.id)
        finishedFeatured = true
      prevStates.set(match.id, match.state)
    }
    for (const id of scoreSignatures.keys()) {
      if (!byId.has(id)) {
        scoreSignatures.delete(id)
        prevStates.delete(id)
      }
    }

    const anyLive = list.some((match) => match.state === 'in')

    // A goal seizes the slot — unless a human Override is active.
    if (seizedId && !manual) pin = { id: seizedId, until: t + PIN_MS }

    // Override lifecycle (match-aware release, Q4).
    if (manual) {
      const match = byId.get(manual.id)
      if (!match) manual = null
      else if (manual.until != null && t >= manual.until) manual = null
      else if (manual.until == null && match.state === 'post') {
        // The watched match concluded: give its final score a Linger, then resume.
        manual = null
        pin = { id: match.id, until: t + PIN_MS }
      }
    }
    if (manual) {
      featuredId.value = manual.id
      holdActive.value = true
      return
    }

    // Full-time on the auto-featured match: Linger only if nothing else is live.
    if (finishedFeatured && !pin && !anyLive && featuredId.value)
      pin = { id: featuredId.value, until: t + PIN_MS }

    // Pin lifecycle: expire, vanish with the match, or yield to live football.
    if (pin) {
      const match = byId.get(pin.id)
      if (!match || t >= pin.until) pin = null
      else if (match.state === 'post' && anyLive) pin = null
    }
    if (pin) {
      featuredId.value = pin.id
      holdActive.value = true
      return
    }
    holdActive.value = false

    // Rotation among live matches; the grid is correct when no ball is rolling.
    const live = list.filter((match) => match.state === 'in')
    if (!live.length) {
      featuredId.value = null
      return
    }
    const index = live.findIndex((match) => match.id === featuredId.value)
    if (index === -1) {
      featuredId.value = live[0]!.id
      rotateAt = t + ROTATE_MS
    } else if (live.length > 1 && t >= rotateAt) {
      featuredId.value = live[(index + 1) % live.length]!.id
      rotateAt = t + ROTATE_MS
    }
  }

  function select(id: string) {
    const match = matches.value.find((m) => m.id === id)
    if (!match) return
    manual = { id, until: match.state === 'post' ? now.value + POST_OVERRIDE_MS : null }
    pin = null
    update()
  }

  function dismiss() {
    manual = null
    pin = null
    // Visibly move on: advance past the dismissed match before resuming auto.
    const live = matches.value.filter((match) => match.state === 'in')
    const index = live.findIndex((match) => match.id === featuredId.value)
    featuredId.value = live.length ? live[(index + 1) % live.length]!.id : null
    holdActive.value = false
    rotateAt = now.value + ROTATE_MS
  }

  watch([matches, now], update, { immediate: true })

  const featuredMatch = computed(
    () => matches.value.find((match) => match.id === featuredId.value) ?? null,
  )

  return { featuredId, featuredMatch, holdActive, select, dismiss }
}
