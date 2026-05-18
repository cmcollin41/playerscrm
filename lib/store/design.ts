/**
 * Design config shared by the storefront, the admin editor, and the AI
 * mockup route. Keep this file the single source of truth for design
 * defaults, placement zones, color luminance heuristics, and prompt
 * fragments — the API route and the React form both import from here.
 */

export type DesignPlacement =
  | "front_chest"
  | "front_center"
  | "back_center"
  | "left_chest"

export type Embellishment = "screenprint" | "embroidery" | "dtg" | "vinyl"

export interface DesignConfig {
  placement: DesignPlacement
  embellishment: Embellishment
  /** Normalized x position (0..1) of the design's center within the garment image. */
  x: number
  /** Normalized y position (0..1) of the design's center within the garment image. */
  y: number
  /** Design width as a fraction of the garment width (0..1). */
  scale: number
  /** Rotation in degrees, clockwise. */
  rotation: number
}

export const PLACEMENT_LABELS: Record<DesignPlacement, string> = {
  front_chest: "Front chest (small)",
  front_center: "Front center (large)",
  back_center: "Back center (large)",
  left_chest: "Left chest",
}

export const EMBELLISHMENT_LABELS: Record<Embellishment, string> = {
  screenprint: "Screenprint",
  embroidery: "Embroidery",
  dtg: "Direct-to-garment",
  vinyl: "Heat-pressed vinyl",
}

/**
 * Default position/scale per placement. Used when the org first picks a
 * placement or resets the design — the org can drag/scale from there.
 */
export const PLACEMENT_DEFAULTS: Record<
  DesignPlacement,
  Pick<DesignConfig, "x" | "y" | "scale">
> = {
  front_chest: { x: 0.5, y: 0.3, scale: 0.2 },
  front_center: { x: 0.5, y: 0.45, scale: 0.4 },
  back_center: { x: 0.5, y: 0.4, scale: 0.45 },
  left_chest: { x: 0.32, y: 0.27, scale: 0.14 },
}

export const DEFAULT_DESIGN: DesignConfig = {
  placement: "front_center",
  embellishment: "screenprint",
  ...PLACEMENT_DEFAULTS.front_center,
  rotation: 0,
}

/** Parse a stored design jsonb safely, falling back to defaults. */
export function parseDesign(raw: unknown): DesignConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DESIGN }
  const obj = raw as Partial<DesignConfig>
  const placement: DesignPlacement =
    obj.placement && (obj.placement in PLACEMENT_LABELS)
      ? obj.placement
      : DEFAULT_DESIGN.placement
  const embellishment: Embellishment =
    obj.embellishment && (obj.embellishment in EMBELLISHMENT_LABELS)
      ? obj.embellishment
      : DEFAULT_DESIGN.embellishment
  const fallback = PLACEMENT_DEFAULTS[placement]
  return {
    placement,
    embellishment,
    x: clamp01(obj.x ?? fallback.x),
    y: clamp01(obj.y ?? fallback.y),
    scale: clamp(obj.scale ?? fallback.scale, 0.05, 1),
    rotation: typeof obj.rotation === "number" ? obj.rotation : 0,
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
function clamp01(n: number): number {
  return clamp(n, 0, 1)
}

// ---------------------------------------------------------------------------
// Auto ink color: derive a sensible default from the variant's "Color" option.
// ---------------------------------------------------------------------------

/**
 * Rough luminance (0..1) for common apparel color names. Used to pick
 * white-or-black ink when the org hasn't set an explicit design_color_hex.
 * Unknown colors fall back to 0.5 (= black ink).
 */
const COLOR_LUMINANCE: Record<string, number> = {
  black: 0.05,
  charcoal: 0.18,
  navy: 0.12,
  "true navy": 0.1,
  "heather navy": 0.18,
  "dark green": 0.18,
  "pine green": 0.2,
  olive: 0.32,
  plum: 0.22,
  walnut: 0.28,
  grey: 0.55,
  "heather grey": 0.6,
  silver: 0.72,
  white: 0.97,
  "heather white": 0.92,
  bone: 0.9,
  milk: 0.95,
  ecru: 0.85,
  "sky blue": 0.78,
  "light blue": 0.78,
  steelblue: 0.45,
  teal: 0.42,
  rose: 0.75,
}

/** Look up the rough luminance of a Color value; null if unknown. */
export function colorLuminance(colorName: string | undefined): number | null {
  if (!colorName) return null
  const key = colorName.trim().toLowerCase()
  if (key in COLOR_LUMINANCE) return COLOR_LUMINANCE[key]
  return null
}

/**
 * Resolve the ink color for a variant:
 * - explicit hex wins
 * - otherwise pick white on dark shirts, black on light, by luminance
 * - unknown color → black
 */
export function resolveInkColor(
  variantColorName: string | undefined,
  designColorHex: string | null | undefined,
): string {
  if (designColorHex && /^#?[0-9a-fA-F]{3,8}$/.test(designColorHex)) {
    return designColorHex.startsWith("#") ? designColorHex : `#${designColorHex}`
  }
  const lum = colorLuminance(variantColorName)
  if (lum == null) return "#111111"
  return lum < 0.45 ? "#FFFFFF" : "#111111"
}

// ---------------------------------------------------------------------------
// AI prompt fragments — extracted so the form copy + the route prompt stay
// consistent.
// ---------------------------------------------------------------------------

const EMBELLISHMENT_PROMPT_DESCRIPTIONS: Record<Embellishment, string> = {
  screenprint:
    "screen-printed: flat ink on the fabric with slight fiber texture, matte finish",
  embroidery:
    "embroidered: raised stitching with visible thread direction and a subtle shadow",
  dtg:
    "direct-to-garment printed: soft hand-feel, crisp digital print that follows the fabric weave",
  vinyl:
    "heat-pressed vinyl: smooth slightly glossy material sitting on top of the fabric",
}

const PLACEMENT_PROMPT_DESCRIPTIONS: Record<DesignPlacement, string> = {
  front_chest: "centered on the upper chest area (small, near the collar)",
  front_center: "centered on the chest, large and prominent",
  back_center: "centered on the upper back, large and prominent",
  left_chest: "small, on the wearer's left chest pocket area",
}

export function buildMockupPrompt(opts: {
  design: DesignConfig
  inkColorHex: string
}): string {
  const placementCopy = PLACEMENT_PROMPT_DESCRIPTIONS[opts.design.placement]
  const embellishmentCopy =
    EMBELLISHMENT_PROMPT_DESCRIPTIONS[opts.design.embellishment]
  const widthPct = Math.round(opts.design.scale * 100)
  const rotation = opts.design.rotation
    ? ` Rotated approximately ${Math.round(opts.design.rotation)} degrees.`
    : ""
  return [
    "Reference image 1 is a blank apparel product photo (the garment).",
    "Reference image 2 is a logo or design artwork.",
    `Apply the design from image 2 to the garment ${placementCopy}, sized to roughly ${widthPct}% of the garment's width.${rotation}`,
    `Render the design as ${embellishmentCopy}.`,
    `Render the design's ink in the color ${opts.inkColorHex}. Replace any color in the artwork with this single ink color, preserving the artwork's shape and detail.`,
    "Match the garment's fabric shadows, wrinkles, and lighting so the design looks naturally applied.",
    "Do not change the garment's color, pose, background, or overall composition.",
    "Output a clean photorealistic product mockup with the design integrated into the shirt.",
  ].join(" ")
}
