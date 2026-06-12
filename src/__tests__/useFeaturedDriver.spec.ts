import { describe, expect, it } from 'vitest'

import { nextTick, ref } from 'vue'
import { useFeaturedDriver } from '../composables/useFeaturedDriver'
import type { Match, MatchTeam } from '../composables/useScoreboard'

function team(abbreviation: string, score = '0'): MatchTeam {
  return { name: abbreviation, abbreviation, logo: '', score, winner: false, stats: {} }
}

function match(id: string, state: Match['state'], homeScore = '0'): Match {
  return {
    id,
    kickoff: new Date('2026-06-15T16:00Z'),
    state,
    statusText: '',
    clockSeconds: null,
    period: 1,
    fetchedAt: 0,
    venue: '',
    note: '',
    attendance: 0,
    headline: '',
    broadcasts: [],
    events: [],
    home: team(`H${id}`, homeScore),
    away: team(`A${id}`),
  }
}

function setup(initial: Match[]) {
  const matches = ref<Match[]>(initial)
  const now = ref(1_000_000)
  const driver = useFeaturedDriver(matches, now)
  return { matches, now, driver }
}

describe('useFeaturedDriver', () => {
  it('features the only live match and shows the grid when nothing is live', async () => {
    const { matches, driver } = setup([match('a', 'in'), match('b', 'pre')])
    expect(driver.featuredId.value).toBe('a')

    matches.value = [match('a', 'post'), match('b', 'pre')]
    await nextTick()
    // Linger holds the just-finished match (covered below); pre matches never feature.
    const { driver: idle } = setup([match('x', 'pre'), match('y', 'post')])
    expect(idle.featuredId.value).toBeNull()
  })

  it('rotates between concurrent live matches every ~60s', async () => {
    const { now, driver } = setup([match('a', 'in'), match('b', 'in')])
    expect(driver.featuredId.value).toBe('a')

    now.value += 60_001
    await nextTick()
    expect(driver.featuredId.value).toBe('b')

    now.value += 60_001
    await nextTick()
    expect(driver.featuredId.value).toBe('a')
  })

  it('lets a goal seize the slot and pin it, then resumes rotation', async () => {
    const { matches, now, driver } = setup([match('a', 'in'), match('b', 'in')])
    expect(driver.featuredId.value).toBe('a')

    matches.value = [match('a', 'in'), match('b', 'in', '1')]
    await nextTick()
    expect(driver.featuredId.value).toBe('b')

    // The pin outlasts a rotation boundary…
    now.value += 61_000
    await nextTick()
    expect(driver.featuredId.value).toBe('b')

    // …and rotation resumes once it expires.
    now.value += 60_000
    await nextTick()
    expect(driver.featuredId.value).toBe('a')
  })

  it('lingers on full-time when nothing else is live, then releases', async () => {
    const { matches, now, driver } = setup([match('a', 'in')])
    expect(driver.featuredId.value).toBe('a')

    matches.value = [match('a', 'post')]
    await nextTick()
    expect(driver.featuredId.value).toBe('a')

    now.value += 120_001
    await nextTick()
    expect(driver.featuredId.value).toBeNull()
  })

  it('switches immediately at full-time when another match is live', async () => {
    const { matches, driver } = setup([match('a', 'in'), match('b', 'in')])
    expect(driver.featuredId.value).toBe('a')

    matches.value = [match('a', 'post'), match('b', 'in')]
    await nextTick()
    expect(driver.featuredId.value).toBe('b')
  })

  it('honors an Override over goals elsewhere and releases when it concludes', async () => {
    const { matches, driver } = setup([match('a', 'in'), match('b', 'in')])
    driver.select('b')
    expect(driver.featuredId.value).toBe('b')

    // A goal in the other match does not steal the slot from a human choice.
    matches.value = [match('a', 'in', '2'), match('b', 'in')]
    await nextTick()
    expect(driver.featuredId.value).toBe('b')

    // The watched match concludes while other football is live: auto resumes.
    matches.value = [match('a', 'in', '2'), match('b', 'post')]
    await nextTick()
    expect(driver.featuredId.value).toBe('a')
  })

  it('decays an Override of an already-final match after ~10 minutes', async () => {
    const { now, driver } = setup([match('a', 'post'), match('b', 'in')])
    expect(driver.featuredId.value).toBe('b')

    driver.select('a')
    expect(driver.featuredId.value).toBe('a')

    now.value += 599_000
    await nextTick()
    expect(driver.featuredId.value).toBe('a')

    now.value += 2_000
    await nextTick()
    expect(driver.featuredId.value).toBe('b')
  })

  it('moves on when dismissed', () => {
    const { driver } = setup([match('a', 'in'), match('b', 'in')])
    expect(driver.featuredId.value).toBe('a')

    driver.dismiss()
    expect(driver.featuredId.value).toBe('b')
  })
})
