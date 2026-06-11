<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '@/composables/useScoreboard'

const props = defineProps<{ match: Match }>()

const homeDimmed = computed(() => props.match.state === 'post' && props.match.away.winner)
const awayDimmed = computed(() => props.match.state === 'post' && props.match.home.winner)
</script>

<template>
  <article class="card" :class="`is-${match.state}`">
    <div class="status">
      <span v-if="match.state === 'in'" class="live-dot" aria-hidden="true"></span>
      <span>{{ match.statusText }}</span>
    </div>

    <div class="matchup">
      <div class="team" :class="{ dimmed: homeDimmed }">
        <img v-if="match.home.logo" class="flag" :src="match.home.logo" :alt="match.home.name" />
        <span class="abbr">{{ match.home.abbreviation }}</span>
        <span class="name">{{ match.home.name }}</span>
      </div>

      <div v-if="match.state === 'pre'" class="score vs">vs</div>
      <div v-else class="score">
        <span :class="{ dimmed: homeDimmed }">{{ match.home.score }}</span>
        <span class="sep">–</span>
        <span :class="{ dimmed: awayDimmed }">{{ match.away.score }}</span>
      </div>

      <div class="team" :class="{ dimmed: awayDimmed }">
        <img v-if="match.away.logo" class="flag" :src="match.away.logo" :alt="match.away.name" />
        <span class="abbr">{{ match.away.abbreviation }}</span>
        <span class="name">{{ match.away.name }}</span>
      </div>
    </div>

    <div v-if="match.venue" class="venue">{{ match.venue }}</div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.75rem, 2.2vh, 1.75rem);
  padding: clamp(1.25rem, 3.2vh, 3rem) clamp(1rem, 2vw, 2rem);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  height: clamp(2.75rem, 7vh, 5.25rem);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 0.4rem;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
}

.abbr {
  font-size: clamp(1.3rem, 2.4vw, 2.3rem);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.name {
  font-size: clamp(0.8rem, 1.1vw, 1rem);
  color: #8c9bb1;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score {
  display: flex;
  align-items: baseline;
  gap: clamp(0.5rem, 1vw, 1rem);
  font-size: clamp(2.75rem, 5.5vw, 6rem);
  font-weight: 800;
  line-height: 1;
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
</style>
