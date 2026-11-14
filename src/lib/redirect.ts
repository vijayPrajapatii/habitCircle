/**
 * Accept a post-login redirect target only if it is a same-origin path.
 *
 * `redirectTo` comes from the URL, so it is attacker-controlled. Anything that could
 * navigate off-site (`//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:`) or that
 * browsers normalise into one (tabs/newlines inside the path) falls back to `fallback`.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!value) return fallback

  const path = value.trim()
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback

  return path
}
