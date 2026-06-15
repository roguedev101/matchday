<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FeaturedMatch from '@/components/FeaturedMatch.vue'
import MatchCard from '@/components/MatchCard.vue'
import { useAppUpdate } from '@/composables/useAppUpdate'
import { useFeaturedDriver } from '@/composables/useFeaturedDriver'
import { useNow } from '@/composables/useNow'
import { STALE_AFTER_MS, useScoreboard } from '@/composables/useScoreboard'
import { useWakeLock } from '@/composables/useWakeLock'
import { dayLabel, formatYmd, timeLabel, ymdShift } from '@/lib/boardTime'

const { matches, loading, lastGoodAt, selectedDate } = useScoreboard()
const now = useNow()

const TOURNAMENT_FIRST = '20260611'
const TOURNAMENT_LAST = '20260719'

function clampToTournament(ymd: string): string {
  return ymd < TOURNAMENT_FIRST ? TOURNAMENT_FIRST : ymd > TOURNAMENT_LAST ? TOURNAMENT_LAST : ymd
}

// Outside the tournament window, fall back to the nearest tournament day.
selectedDate.value = clampToTournament(selectedDate.value)

const todayYmd = ref(formatYmd(new Date()))

const dateOptions = computed(() => {
  const options: { value: string; label: string }[] = []
  for (let value = TOURNAMENT_FIRST; value <= TOURNAMENT_LAST; value = ymdShift(value, 1)) {
    const label = dayLabel(value)
    options.push({ value, label: value === todayYmd.value ? `${label} · Today` : label })
  }
  return options
})

const selectedLabel = computed(
  () => dateOptions.value.find((option) => option.value === selectedDate.value)?.label ?? '',
)

// ADR-0001: the Board features matches by itself (rotation, goal seizures,
// linger); a click is a temporary Override handled by the driver.
const { featuredMatch, holdActive, select } = useFeaturedDriver(matches, now)

useWakeLock()

const railMatches = computed(() => {
  const featured = featuredMatch.value
  return featured ? matches.value.filter((match) => match.id !== featured.id) : matches.value
})

function onKeydown() {
  noteInput()
}

// Slate rollover and browsed-date decay: the Board comes home to today on its
// own — but never while someone is interacting, and never while the old slate
// still has live or lingering football.
const AUTO_DATE_IDLE_MS = 600_000
const SLATE_GRACE_MS = 6 * 3_600_000

let lastInputAt = Date.now()
function noteInput() {
  lastInputAt = Date.now()
}

function slateReleased(): boolean {
  if (!matches.value.length) return true
  if (matches.value.every((match) => match.state === 'post') && !holdActive.value) return true
  // Safety valve: a postponed match must not wedge the Board on an old slate.
  const lastKickoff = Math.max(...matches.value.map((match) => match.kickoff.getTime()))
  return now.value > lastKickoff + SLATE_GRACE_MS
}

watch(now, () => {
  todayYmd.value = formatYmd(new Date(now.value))
  const target = clampToTournament(todayYmd.value)
  if (selectedDate.value === target) return
  if (now.value - lastInputAt < AUTO_DATE_IDLE_MS) return
  // Browsed-ahead dates snap straight back; catching up forward waits for the
  // slate to finish (a local-day slate can still be live past midnight).
  if (selectedDate.value > target || slateReleased()) selectedDate.value = target
})

// Idle grid gets a pulse: time to the next kickoff (live matches take over).
const countdown = computed(() => {
  if (featuredMatch.value || matches.value.some((match) => match.state === 'in')) return ''
  const kickoffs = matches.value
    .filter((match) => match.state === 'pre')
    .map((match) => match.kickoff.getTime())
  if (!kickoffs.length) return ''
  const at = Math.min(...kickoffs)
  const next = matches.value.filter(
    (match) => match.state === 'pre' && match.kickoff.getTime() === at,
  )
  const first = next[0]!
  const who =
    next.length === 1
      ? `${first.home.abbreviation} vs ${first.away.abbreviation}`
      : `${next.length} matches`
  const diff = at - now.value
  if (diff <= 60_000) return `Next kickoff · ${who} · any moment`
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return `Next kickoff · ${who} · in ${hours ? `${hours}h ${minutes}m` : `${minutes}m`}`
})

// Stale (see CONTEXT.md): state the age of the data, not the app's activity.
const asOf = computed(() => {
  if (lastGoodAt.value == null) return ''
  return now.value - lastGoodAt.value > STALE_AFTER_MS ? timeLabel(lastGoodAt.value) : ''
})

// Self-update: reload for new deploys, but only at a Safe Moment.
useAppUpdate(() => !matches.value.some((match) => match.state === 'in') && !holdActive.value)

// Scale the layout to fill the stage: down when it overflows, up on sparse
// days so a couple of matches still fill a TV.
const stage = ref<HTMLElement | null>(null)
const layoutEl = ref<HTMLElement | null>(null)
const scale = ref(1)
let resizeObserver: ResizeObserver | undefined

// Widest row of actual content. The layout box itself always spans the full
// stage width, so measure the featured card and the span of the grid's cards
// instead. offset* values ignore the transform, so this is scale-independent.
function measureContentWidth(layout: HTMLElement): number {
  let widest = 0
  for (const section of Array.from(layout.children) as HTMLElement[]) {
    if (section.classList.contains('grid')) {
      let left = Infinity
      let right = -Infinity
      for (const card of Array.from(section.children) as HTMLElement[]) {
        left = Math.min(left, card.offsetLeft)
        right = Math.max(right, card.offsetLeft + card.offsetWidth)
      }
      if (right > left) widest = Math.max(widest, right - left)
    } else {
      widest = Math.max(widest, section.offsetWidth)
    }
  }
  return widest
}

function updateScale() {
  const stageEl = stage.value
  const layout = layoutEl.value
  if (!stageEl || !layout || !layout.offsetHeight) {
    scale.value = 1
    return
  }
  const byHeight = stageEl.clientHeight / layout.offsetHeight
  const contentWidth = measureContentWidth(layout)
  const byWidth = contentWidth > 0 ? stageEl.clientWidth / contentWidth : byHeight
  scale.value = Math.min(byWidth, byHeight)
}

const helpDialog = ref<HTMLDialogElement | null>(null)

function openHelp() {
  noteInput()
  helpDialog.value?.showModal()
}

function closeHelp() {
  helpDialog.value?.close()
}

// Native <dialog> backdrop clicks land on the dialog element itself.
function onHelpClick(event: MouseEvent) {
  if (event.target === helpDialog.value) closeHelp()
}

const isFullscreen = ref(false)

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

const cursorIdle = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | undefined

function onPointerMove() {
  noteInput()
  cursorIdle.value = false
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    cursorIdle.value = true
  }, 3000)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('keydown', onKeydown)
  onPointerMove()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateScale)
  }
  watch(
    [stage, layoutEl],
    () => {
      resizeObserver?.disconnect()
      if (stage.value) resizeObserver?.observe(stage.value)
      if (layoutEl.value) resizeObserver?.observe(layoutEl.value)
      updateScale()
    },
    { immediate: true, flush: 'post' },
  )
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(idleTimer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <main class="board" :class="{ 'cursor-idle': cursorIdle }">
    <header class="header">
      <h1>Match<span class="accent">day</span></h1>
      <p class="tagline">World Cup 26 · Live Scores</p>
      <div class="date-row">
        <div class="select-wrap">
          <span class="select-sizer" aria-hidden="true">{{ selectedLabel }}</span>
          <select
            v-model="selectedDate"
            class="date-select"
            aria-label="Match date"
            @change="noteInput"
          >
            <option v-for="option in dateOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <span v-if="asOf" class="stale">as of {{ asOf }}</span>
      </div>
    </header>

    <section v-if="matches.length" ref="stage" class="stage">
      <div ref="layoutEl" class="layout" :style="{ transform: `scale(${scale})` }">
        <p v-if="countdown" class="countdown">{{ countdown }}</p>
        <FeaturedMatch v-if="featuredMatch" :key="featuredMatch.id" :match="featuredMatch" />
        <div v-if="railMatches.length" class="grid" :class="{ rail: featuredMatch }">
          <MatchCard
            v-for="match in railMatches"
            :key="match.id"
            :match="match"
            :compact="Boolean(featuredMatch)"
            @select="select(match.id)"
          />
        </div>
      </div>
    </section>
    <p v-else-if="loading" class="message">Loading matches…</p>
    <p v-else-if="lastGoodAt" class="message">No matches today</p>
    <p v-else class="message">Waiting for scores…</p>

    <footer class="footer">
      Matchday is an unofficial fan project — not affiliated with or endorsed by FIFA or ESPN.
      Match data is requested by your browser directly from ESPN.
    </footer>

    <div class="controls">
      <button
        class="chrome-btn"
        type="button"
        title="Keep the screen awake"
        aria-haspopup="dialog"
        @click="openHelp"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      <button
        class="chrome-btn"
        type="button"
        :title="isFullscreen ? 'Exit full screen' : 'Full screen'"
        @click="toggleFullscreen"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path v-if="isFullscreen" d="M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5" />
          <path v-else d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5" />
        </svg>
      </button>
    </div>

    <dialog ref="helpDialog" class="help" @click="onHelpClick">
      <div class="help-body">
        <h2>Keeping the screen awake</h2>
        <p class="help-lead">
          The board already requests a screen wake lock, so most Chromium browsers (Chrome, Edge)
          keep the display on while this page is open and visible.
        </p>
        <ul>
          <li>Tap the <strong>⤢ full-screen</strong> button for the cleanest wall display.</li>
          <li>
            On a TV or monitor, also turn off the device's own
            <strong>screensaver / sleep / energy-saving</strong> timer — the browser can't override
            that.
          </li>
          <li>
            Keep this tab in the foreground. Browsers drop the wake lock when the tab is hidden; the
            board re-acquires it automatically when you return.
          </li>
          <li>Keep laptops plugged in — some browsers release the lock on battery saver.</li>
          <li>Safari and most smart-TV browsers ignore wake lock; rely on the device settings.</li>
        </ul>
      </div>
      <button class="help-close" type="button" title="Close" @click="closeHelp">Got it</button>
    </dialog>
  </main>
</template>

<style scoped>
.board {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(0.75rem, 2vh, 1.5rem) clamp(1rem, 3vw, 3rem);
}

.board.cursor-idle,
.board.cursor-idle * {
  cursor: none;
}

.header {
  text-align: center;
  margin-bottom: clamp(0.75rem, 2vh, 1.5rem);
}

/* One row of chrome on wide screens; stacked and centered on narrow ones. */
@media (min-width: 64rem) {
  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .header h1 {
    justify-self: start;
  }

  .header .tagline {
    margin: 0;
    justify-self: center;
  }

  .header .date-row {
    margin: 0;
    justify-self: end;
  }
}

h1 {
  margin: 0;
  font-size: clamp(1.25rem, 2.2vw, 2rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.accent {
  color: #fbbf24;
}

.tagline {
  margin: 0.4rem 0 0;
  font-size: clamp(0.75rem, 1vw, 0.95rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #5b6b84;
}

/* Secondary chrome fades with the cursor so an idle TV shows only scores. */
.tagline,
.date-row,
.footer {
  transition: opacity 0.6s;
}

.cursor-idle .tagline,
.cursor-idle .date-row,
.cursor-idle .footer {
  opacity: 0;
}

.cursor-idle .date-row {
  pointer-events: none;
}

.date-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.6rem;
}

.select-wrap {
  position: relative;
}

/* Invisible copy of the selected label; gives the wrapper the exact width
   the select should have, since a native select sizes to its widest option. */
.select-sizer,
.date-select {
  font: inherit;
  font-size: clamp(0.85rem, 1.2vw, 1.05rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1px solid transparent;
  padding: 0.45em 2.4em 0.45em 1.1em;
}

.select-sizer {
  display: block;
  visibility: hidden;
}

.date-select {
  position: absolute;
  inset: 0;
  width: 100%;
  appearance: none;
  color: #8c9bb1;
  background:
    url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%238c9bb1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>')
      no-repeat right 0.8em center / 0.85em,
    rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  border-radius: 0.6em;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.date-select:hover {
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.25);
}

.date-select:focus-visible {
  outline: 2px solid #4ade80;
  outline-offset: 2px;
}

.stale {
  color: #f59e0b;
  font-size: clamp(0.85rem, 1.2vw, 1.05rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1rem, 2.5vh, 2rem);
  width: 100%;
  max-width: 120rem;
  transform-origin: center;
  transition: transform 0.4s ease;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.75rem);
  width: 100%;
}

.grid > * {
  flex: 0 1 clamp(24rem, 30vw, 44rem);
  max-width: 100%;
}

.grid.rail {
  gap: clamp(0.5rem, 1vw, 0.9rem);
}

.grid.rail > * {
  flex: 0 1 auto;
}

.countdown {
  margin: 0;
  font-size: clamp(0.9rem, 1.3vw, 1.2rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8c9bb1;
  font-variant-numeric: tabular-nums;
}

.message {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.7rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #5b6b84;
}

.footer {
  margin-top: clamp(0.5rem, 1.5vh, 1rem);
  text-align: center;
  font-size: clamp(0.65rem, 0.8vw, 0.8rem);
  letter-spacing: 0.06em;
  color: #44516a;
}

.controls {
  position: fixed;
  bottom: clamp(0.75rem, 2vh, 1.5rem);
  right: clamp(0.75rem, 2vw, 1.5rem);
  display: flex;
  gap: 0.5rem;
  transition: opacity 0.3s;
}

.chrome-btn {
  display: grid;
  place-items: center;
  padding: 0.6rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8c9bb1;
  opacity: 0.4;
  cursor: pointer;
  transition:
    opacity 0.3s,
    color 0.2s;
}

.chrome-btn:hover {
  opacity: 1;
  color: #f1f5f9;
}

.cursor-idle .controls {
  opacity: 0;
  pointer-events: none;
}

.help {
  margin: auto;
  max-width: min(92vw, 34rem);
  padding: clamp(1.5rem, 3vw, 2.25rem);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1.25rem;
  background: #11161f;
  color: #c4cede;
}

.help::backdrop {
  background: rgba(4, 7, 12, 0.7);
  backdrop-filter: blur(2px);
}

.help h2 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.25rem, 2.4vw, 1.6rem);
  color: #f1f5f9;
}

.help-lead {
  margin: 0 0 1rem;
  line-height: 1.55;
  color: #8c9bb1;
}

.help ul {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  line-height: 1.5;
}

.help strong {
  color: #f1f5f9;
  font-weight: 600;
}

.help-close {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.7rem;
  border-radius: 0.75rem;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.help-close:hover {
  background: rgba(74, 222, 128, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .layout {
    transition: none;
  }
}
</style>
