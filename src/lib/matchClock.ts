import type { Match } from '@/composables/useScoreboard'

// Where ESPN's clock stops counting for each period; past this the feed
// switches to stoppage-time strings ("45'+2'") that we can't tick ourselves.
const PERIOD_CAP_SECONDS: Record<number, number> = { 1: 2700, 2: 5400, 3: 6300, 4: 7200 }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Status text for a match, ticking the live clock client-side between polls.
 * Falls back to ESPN's own string (HT, stoppage, shootouts, pre/post) whenever
 * we don't have a tickable clock.
 */
export function liveClock(match: Match, nowMs: number): string {
  if (match.state !== 'in' || match.clockSeconds == null) return match.statusText
  const cap = PERIOD_CAP_SECONDS[match.period]
  if (!cap || match.clockSeconds >= cap) return match.statusText
  const seconds = Math.min(match.clockSeconds + (nowMs - match.fetchedAt) / 1000, cap)
  return `${Math.floor(seconds / 60)}:${pad(Math.floor(seconds % 60))}`
}
