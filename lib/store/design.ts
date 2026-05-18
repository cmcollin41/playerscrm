/**
 * Design config — placement + position + transform for the artwork-on-shirt
 * composite. The API route and the React editor both import from here.
 */

export type DesignPlacement =
  | "front_chest"
  | "front_center"
  | "back_center"
  | "left_chest"

export interface DesignConfig {
  placement: DesignPlacement
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
  const fallback = PLACEMENT_DEFAULTS[placement]
  return {
    placement,
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
