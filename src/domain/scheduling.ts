/**
 * Pure period-boundary calculations for habit scheduling.
 *
 * All timestamps are UTC Date objects. Period boundaries are computed
 * relative to the habit's IANA timezone.
 */

export type Frequency = 'daily' | 'weekly' | 'monthly';

/**
 * Resolve the year, month, day, day-of-week, and hour in the given
 * IANA timezone without any external library.
 *
 * Uses Intl.DateTimeFormat which is available in all modern runtimes.
 */
function partsInTimezone(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; weekday: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const p = parts.find((p) => p.type === type);
    if (!p) throw new Error(`Missing ${type} in formatted parts for timezone ${timezone}`);
    return p.value;
  };

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: weekdayMap[get('weekday')],
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
  };
}

/**
 * Build a UTC Date from wall-clock components in the given timezone.
 *
 * We iterate to converge because the offset may shift around DST boundaries.
 */
function dateFromTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): Date {
  // Initial guess: treat the wall-clock values as UTC
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Find the offset the timezone has at our guess
  const guessParts = partsInTimezone(guess, timezone);
  const guessWall = new Date(
    Date.UTC(guessParts.year, guessParts.month - 1, guessParts.day, guessParts.hour, guessParts.minute, guessParts.second),
  );
  const offsetMs = guessWall.getTime() - guess.getTime();

  // Adjust: desired_utc = desired_wall - offset
  const result = new Date(guess.getTime() - offsetMs);

  // Verify and do one more correction if DST shifted
  const checkParts = partsInTimezone(result, timezone);
  const checkWall = new Date(
    Date.UTC(checkParts.year, checkParts.month - 1, checkParts.day, checkParts.hour, checkParts.minute, checkParts.second),
  );
  const desiredWall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (checkWall.getTime() !== desiredWall.getTime()) {
    const offset2 = checkWall.getTime() - result.getTime();
    return new Date(guess.getTime() - offset2);
  }

  return result;
}

/**
 * Calculate the start and end of the period that contains `referenceDate`,
 * using the given frequency and IANA timezone.
 *
 * - **daily**: midnight to midnight in the timezone
 * - **weekly**: Monday 00:00 to next Monday 00:00 in the timezone
 * - **monthly**: 1st 00:00 to next month 1st 00:00 in the timezone
 *
 * Both `start` and `end` are returned as UTC Date objects.
 */
export function calculatePeriodBounds(
  frequency: Frequency,
  referenceDate: Date,
  timezone: string,
): { start: Date; end: Date } {
  const parts = partsInTimezone(referenceDate, timezone);

  switch (frequency) {
    case 'daily': {
      const start = dateFromTimezone(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
      // Next day midnight
      const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      // But we need correct wall-clock midnight, so recompute
      const nextParts = partsInTimezone(nextDay, timezone);
      const end = dateFromTimezone(nextParts.year, nextParts.month, nextParts.day, 0, 0, 0, timezone);
      // If end <= start due to DST, add another day
      if (end.getTime() <= start.getTime()) {
        const farther = new Date(start.getTime() + 48 * 60 * 60 * 1000);
        const fartherParts = partsInTimezone(farther, timezone);
        return {
          start,
          end: dateFromTimezone(fartherParts.year, fartherParts.month, fartherParts.day, 0, 0, 0, timezone),
        };
      }
      return { start, end };
    }
    case 'weekly': {
      // Monday = 1. Compute days since Monday.
      const daysSinceMonday = (parts.weekday + 6) % 7; // Mon=0, Tue=1, …, Sun=6
      const mondayDate = parts.day - daysSinceMonday;

      // Build the Monday midnight in the timezone (day might be <=0 which Date handles)
      const startRef = dateFromTimezone(parts.year, parts.month, mondayDate, 0, 0, 0, timezone);
      // Verify it's actually the right Monday
      const startParts = partsInTimezone(startRef, timezone);
      const start = dateFromTimezone(startParts.year, startParts.month, startParts.day, 0, 0, 0, timezone);

      // End = 7 days later
      const endRef = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const endParts = partsInTimezone(endRef, timezone);
      const end = dateFromTimezone(endParts.year, endParts.month, endParts.day, 0, 0, 0, timezone);

      return { start, end };
    }
    case 'monthly': {
      const start = dateFromTimezone(parts.year, parts.month, 1, 0, 0, 0, timezone);

      const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
      const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
      const end = dateFromTimezone(nextYear, nextMonth, 1, 0, 0, 0, timezone);

      return { start, end };
    }
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unsupported frequency: ${_exhaustive}`);
    }
  }
}

/**
 * Returns true if `now` falls within `graceHours` after `periodEnd`.
 */
export function isWithinGracePeriod(
  periodEnd: Date,
  now: Date,
  graceHours: number,
): boolean {
  if (graceHours < 0) {
    throw new Error(`graceHours must be non-negative, got ${graceHours}`);
  }
  const graceEndMs = periodEnd.getTime() + graceHours * 60 * 60 * 1000;
  return now.getTime() >= periodEnd.getTime() && now.getTime() <= graceEndMs;
}

/**
 * Returns true if `now` falls within the review window.
 *
 * The review window begins when the grace period ends and lasts for
 * `reviewHours` hours.
 */
export function isWithinReviewWindow(
  periodEnd: Date,
  graceHours: number,
  reviewHours: number,
  now: Date,
): boolean {
  if (graceHours < 0) {
    throw new Error(`graceHours must be non-negative, got ${graceHours}`);
  }
  if (reviewHours < 0) {
    throw new Error(`reviewHours must be non-negative, got ${reviewHours}`);
  }
  const graceEndMs = periodEnd.getTime() + graceHours * 60 * 60 * 1000;
  const reviewEndMs = graceEndMs + reviewHours * 60 * 60 * 1000;
  const nowMs = now.getTime();
  return nowMs >= graceEndMs && nowMs <= reviewEndMs;
}

/**
 * Compute the start of the next period after `currentPeriodEnd`.
 *
 * By design the next period starts exactly at `currentPeriodEnd`
 * (periods are contiguous with no gap).
 */
export function getNextPeriodStart(
  _frequency: string,
  currentPeriodEnd: Date,
): Date {
  return new Date(currentPeriodEnd.getTime());
}
