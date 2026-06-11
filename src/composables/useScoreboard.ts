import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { flagUrl } from '@/lib/flags'

export interface MatchTeam {
  name: string
  abbreviation: string
  logo: string
  score: string
  winner: boolean
}

export interface Match {
  id: string
  kickoff: Date
  state: 'pre' | 'in' | 'post'
  statusText: string
  venue: string
  home: MatchTeam
  away: MatchTeam
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  winner?: boolean
  team: {
    displayName: string
    shortDisplayName?: string
    abbreviation: string
    logo?: string
  }
}

interface EspnEvent {
  id: string
  date: string
  competitions: {
    venue?: { fullName?: string; address?: { city?: string } }
    status: {
      displayClock: string
      type: { name: string; state: 'pre' | 'in' | 'post'; shortDetail: string }
    }
    competitors: EspnCompetitor[]
  }[]
}

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

export function formatYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}${month}${day}`
}

const STATE_ORDER: Record<Match['state'], number> = { in: 0, pre: 1, post: 2 }

function parseTeam(competitor: EspnCompetitor): MatchTeam {
  return {
    name: competitor.team.shortDisplayName || competitor.team.displayName,
    abbreviation: competitor.team.abbreviation,
    logo: flagUrl(competitor.team.abbreviation) ?? competitor.team.logo ?? '',
    score: competitor.score ?? '0',
    winner: competitor.winner ?? false,
  }
}

function parseEvent(event: EspnEvent): Match | null {
  const competition = event.competitions[0]
  if (!competition) return null
  const home = competition.competitors.find((c) => c.homeAway === 'home')
  const away = competition.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const kickoff = new Date(event.date)
  const { state } = competition.status.type

  let statusText: string
  if (state === 'pre') {
    statusText = kickoff.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } else if (state === 'in') {
    statusText =
      competition.status.type.name === 'STATUS_HALFTIME' ? 'HT' : competition.status.displayClock
  } else {
    statusText = competition.status.type.shortDetail || 'FT'
  }

  return {
    id: event.id,
    kickoff,
    state,
    statusText,
    venue: [competition.venue?.fullName, competition.venue?.address?.city]
      .filter(Boolean)
      .join(' · '),
    home: parseTeam(home),
    away: parseTeam(away),
  }
}

export function useScoreboard(pollMs = 30_000) {
  const matches = ref<Match[]>([])
  const loading = ref(true)
  const stale = ref(false)
  const selectedDate = ref(formatYmd(new Date()))
  let timer: ReturnType<typeof setInterval> | undefined

  async function refresh() {
    const requested = selectedDate.value
    try {
      const response = await fetch(`${SCOREBOARD_URL}?dates=${requested}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { events?: EspnEvent[] }
      // Ignore responses that arrive after the user switched dates.
      if (requested !== selectedDate.value) return
      matches.value = (data.events ?? [])
        .map(parseEvent)
        .filter((match): match is Match => match !== null)
        .sort(
          (a, b) =>
            STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
            a.kickoff.getTime() - b.kickoff.getTime(),
        )
      stale.value = false
    } catch {
      if (requested === selectedDate.value) stale.value = true
    } finally {
      if (requested === selectedDate.value) loading.value = false
    }
  }

  watch(selectedDate, () => {
    loading.value = true
    stale.value = false
    matches.value = []
    refresh()
  })

  function onVisibilityChange() {
    if (!document.hidden) refresh()
  }

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, pollMs)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { matches, loading, stale, selectedDate, refresh }
}
