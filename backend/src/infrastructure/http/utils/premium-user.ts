/**
 * Premium access helper (MVP)
 * Uses an email allowlist from env var PREMIUM_EMAILS.
 */
export function isPremiumUser(email: string | null | undefined): boolean {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const allowlist = (process.env.PREMIUM_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(normalizedEmail);
}
