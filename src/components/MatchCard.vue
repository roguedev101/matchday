<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@/composables/useNow'
import { useScoreFlash } from '@/composables/useScoreFlash'
import { vFitText } from '@/lib/fitText'
import { liveClock } from '@/lib/matchClock'
import type { Match } from '@/composables/useScoreboard'

const props = defineProps<{ match: Match; compact?: boolean }>()
const emit = defineEmits<{ select: [] }>()

const homeDimmed = computed(() => props.match.state === 'post' && props.match.away.winner)
const awayDimmed = computed(() => props.match.state === 'post' && props.match.home.winner)

const homeFlash = useScoreFlash(() => props.match.home.score)
const awayFlash = useScoreFlash(() => props.match.away.score)

const shootout = computed(
  () => props.match.home.shootout != null && props.match.away.shootout != null,
)
const detail = computed(() => [props.match.note, props.match.venue].filter(Boolean).join(' · '))

const now = useNow()
const status = computed(() => liveClock(props.match, now.value))
</script>

<template>
  <button
    type="button"
    class="card"
    :class="[`is-${match.state}`, { compact }]"
    @click="emit('select')"
  >
    <div class="status">
      <span v-if="match.state === 'in'" class="live-dot" aria-hidden="true"></span>
      <span>{{ status }}</span>
    </div>

    <div class="matchup">
      <div class="team" :class="{ dimmed: homeDimmed }">
        <img v-if="match.home.logo" class="flag" :src="match.home.logo" :alt="match.home.name" />
        <span class="abbr">{{ match.home.abbreviation }}</span>
        <span v-fit-text class="name">{{ match.home.name }}</span>
      </div>

      <div v-if="match.state === 'pre'" class="score vs">vs</div>
      <div v-else class="score-col">
        <div class="score">
          <span :class="{ dimmed: homeDimmed, flash: homeFlash }">{{ match.home.score }}</span>
          <span class="sep">–</span>
          <span :class="{ dimmed: awayDimmed, flash: awayFlash }">{{ match.away.score }}</span>
        </div>
        <div v-if="shootout" class="pens">{{ match.home.shootout }}–{{ match.away.shootout }} pens</div>
      </div>

      <div class="team" :class="{ dimmed: awayDimmed }">
        <img v-if="match.away.logo" class="flag" :src="match.away.logo" :alt="match.away.name" />
        <span class="abbr">{{ match.away.abbreviation }}</span>
        <span v-fit-text class="name">{{ match.away.name }}</span>
      </div>
    </div>

    <div v-if="detail" class="venue">{{ detail }}</div>
  </button>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.6rem, 1.8vh, 1.25rem);
  padding: clamp(1rem, 2.4vh, 2rem) clamp(1rem, 2vw, 2rem);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.25s,
    border-color 0.25s;
}

.card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.22);
}

.card.is-in:hover {
  border-color: rgba(74, 222, 128, 0.55);
}

.card:focus-visible {
  outline: 2px solid #4ade80;
  outline-offset: 3px;
}

.card.is-in {
  background: rgba(74, 222, 128, 0.05);
  border-color: rgba(74, 222, 128, 0.3);
}

.card.is-post {
  background: rgba(255, 255, 255, 0.025);
}

.status {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: clamp(0.85rem, 1.3vw, 1.1rem);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8c9bb1;
  font-variant-numeric: tabular-nums;
}

.is-in .status {
  color: #4ade80;
}

.live-dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: #4ade80;
  animation: pulse 1.8s ease-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5);
  }
  50% {
    opacity: 0.65;
    box-shadow: 0 0 0 0.45em rgba(74, 222, 128, 0);
  }
}

.matchup {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(0.5rem, 1.5vw, 1.5rem);
  width: 100%;
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  transition: opacity 0.3s;
}

.dimmed {
  opacity: 0.45;
}

.flag {
  height: clamp(3rem, 9vh, 6.5rem);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 0.4rem;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
}

/* Full cards lead with the country name (matching the featured view); the
   trigram only appears in the compact rail where space is tight. */
.abbr {
  display: none;
}

.name {
  font-size: clamp(1.2rem, 2.2vw, 2.4rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score {
  display: flex;
  align-items: baseline;
  gap: clamp(0.5rem, 1vw, 1rem);
  font-size: clamp(3.5rem, 8vw, 9rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.score .flash {
  display: inline-block;
  animation: score-flash 0.9s ease-in-out 3;
}

@keyframes score-flash {
  50% {
    color: #fbbf24;
    transform: scale(1.22);
  }
}

.pens {
  margin-top: 0.5em;
  font-size: clamp(0.85rem, 1.3vw, 1.2rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8c9bb1;
  font-variant-numeric: tabular-nums;
}

.score .sep {
  font-size: 0.55em;
  font-weight: 400;
  color: #4b5a72;
}

.score.vs {
  font-size: clamp(1.1rem, 1.8vw, 1.6rem);
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #5b6b84;
}

.venue {
  font-size: clamp(0.75rem, 1vw, 0.95rem);
  letter-spacing: 0.05em;
  text-align: center;
  color: #5b6b84;
}

/* Compact ticker variant shown in the rail beneath a featured match. */
.card.compact {
  flex-direction: row;
  align-items: center;
  gap: clamp(0.6rem, 1.2vw, 1rem);
  padding: 0.55rem 1.1rem;
  border-radius: 0.9rem;
}

.compact .status {
  font-size: 0.78rem;
}

.compact .matchup {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: auto;
}

.compact .team {
  flex-direction: row;
  gap: 0.45rem;
}

.compact .flag {
  height: 1.5rem;
  border-radius: 0.25rem;
}

.compact .abbr {
  display: inline;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.compact .name,
.compact .venue,
.compact .pens {
  display: none;
}

.compact .score {
  font-size: 1.35rem;
  gap: 0.4rem;
}

.compact .score.vs {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
}

@media (prefers-reduced-motion: reduce) {
  .live-dot,
  .score .flash {
    animation: none;
  }
}
</style>
