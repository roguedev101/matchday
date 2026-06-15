<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@/composables/useNow'
import { useScoreFlash } from '@/composables/useScoreFlash'
import { kickoffLabel } from '@/lib/boardTime'
import { vFitText } from '@/lib/fitText'
import { liveClock } from '@/lib/matchClock'
import type { Match } from '@/composables/useScoreboard'

const props = defineProps<{ match: Match }>()

const homeDimmed = computed(() => props.match.state === 'post' && props.match.away.winner)
const awayDimmed = computed(() => props.match.state === 'post' && props.match.home.winner)

const homeFlash = useScoreFlash(() => props.match.home.score)
const awayFlash = useScoreFlash(() => props.match.away.score)

const shootout = computed(
  () => props.match.home.shootout != null && props.match.away.shootout != null,
)

const homeEvents = computed(() => props.match.events.filter((event) => event.side === 'home'))
const awayEvents = computed(() => props.match.events.filter((event) => event.side === 'away'))

const now = useNow()
const status = computed(() => liveClock(props.match, now.value))
const kickoffText = computed(() => kickoffLabel(props.match.kickoff))

// Match stats arrive in the same feed; show the three that tell the story.
const STAT_ROWS = [
  ['possession', 'Possession'],
  ['shots', 'Shots'],
  ['shotsOnTarget', 'On target'],
] as const

function formatStat(key: (typeof STAT_ROWS)[number][0], value: string): string {
  return key === 'possession' ? `${value.replace(/\.0$/, '')}%` : value
}

const stats = computed(() => {
  if (props.match.state === 'pre') return []
  const rows: { label: string; home: string; away: string }[] = []
  for (const [key, label] of STAT_ROWS) {
    const home = props.match.home.stats[key]
    const away = props.match.away.stats[key]
    if (home != null && away != null)
      rows.push({ label, home: formatStat(key, home), away: formatStat(key, away) })
  }
  return rows
})

// Where to watch — actionable before and during the match, noise after.
const broadcastText = computed(() =>
  props.match.state === 'post' ? '' : props.match.broadcasts.join(' · '),
)
</script>

<template>
  <article class="featured" :class="`is-${match.state}`">
    <div class="status">
      <span v-if="match.state === 'in'" class="live-dot" aria-hidden="true"></span>
      <span class="status-text">{{ status }}</span>
      <span v-if="match.note" class="note">{{ match.note }}</span>
    </div>

    <div class="matchup">
      <div class="team" :class="{ dimmed: homeDimmed }">
        <img v-if="match.home.logo" class="flag" :src="match.home.logo" :alt="match.home.name" />
        <span v-fit-text class="team-name">{{ match.home.name }}</span>
      </div>

      <div v-if="match.state === 'pre'" class="score vs">vs</div>
      <div v-else class="score-col">
        <div class="score">
          <span :class="{ dimmed: homeDimmed, flash: homeFlash }">{{ match.home.score }}</span>
          <span class="sep">–</span>
          <span :class="{ dimmed: awayDimmed, flash: awayFlash }">{{ match.away.score }}</span>
        </div>
        <div v-if="shootout" class="pens">
          {{ match.home.shootout }}–{{ match.away.shootout }} on penalties
        </div>
      </div>

      <div class="team" :class="{ dimmed: awayDimmed }">
        <img v-if="match.away.logo" class="flag" :src="match.away.logo" :alt="match.away.name" />
        <span v-fit-text class="team-name">{{ match.away.name }}</span>
      </div>
    </div>

    <div v-if="match.events.length" class="events">
      <div class="events-col home">
        <div
          v-for="(event, index) in homeEvents"
          :key="index"
          class="event"
          :style="{ '--i': String(index) }"
        >
          <span class="player">
            {{ event.player }}<span v-if="event.note" class="event-note"> ({{ event.note }})</span>
          </span>
          <span v-if="event.type === 'red'" class="red-card" title="Red card"></span>
          <svg v-else class="goal-icon" viewBox="0 0 24 24" aria-hidden="true">
            <title>Goal</title>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M12 7l4.8 3.5L15 16H9l-1.8-5.5Z" fill="currentColor" />
            <path
              d="M12 7V2.5M16.8 10.5l4.3-1.4M15 16l2.9 3.7M9 16l-2.9 3.7M7.2 10.5L2.9 9.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
          <span class="minute">{{ event.minute }}</span>
        </div>
      </div>
      <div class="events-divider" aria-hidden="true"></div>
      <div class="events-col away">
        <div
          v-for="(event, index) in awayEvents"
          :key="index"
          class="event"
          :style="{ '--i': String(index) }"
        >
          <span class="minute">{{ event.minute }}</span>
          <span v-if="event.type === 'red'" class="red-card" title="Red card"></span>
          <svg v-else class="goal-icon" viewBox="0 0 24 24" aria-hidden="true">
            <title>Goal</title>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M12 7l4.8 3.5L15 16H9l-1.8-5.5Z" fill="currentColor" />
            <path
              d="M12 7V2.5M16.8 10.5l4.3-1.4M15 16l2.9 3.7M9 16l-2.9 3.7M7.2 10.5L2.9 9.1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
          </svg>
          <span class="player">
            {{ event.player }}<span v-if="event.note" class="event-note"> ({{ event.note }})</span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="stats.length" class="stats">
      <template v-for="row in stats" :key="row.label">
        <span class="stat-value home">{{ row.home }}</span>
        <span class="stat-label">{{ row.label }}</span>
        <span class="stat-value away">{{ row.away }}</span>
      </template>
    </div>

    <div class="meta">
      <span>{{ kickoffText }}</span>
      <span v-if="match.venue">{{ match.venue }}</span>
      <span v-if="match.attendance">Attendance {{ match.attendance.toLocaleString() }}</span>
      <span v-if="broadcastText">{{ broadcastText }}</span>
    </div>

    <p v-if="match.headline" class="headline">{{ match.headline }}</p>
  </article>
</template>

<style scoped>
.featured {
  position: relative;
  width: min(100%, 84rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1rem, 2.6vh, 2rem);
  padding: clamp(1.5rem, 4vh, 3.25rem) clamp(1.25rem, 4vw, 4rem);
  border-radius: 2rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: featured-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.featured.is-in {
  border-color: rgba(74, 222, 128, 0.3);
  background:
    radial-gradient(70% 90% at 50% 0%, rgba(74, 222, 128, 0.08), rgba(74, 222, 128, 0) 70%),
    rgba(255, 255, 255, 0.03);
}

@keyframes featured-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.97);
  }
}

.status {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: clamp(1rem, 1.6vw, 1.4rem);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8c9bb1;
  font-variant-numeric: tabular-nums;
}

.is-in .status-text {
  color: #4ade80;
}

.note {
  color: #5b6b84;
}

.note::before {
  content: '·';
  margin-right: 0.6em;
  color: #44516a;
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
  gap: clamp(0.75rem, 2.5vw, 2.5rem);
  width: 100%;
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.5rem, 1.4vh, 1rem);
  min-width: 0;
  transition: opacity 0.3s;
}

.dimmed {
  opacity: 0.45;
}

.flag {
  height: clamp(4.5rem, 15vh, 9rem);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 0.5rem;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
}

.team-name {
  font-size: clamp(1.1rem, 2vw, 1.9rem);
  font-weight: 700;
  letter-spacing: 0.04em;
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
  gap: clamp(0.75rem, 1.5vw, 1.5rem);
  font-size: clamp(4.5rem, 11vw, 11rem);
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
  margin-top: 0.6em;
  font-size: clamp(1rem, 1.5vw, 1.4rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8c9bb1;
  font-variant-numeric: tabular-nums;
}

.score .sep {
  font-size: 0.5em;
  font-weight: 400;
  color: #4b5a72;
}

.score.vs {
  font-size: clamp(1.4rem, 2.4vw, 2.2rem);
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #5b6b84;
}

.events {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0 clamp(1rem, 3vw, 2.5rem);
  width: 100%;
}

.events-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.events-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.events-col.home {
  align-items: flex-end;
}

.events-col.away {
  align-items: flex-start;
}

.event {
  display: flex;
  align-items: baseline;
  gap: 0.55em;
  font-size: clamp(0.85rem, 1.2vw, 1.05rem);
  color: #c4cede;
  animation: event-in 0.4s ease-out both;
  animation-delay: calc(0.15s + var(--i, 0) * 0.06s);
}

@keyframes event-in {
  from {
    opacity: 0;
    transform: translateX(var(--shift, 0));
  }
}

.events-col.home .event {
  --shift: 8px;
}

.events-col.away .event {
  --shift: -8px;
}

.minute {
  color: #fbbf24;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.event-note {
  color: #5b6b84;
}

.red-card {
  align-self: center;
  width: 0.65em;
  height: 0.9em;
  border-radius: 0.12em;
  background: #ef4444;
  transform: rotate(8deg);
}

.goal-icon {
  align-self: center;
  width: 0.95em;
  height: 0.95em;
  color: #e2e8f0;
}

.stats {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.3rem clamp(1.25rem, 3vw, 2.5rem);
  width: min(100%, 30rem);
  font-size: clamp(0.85rem, 1.2vw, 1.05rem);
  font-variant-numeric: tabular-nums;
}

.stat-value {
  color: #c4cede;
  font-weight: 600;
}

.stat-value.home {
  text-align: right;
}

.stat-label {
  text-align: center;
  font-size: 0.85em;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5b6b84;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  font-size: clamp(0.8rem, 1.1vw, 1rem);
  letter-spacing: 0.05em;
  color: #5b6b84;
}

.meta span + span::before {
  content: '·';
  margin: 0 0.6em;
  color: #44516a;
}

.headline {
  margin: 0;
  max-width: 50ch;
  text-align: center;
  font-size: clamp(0.9rem, 1.2vw, 1.1rem);
  line-height: 1.5;
  color: #8c9bb1;
}

@media (prefers-reduced-motion: reduce) {
  .featured,
  .event,
  .live-dot,
  .score .flash {
    animation: none;
  }
}
</style>
