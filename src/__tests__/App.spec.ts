import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'

// Noon US-Eastern, mid-tournament (suite TZ is pinned to America/New_York).
const NOW = new Date('2026-06-15T16:00:00Z')

const liveEvent = {
  id: '760415',
  date: '2026-06-15T16:00Z',
  competitions: [
    {
      venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } },
      broadcasts: [{ market: 'national', names: ['FOX', 'Peacock'] }],
      status: {
        displayClock: "16'",
        type: { name: 'STATUS_FIRST_HALF', state: 'in', shortDetail: "16'" },
      },
      details: [
        {
          clock: { value: 1380, displayValue: "23'" },
          team: { id: '203' },
          scoringPlay: true,
          redCard: false,
          yellowCard: false,
          penaltyKick: false,
          ownGoal: false,
          athletesInvolved: [{ displayName: 'Santiago Giménez', shortName: 'S. Giménez' }],
        },
      ],
      competitors: [
        {
          homeAway: 'home',
          score: '1',
          winner: false,
          statistics: [
            { name: 'possessionPct', abbreviation: 'PP', displayValue: '60.5' },
            { name: 'totalShots', abbreviation: 'SHOT', displayValue: '16' },
            { name: 'shotsOnTarget', abbreviation: 'SOG', displayValue: '4' },
          ],
          team: { id: '203', displayName: 'Mexico', abbreviation: 'MEX', logo: '' },
        },
        {
          homeAway: 'away',
          score: '0',
          winner: false,
          statistics: [
            { name: 'possessionPct', abbreviation: 'PP', displayValue: '39.5' },
            { name: 'totalShots', abbreviation: 'SHOT', displayValue: '3' },
            { name: 'shotsOnTarget', abbreviation: 'SOG', displayValue: '2' },
          ],
          team: { id: '4570', displayName: 'South Africa', abbreviation: 'RSA', logo: '' },
        },
      ],
    },
  ],
}

const preEvent = {
  id: '760416',
  date: '2026-06-16T01:00Z', // 9pm ET June 15 — same local day, next UTC day
  competitions: [
    {
      venue: { fullName: 'SoFi Stadium', address: { city: 'Inglewood' } },
      status: {
        displayClock: '0.0',
        type: { name: 'STATUS_SCHEDULED', state: 'pre', shortDetail: '9:00 PM' },
      },
      competitors: [
        {
          homeAway: 'home',
          score: '0',
          winner: false,
          team: { id: '660', displayName: 'United States', abbreviation: 'USA', logo: '' },
        },
        {
          homeAway: 'away',
          score: '0',
          winner: false,
          team: { id: '210', displayName: 'Paraguay', abbreviation: 'PAR', logo: '' },
        },
      ],
    },
  ],
}

const tomorrowEvent = {
  id: '760417',
  date: '2026-06-16T23:00Z', // 7pm ET June 16 — belongs to tomorrow's Slate
  competitions: [
    {
      venue: { fullName: 'BC Place', address: { city: 'Vancouver' } },
      status: {
        displayClock: '0.0',
        type: { name: 'STATUS_SCHEDULED', state: 'pre', shortDetail: '7:00 PM' },
      },
      competitors: [
        {
          homeAway: 'home',
          score: '0',
          winner: false,
          team: { id: '478', displayName: 'Brazil', abbreviation: 'BRA', logo: '' },
        },
        {
          homeAway: 'away',
          score: '0',
          winner: false,
          team: { id: '964', displayName: 'Morocco', abbreviation: 'MAR', logo: '' },
        },
      ],
    },
  ],
}

const scoreboardFixture = { events: [liveEvent, preEvent, tomorrowEvent] }

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(scoreboardFixture),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('App', () => {
  it('renders the selected local day and filters out other days', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Matchday')
    expect(wrapper.text()).toContain('Mexico')
    expect(wrapper.text()).toContain('South Africa')
    // 9pm ET kickoff is June 16 in UTC but belongs to today's local Slate.
    expect(wrapper.text()).toContain('United States')
    // Tomorrow's match must not leak into today's Slate.
    expect(wrapper.text()).not.toContain('Brazil')
    expect(wrapper.text()).not.toContain('BRA')

    wrapper.unmount()
  })

  it('fetches the adjacent ESPN buckets for the picked local day', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('dates=20260614-20260616'))

    await wrapper.find('select').setValue('20260715')
    await flushPromises()

    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('dates=20260714-20260716'))

    wrapper.unmount()
  })

  it('auto-features the live match without any click', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('.featured').exists()).toBe(true)
    expect(wrapper.find('.featured').text()).toContain('Mexico')
    expect(wrapper.text()).toContain('S. Giménez')
    expect(wrapper.text()).toContain("23'")
    // Scoring plays are marked with a ball icon so they read as goals at a glance.
    expect(wrapper.find('.featured .goal-icon').exists()).toBe(true)
    // Live matches surface match stats and where to watch.
    expect(wrapper.find('.featured').text()).toContain('Possession')
    expect(wrapper.find('.featured').text()).toContain('60.5%')
    expect(wrapper.find('.featured').text()).toContain('FOX · Peacock')

    wrapper.unmount()
  })

  it('treats a click as an Override and returns to auto on dismiss', async () => {
    const wrapper = mount(App)
    await flushPromises()

    // Click the pre-match card in the rail: Override features it.
    const railCards = wrapper.findAll('.card')
    const usaCard = railCards.find((card) => card.text().includes('USA'))!
    await usaCard.trigger('click')
    expect(wrapper.find('.featured').text()).toContain('United States')

    // Dismiss: the appliance resumes featuring live football.
    await wrapper.find('.close').trigger('click')
    expect(wrapper.find('.featured').text()).toContain('Mexico')

    wrapper.unmount()
  })

  it('shows an empty state when there are no matches', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    } as Response)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('No matches today')

    wrapper.unmount()
  })
})
