import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useScoreboard } from '../composables/useScoreboard'

const NOW = new Date('2026-06-15T16:00:00Z')

const fixture = {
  events: [
    {
      id: '1',
      date: '2026-06-15T16:00Z',
      competitions: [
        {
          status: {
            displayClock: "16'",
            type: { name: 'STATUS_FIRST_HALF', state: 'in', shortDetail: "16'" },
          },
          competitors: [
            {
              homeAway: 'home',
              score: '1',
              team: { id: '203', displayName: 'Mexico', abbreviation: 'MEX' },
            },
            {
              homeAway: 'away',
              score: '0',
              team: { id: '4570', displayName: 'South Africa', abbreviation: 'RSA' },
            },
          ],
        },
      ],
    },
  ],
}

let scoreboard: ReturnType<typeof useScoreboard>
const Host = defineComponent({
  setup() {
    scoreboard = useScoreboard()
    return () => null
  },
})

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixture),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useScoreboard', () => {
  it('does not blank a populated slate until an empty response is confirmed', async () => {
    const wrapper = mount(Host)
    await flushPromises()
    expect(scoreboard.matches.value).toHaveLength(1)

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    } as Response)

    // First empty response is suspect: keep the last good slate.
    await scoreboard.refresh()
    expect(scoreboard.matches.value).toHaveLength(1)

    // A second consecutive empty confirms it.
    await scoreboard.refresh()
    expect(scoreboard.matches.value).toHaveLength(0)

    wrapper.unmount()
  })

  it('keeps the last good slate through failures and tracks data age', async () => {
    const wrapper = mount(Host)
    await flushPromises()
    const goodAt = scoreboard.lastGoodAt.value
    expect(goodAt).not.toBeNull()

    vi.mocked(fetch).mockRejectedValue(new Error('network down'))
    await scoreboard.refresh()

    expect(scoreboard.matches.value).toHaveLength(1)
    expect(scoreboard.lastGoodAt.value).toBe(goodAt)

    wrapper.unmount()
  })
})
