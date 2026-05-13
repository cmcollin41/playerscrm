/**
 * Convert a human label into a URL-safe slug. Lowercases, replaces
 * runs of non-alphanumeric chars with a single dash, trims dashes from
 * either end.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/**
 * Add a short random suffix to a slug for collision-avoidance. Returns
 * "myslug-a3f9" style strings.
 */
export function slugWithSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}
