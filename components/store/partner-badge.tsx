"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { partnerBranding } from "@/lib/store/partners"

interface PartnerBadgeProps {
  slug: string | null | undefined
  /** "default" shows the friendly name; "logo-only" hides the text (e.g. for chips). */
  variant?: "default" | "logo-only"
  /** Icon size in px. Default 16. */
  size?: number
  className?: string
}

/**
 * Renders the partner's logo (if registered in lib/store/partners) plus their
 * display name. Falls back to a generic Package icon when no logoPath is set
 * or when the file 404s at runtime — so dropping in a new SVG at
 * /public/partners/{slug}.svg "just works" without code changes.
 */
export function PartnerBadge({
  slug,
  variant = "default",
  size = 16,
  className,
}: PartnerBadgeProps) {
  const { name, logoPath } = partnerBranding(slug)
  const [failed, setFailed] = useState(false)
  const showLogo = logoPath && !failed

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoPath!}
          alt={name}
          onError={() => setFailed(true)}
          // Height-driven sizing keeps non-square marks (e.g. Printful's
          // three triangles, ~2.15:1) from getting squished.
          style={{ height: size, width: "auto", maxWidth: size * 2.4 }}
          className="shrink-0 object-contain"
        />
      ) : (
        <Package style={{ width: size, height: size }} className="shrink-0" />
      )}
      {variant === "default" ? <span>{name}</span> : null}
    </span>
  )
}
