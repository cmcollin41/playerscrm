import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getStoreImagePublicUrl } from "@/lib/storage/store-images"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Boxes } from "lucide-react"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export const dynamic = "force-dynamic"

export default async function CatalogPickerPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from("product_templates")
    .select(
      "id, slug, name, description, category, base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days, image_path, fulfillment_partners(slug, name)"
    )
    .eq("is_active", true)
    .order("name")

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <div>
        <h2 className="text-xl font-semibold">Pick a template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Templates are platform-curated SKUs tied to a fulfillment partner.
          Pick one to customize for your team.
        </p>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          No catalog templates available yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t: any) => {
            const imageUrl = getStoreImagePublicUrl(supabase, t.image_path)
            return (
            <Link
              key={t.id}
              href={`/products/new/${t.id}`}
              className="group"
            >
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-muted">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={t.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Boxes className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium leading-tight">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.fulfillment_partners?.name}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {t.category}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      From {formatPrice(t.base_cost_cents + t.min_markup_cents)}
                    </span>
                    {t.lead_time_days != null && (
                      <span className="text-muted-foreground">
                        ~{t.lead_time_days}d lead
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
