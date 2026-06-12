import { describe, expect, it } from 'vitest'

import { dayLabel, formatYmd, timeLabel, ymdShift } from '../lib/boardTime'

// Suite TZ is pinned to America/New_York in vitest.config.ts.
describe('formatYmd', () => {
  it('buckets an instant by its local calendar day', () => {
    expect(formatYmd(new Date('2026-06-13T12:00Z'))).toBe('20260613')
  })

  it('assigns a UTC-after-midnight kickoff to the previous local day', () => {
    // 9pm ET on June 12 is already June 13 in UTC.
    expect(formatYmd(new Date('2026-06-13T01:00Z'))).toBe('20260612')
  })
})

describe('ymdShift', () => {
  it('does plain calendar arithmetic', () => {
    expect(ymdShift('20260612', -1)).toBe('20260611')
    expect(ymdShift('20260612', 1)).toBe('20260613')
  })

  it('crosses month boundaries', () => {
    expect(ymdShift('20260630', 1)).toBe('20260701')
    expect(ymdShift('20260701', -1)).toBe('20260630')
  })
})

describe('labels', () => {
  it('names the calendar day without timezone drift', () => {
    expect(dayLabel('20260611')).toContain('June 11')
    expect(dayLabel('20260611')).toContain('Thursday')
  })

  it('renders clock times in the board timezone', () => {
    expect(timeLabel(new Date('2026-06-13T01:00Z'))).toBe('9:00 PM')
  })
})
