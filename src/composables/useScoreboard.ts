import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { formatYmd, timeLabel, ymdShift } from '@/lib/boardTime'
import { flagUrl } from '@/lib/flags'

export interface MatchTeam {
  name: string
  abbreviation: string
  logo: string
  score: string
  shootout?: number
  winner: boolean
  stats: {
    possession?: string
    shots?: string
    shotsOnTarget?: string
  }
}

export interface MatchEvent {
  type: 'goal' | 'red'
  minute: string
  player: string
  side: 'home' | 'away'
  note?: 'P' | 'OG'
}

export interface Match {
  id: string
  kickoff: Date
  state: 'pre' | 'in' | 'post'
  statusText: string
  /** Seconds elapsed in the current period, when tickable (null at HT/stoppage). */
  clockSeconds: number | null
  period: number
  /** When this snapshot was fetched; the live clock ticks forward from here. */
  fetchedAt: number
  venue: string
  note: string
  attendance: number
  headline: string
  broadcasts: string[]
  events: MatchEvent[]
  home: MatchTeam
  away: MatchTeam
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score?: string
  shootoutScore?: number
  winner?: boolean
  statistics?: { name?: string; displayValue?: string }[]
  team: {
    id?: string
    displayName: string
    shortDisplayName?: string
    abbreviation: string
    logo?: string
  }
}

interface EspnDetail {
  clock?: { value?: number; displayValue?: string }
  team?: { id?: string }
  scoringPlay?: boolean
  ownGoal?: boolean
  penaltyKick?: boolean
  redCard?: boolean
  athletesInvolved?: { displayName?: string; shortName?: string }[]
}

interface EspnEvent {
  id: string
  date: string
  competitions: {
    venue?: { fullName?: string; address?: { city?: string } }
    attendance?: number
    notes?: { headline?: string }[]
    headlines?: { shortLinkText?: string }[]
    broadcasts?: { names?: string[] }[]
    details?: EspnDetail[]
    status: {
      clock?: number
      period?: number
      displayClock: string
      type: { name: string; state: 'pre' | 'in' | 'post'; shortDetail: string }
    }
    competitors: EspnCompetitor[]
  }[]
}

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

// Stale (see CONTEXT.md): scores older than this get an "as of HH:MM" label.
export const STALE_AFTER_MS = 90_000

// State-driven cadence: fast while live, slow when nothing can change soon.
const DELAY_LIVE_MS = 15_000
const DELAY_NEAR_KICKOFF_MS = 60_000
const DELAY_IDLE_MS = 300_000
const DELAY_RETRY_MS = 30_000
const KICKOFF_SOON_MS = 60 * 60_000
const KICKOFF_IMMINENT_MS = 5 * 60_000

const STATE_ORDER: Record<Match['state'], number> = { in: 0, pre: 1, post: 2 }

function statValue(competitor: EspnCompetitor, name: string): string | undefined {
  return competitor.statistics?.find((stat) => stat.name === name)?.displayValue
}

function parseTeam(competitor: EspnCompetitor): MatchTeam {
  return {
    name: competitor.team.shortDisplayName || competitor.team.displayName,
    abbreviation: competitor.team.abbreviation,
    logo: flagUrl(competitor.team.abbreviation) ?? competitor.team.logo ?? '',
    score: competitor.score ?? '0',
    shootout: competitor.shootoutScore,
    winner: competitor.winner ?? false,
    stats: {
      possession: statValue(competitor, 'possessionPct'),
      shots: statValue(competitor, 'totalShots'),
      shotsOnTarget: statValue(competitor, 'shotsOnTarget'),
    },
  }
}

function parseEvent(event: EspnEvent, fetchedAt: number): Match | null {
  const competition = event.competitions[0]
  if (!competition) return null
  const home = competition.competitors.find((c) => c.homeAway === 'home')
  const away = competition.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const kickoff = new Date(event.date)
  const { state } = competition.status.type
  const halftime = competition.status.type.name === 'STATUS_HALFTIME'

  let statusText: string
  if (state === 'pre') {
    statusText = timeLabel(kickoff)
  } else if (state === 'in') {
    statusText = halftime ? 'HT' : competition.status.displayClock
  } else {
    statusText = competition.status.type.shortDetail || 'FT'
  }

  const events = (competition.details ?? [])
    .filter((detail) => detail.scoringPlay || detail.redCard)
    .sort((a, b) => (a.clock?.value ?? 0) - (b.clock?.value ?? 0))
    .map(
      (detail): MatchEvent => ({
        type: detail.redCard ? 'red' : 'goal',
        minute: detail.clock?.displayValue ?? '',
        player:
          detail.athletesInvolved?.[0]?.shortName ||
          detail.athletesInvolved?.[0]?.displayName ||
          '',
        side: detail.team?.id != null && detail.team.id === home.team.id ? 'home' : 'away',
        note: detail.penaltyKick ? 'P' : detail.ownGoal ? 'OG' : undefined,
      }),
    )

  return {
    id: event.id,
    kickoff,
    state,
    statusText,
    clockSeconds: state === 'in' && !halftime ? (competition.status.clock ?? null) : null,
    period: competition.status.period ?? 0,
    fetchedAt,
    venue: [competition.venue?.fullName, competition.venue?.address?.city]
      .filter(Boolean)
      .join(' · '),
    note: competition.notes?.[0]?.headline ?? '',
    attendance: competition.attendance ?? 0,
    headline: competition.headlines?.[0]?.shortLinkText ?? '',
    broadcasts: [...new Set((competition.broadcasts ?? []).flatMap((b) => b.names ?? []))],
    events,
    home: parseTeam(home),
    away: parseTeam(away),
  }
}

export function useScoreboard() {
  const matches = ref<Match[]>([])
  const loading = ref(true)
  /** Timestamp of the last response we accepted as truth; null until the first one. */
  const lastGoodAt = ref<number | null>(null)
  const selectedDate = ref(formatYmd(new Date()))
  let timer: ReturnType<typeof setTimeout> | undefined
  let consecutiveEmpty = 0

  async function refresh() {
    const requested = selectedDate.value
    try {
      // ESPN buckets matchdays by US-Eastern day, so the selected local day can
      // span two adjacent buckets; fetch the range and re-bucket by local
      // kickoff date (ADR-0002).
      const range = `${ymdShift(requested, -1)}-${ymdShift(requested, 1)}`
      const response = await fetch(`${SCOREBOARD_URL}?dates=${range}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { events?: EspnEvent[] }
      // Ignore responses that arrive after the user switched dates.
      if (requested !== selectedDate.value) return
      const fetchedAt = Date.now()
      const parsed = (data.events ?? [])
        .map((event) => parseEvent(event, fetchedAt))
        .filter((match): match is Match => match !== null)
        .filter((match) => formatYmd(match.kickoff) === requested)
        .sort(
          (a, b) =>
            STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
            a.kickoff.getTime() - b.kickoff.getTime(),
        )
      // Never blank a populated Slate on one suspicious response: an empty
      // result only counts as truth once a second poll confirms it.
      if (parsed.length === 0 && matches.value.length > 0 && consecutiveEmpty === 0) {
        consecutiveEmpty = 1
        return
      }
      consecutiveEmpty = 0
      matches.value = parsed
      lastGoodAt.value = fetchedAt
    } catch {
      // Keep the last good Slate; staleness is surfaced via lastGoodAt.
    } finally {
      if (requested === selectedDate.value) loading.value = false
    }
  }

  function nextDelayMs(): number {
    const now = Date.now()
    // No accepted data yet, or data has gone stale: keep retrying briskly.
    if (lastGoodAt.value == null || now - lastGoodAt.value > STALE_AFTER_MS)
      return DELAY_RETRY_MS
    if (matches.value.some((match) => match.state === 'in')) return DELAY_LIVE_MS
    const kickoffs = matches.value
      .filter((match) => match.state === 'pre')
      .map((match) => match.kickoff.getTime())
    if (kickoffs.length) {
      const next = Math.min(...kickoffs)
      if (next - now < KICKOFF_IMMINENT_MS) return DELAY_LIVE_MS
      if (next - now < KICKOFF_SOON_MS) return DELAY_NEAR_KICKOFF_MS
    }
    return DELAY_IDLE_MS
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(poll, nextDelayMs())
  }

  async function poll() {
    await refresh()
    schedule()
  }

  watch(selectedDate, () => {
    loading.value = true
    matches.value = []
    lastGoodAt.value = null
    consecutiveEmpty = 0
    poll()
  })

  function onVisibilityChange() {
    if (!document.hidden) poll()
  }

  onMounted(() => {
    poll()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { matches, loading, lastGoodAt, selectedDate, refresh }
}
