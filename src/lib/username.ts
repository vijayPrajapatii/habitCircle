/** Matches the profiles.username CHECK constraint (lowercased). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

export const USERNAME_HELP = '3-30 characters: lowercase letters, numbers and underscores.'

/** Trim + lowercase, so "  Alex_Run " and "alex_run" are the same handle. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(input))
}
