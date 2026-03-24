/**
 * Extract a 4-digit year from a raw GEDCOM date string.
 * Handles: "1850", "ABT 1850", "BET 1800 AND 1850", "AFT 1900", "BEF 1920", "CAL 1870"
 */
export function extractYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const m = date.match(/\b(\d{4})\b/);
  if (!m) return undefined;
  return parseInt(m[1], 10);
}

/**
 * Format a GEDCOM date string for display.
 * Returns the raw string for now — can be enhanced later.
 */
export function formatDate(date: string | undefined): string {
  return date ?? '';
}
