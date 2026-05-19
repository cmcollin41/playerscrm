import Link from "next/link"
import { ArrowRight, Boxes, CheckCircle2, Plug, Shirt, Truck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
 * Stylized partner "logo" — colored disc with a brand-coded Lucide glyph.
 * Real brand logos can replace this later (would go in /public/partners/
 * and read from fulfillment_partners.config.logo_url).
 */
function PartnerLogo({ slug }: { slug: string }) {
  const config = (() => {
    switch (slug) {
      case "printify":
        return { Icon: Boxes, ring: "bg-emerald-50 text-emerald-700" }
      case "printful":
        return { Icon: Shirt, ring: "bg-rose-50 text-rose-700" }
      case "manual":
        return { Icon: Truck, ring: "bg-slate-100 text-slate-700" }
      default:
        return { Icon: Plug, ring: "bg-muted text-muted-foreground" }
    }
  })()
  const { Icon, ring } = config
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
        ring,
      )}
    >
      <Icon className="h-6 w-6" />
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
