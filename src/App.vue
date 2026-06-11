<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MatchCard from '@/components/MatchCard.vue'
import { formatYmd, useScoreboard } from '@/composables/useScoreboard'

const { matches, loading, stale, selectedDate } = useScoreboard()

const TOURNAMENT_START = new Date(2026, 5, 11)
const TOURNAMENT_END = new Date(2026, 6, 19)

const dateOptions = (() => {
  const options: { value: string; label: string }[] = []
  const today = formatYmd(new Date())
  for (
    const date = new Date(TOURNAMENT_START);
    date <= TOURNAMENT_END;
    date.setDate(date.getDate() + 1)
  ) {
    const value = formatYmd(date)
    const label = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    options.push({ value, label: value === today ? `${label} · Today` : label })
  }
  return options
})()

// Outside the tournament window, fall back to the nearest tournament day.
const firstDay = dateOptions[0]?.value
const lastDay = dateOptions[dateOptions.length - 1]?.value
if (firstDay && selectedDate.value < firstDay) {
  selectedDate.value = firstDay
} else if (lastDay && selectedDate.value > lastDay) {
  selectedDate.value = lastDay
}

const selectedLabel = computed(
  () => dateOptions.find((option) => option.value === selectedDate.value)?.label ?? '',
)

// Scale the grid down so every match fits on screen without scrolling.
const stage = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const scale = ref(1)
let resizeObserver: ResizeObserver | undefined

function updateScale() {
  const stageEl = stage.value
  const grid = gridEl.value
  if (!stageEl || !grid || !grid.offsetHeight) {
    scale.value = 1
    return
  }
  scale.value = Math.min(1, stageEl.clientHeight / grid.offsetHeight)
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
  cursorIdle.value = false
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    cursorIdle.value = true
  }, 3000)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('pointermove', onPointerMove)
  onPointerMove()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateScale)
  }
  watch(
    [stage, gridEl],
    () => {
      resizeObserver?.disconnect()
      if (stage.value) resizeObserver?.observe(stage.value)
      if (gridEl.value) resizeObserver?.observe(gridEl.value)
      updateScale()
    },
    { immediate: true, flush: 'post' },
  )
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('pointermove', onPointerMove)
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
          <select v-model="selectedDate" class="date-select" aria-label="Match date">
            <option v-for="option in dateOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <span v-if="stale" class="stale">reconnecting…</span>
      </div>
    </header>

    <section v-if="matches.length" ref="stage" class="stage">
      <div ref="gridEl" class="grid" :style="{ transform: `scale(${scale})` }">
        <MatchCard v-for="match in matches" :key="match.id" :match="match" />
      </div>
    </section>
    <p v-else-if="loading" class="message">Loading matches…</p>
    <p v-else class="message">No matches today</p>

    <footer class="footer">
      Matchday is an unofficial fan project — not affiliated with or endorsed by FIFA or ESPN.
      Match data is requested by your browser directly from ESPN.
    </footer>

    <button
      class="fullscreen-btn"
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
  </main>
</template>

<style scoped>
.board {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(1rem, 3vh, 2.5rem) clamp(1rem, 3vw, 3rem);
}

.board.cursor-idle,
.board.cursor-idle * {
  cursor: none;
}

.header {
  text-align: center;
  margin-bottom: clamp(1rem, 3vh, 2.5rem);
}

h1 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.6rem);
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

.grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.75rem);
  width: 100%;
  max-width: 120rem;
  transform-origin: center;
}

.grid > * {
  flex: 0 1 clamp(24rem, 30vw, 44rem);
  max-width: 100%;
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

.fullscreen-btn {
  position: fixed;
  top: clamp(0.75rem, 2vh, 1.5rem);
  right: clamp(0.75rem, 2vw, 1.5rem);
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

.fullscreen-btn:hover {
  opacity: 1;
  color: #f1f5f9;
}

.cursor-idle .fullscreen-btn {
  opacity: 0;
  pointer-events: none;
}
</style>
