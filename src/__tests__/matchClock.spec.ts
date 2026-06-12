import { describe, expect, it } from 'vitest'

import { liveClock } from '../lib/matchClock'
import type { Match, MatchTeam } from '../composables/useScoreboard'

function team(abbreviation: string): MatchTeam {
  return { name: abbreviation, abbreviation, logo: '', score: '0', winner: false, stats: {} }
}

function match(overrides: Partial<Match>): Match {
  return {
    id: '1',
    kickoff: new Date('2026-06-15T16:00Z'),
    state: 'in',
    statusText: "16'",
    clockSeconds: 960,
    period: 1,
    fetchedAt: 0,
    venue: '',
    note: '',
    attendance: 0,
    headline: '',
    broadcasts: [],
    events: [],
    home: team('MEX'),
    away: team('RSA'),
    ...overrides,
  }
}

describe('liveClock', () => {
  it('ticks the clock forward from the fetch snapshot', () => {
    expect(liveClock(match({}), 0)).toBe('16:00')
    expect(liveClock(match({}), 30_000)).toBe('16:30')
    expect(liveClock(match({}), 95_000)).toBe('17:35')
  })

  it('caps at the period boundary instead of ticking into stoppage', () => {
    expect(liveClock(match({ clockSeconds: 2690 }), 60_000)).toBe('45:00')
  })

  it('falls back to the feed string once the clock reaches stoppage', () => {
    expect(liveClock(match({ clockSeconds: 2700, statusText: "45'+2'" }), 10_000)).toBe("45'+2'")
  })

  it('falls back when there is no tickable clock (halftime, shootouts)', () => {
    expect(liveClock(match({ clockSeconds: null, statusText: 'HT' }), 10_000)).toBe('HT')
    expect(liveClock(match({ period: 5, statusText: 'PEN' }), 10_000)).toBe('PEN')
  })

  it('leaves pre and post matches alone', () => {
    expect(liveClock(match({ state: 'pre', statusText: '9:00 PM' }), 10_000)).toBe('9:00 PM')
    expect(liveClock(match({ state: 'post', statusText: 'FT' }), 10_000)).toBe('FT')
  })
})
