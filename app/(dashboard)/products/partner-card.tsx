"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Plug, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { partnerBranding } from "@/lib/store/partners"

export interface PartnerCardProps {
  partnerSlug: string
  partnerName: string
  description: string | null
  connection: {
    id: string
    externalAccountLabel: string | null
  } | null
  publishedCount: number
}

/**
 * Partner logo disc: renders the real brand mark from /public/partners when
 * one is registered for the slug (lib/store/partners), falling back to a
 * Lucide glyph for partners without a logo (e.g. "manual" fulfillment).
 */
function PartnerLogo({ slug }: { slug: string }) {
  const { logoPath, name } = partnerBranding(slug)
  const [failed, setFailed] = useState(false)
  const showLogo = logoPath && !failed

  const fallbackIcon = slug === "manual" ? Truck : Plug
  const FallbackIcon = fallbackIcon
  const ring =
    slug === "manual" ? "bg-slate-100 text-slate-700" : "bg-white text-foreground"

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
        ring,
      )}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoPath!}
          alt={name}
          onError={() => setFailed(true)}
          className="h-7 w-auto max-w-[36px] object-contain"
        />
      ) : (
        <FallbackIcon className="h-6 w-6" />
      )}
    </div>
  )
}

export function PartnerCard({
  partnerSlug,
  partnerName,
  description,
  connection,
  publishedCount,
}: PartnerCardProps) {
  const isConnected = connection !== null

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <PartnerLogo slug={partnerSlug} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold leading-tight">
              {partnerName}
            </h3>
            {isConnected ? (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-100 text-emerald-900"
              >
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
          {isConnected && connection.externalAccountLabel && (
            <p className="mt-1 text-xs text-muted-foreground">
              Shop:{" "}
              <span className="font-medium text-foreground">
                {connection.externalAccountLabel}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {isConnected
            ? `${publishedCount} published`
            : "Connect to bring in products"}
        </span>
        {isConnected ? (
          <Button asChild size="sm" className="gap-1">
            <Link href={`/products/browse/${connection.id}`}>
              Bring in products
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link href="/settings/integrations">
              Connect
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
