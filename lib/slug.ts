/**
 * Convert a string to a URL-friendly slug.
 * Lowercase, replace spaces/special chars with hyphens, collapse multiple hyphens.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== "string") return ""
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Generate a unique slug by appending a short suffix if the base slug exists.
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: string[],
  maxAttempts = 10
): string {
  if (!baseSlug) return ""
  const normalized = slugify(baseSlug) || "item"
  const set = new Set(existingSlugs.map((s) => s.toLowerCase()))
  if (!set.has(normalized)) return normalized
  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = `${normalized}-${i}`
    if (!set.has(candidate)) return candidate
  }
  return `${normalized}-${crypto.randomUUID().slice(0, 8)}`
}
