/**
 * Global utility for BIX currency formatting.
 * Formula: 10,000 XP = 1 BIX
 */

/** Formats XP into a 4-decimal BIX string */
export function formatBix(xp: number): string {
  return (xp / 10000).toFixed(4);
}

/** Formats a raw BIX amount into a 4-decimal string */
export function formatBixAmount(amount: number | string): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (val || 0).toFixed(4);
}