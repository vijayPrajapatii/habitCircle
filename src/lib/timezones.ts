/** IANA timezones offered in pickers. Never fixed offsets (see docs: time rules). */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
] as const

/**
 * Options for a timezone `<select>`. A saved value that is not in the common
 * list is kept as a selectable option; otherwise the browser would silently show
 * the first option (UTC) while the real value stayed different.
 */
export function timezoneOptions(current?: string | null): string[] {
  const options: string[] = [...COMMON_TIMEZONES]
  if (current && !options.includes(current)) {
    options.unshift(current)
  }
  return options
}

/** "America/New_York" -> "America/New York" for display. */
export function formatTimezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ')
}
