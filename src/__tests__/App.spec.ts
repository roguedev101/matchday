import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'

const scoreboardFixture = {
  events: [
    {
      id: '760415',
      date: '2026-06-11T19:00Z',
      competitions: [
        {
          venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } },
          status: {
            displayClock: "16'",
            type: { name: 'STATUS_FIRST_HALF', state: 'in', shortDetail: "16'" },
          },
          competitors: [
            {
              homeAway: 'home',
              score: '1',
              winner: false,
              team: { displayName: 'Mexico', abbreviation: 'MEX', logo: '' },
            },
            {
              homeAway: 'away',
              score: '0',
              winner: false,
              team: { displayName: 'South Africa', abbreviation: 'RSA', logo: '' },
            },
          ],
        },
      ],
    },
  ],
}

beforeEach(() => {
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
})

describe('App', () => {
  it('renders fetched matches on the scoreboard', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Matchday')
    expect(wrapper.text()).toContain('World Cup')
    expect(wrapper.text()).toContain('MEX')
    expect(wrapper.text()).toContain('RSA')
    expect(wrapper.text()).toContain('Estadio Banorte')

    wrapper.unmount()
  })

  it('fetches scores for the date picked in the dropdown', async () => {
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.find('select').setValue('20260715')
    await flushPromises()

    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('dates=20260715'))

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
