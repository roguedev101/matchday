// Board Timezone (see CONTEXT.md): the device's local timezone, or an explicit
// IANA zone passed as ?tz= for kiosk hardware whose clock is set wrong.
function resolveBoardTimeZone(): string | undefined {
  const tz = new URLSearchParams(window.location.search).get('tz')
  if (!tz) return undefined
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return undefined
  }
}

export const boardTimeZone = resolveBoardTimeZone()

/** Calendar date of an instant in the Board Timezone, as YYYYMMDD. */
export function formatYmd(date: Date): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: boardTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/-/g, '')
}

/** Pure calendar arithmetic on a YYYYMMDD string. */
export function ymdShift(ymd: string, days: number): string {
  const date = new Date(
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)) + days),
  )
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}${month}${day}`
}

/** Human label for a calendar day (no timezone semantics — names the day itself). */
export function dayLabel(ymd: string): string {
  const noonUtc = new Date(
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)), 12),
  )
  return noonUtc.toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** Clock time of an instant in the Board Timezone, e.g. "9:47 PM". */
export function timeLabel(instant: Date | number): string {
  return new Date(instant).toLocaleTimeString([], {
    timeZone: boardTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Full kickoff label in the Board Timezone, e.g. "Friday, June 12, 9:00 PM". */
export function kickoffLabel(kickoff: Date): string {
  return kickoff.toLocaleString([], {
    timeZone: boardTimeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
