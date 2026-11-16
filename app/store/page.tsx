import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getTenantAccount } from "@/lib/tenant"
import { getStoreImagePublicUrl } from "@/lib/storage/store-images"
import { productDescriptionToPlainText } from "@/lib/store/sanitize"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingBag } from "lucide-react"
import { formatCents } from "@/lib/money"

export const dynamic = "force-dynamic"

function priceLabel(prices: number[]): string | null {
  if (prices.length === 0) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatCents(min)
  return `From ${formatCents(min)}`
}

export async function generateMetadata(): Promise<Metadata> {
  const account = await getTenantAccount()
  if (!account) return {}
  const name = account.name ?? "Team store"
  return {
    title: `${name} · Store`,
    description: `Shop merchandise and uniforms from ${name}.`,
  }
}

export default async function PublicStorePage() {
  const account = await getTenantAccount()
  if (!account) notFound()

  const supabase = await createClient()
  const { data: products } = await supabase
    .from("org_products")
    .select(
      "id, slug, name, description, image_path, org_product_variants(price_cents, is_active)",
    )
    .eq("account_id", account.id)
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })

  // Only show products that have at least one active variant.
  const visibleProducts = (products ?? []).filter((p: any) =>
    (p.org_product_variants ?? []).some((v: any) => v.is_active),
  )

  if (visibleProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-20 text-center">
        <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No products available yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-cal text-3xl font-bold">Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {visibleProducts.length} product
          {visibleProducts.length === 1 ? "" : "s"} available
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((p: any) => {
          const imageUrl = getStoreImagePublicUrl(supabase, p.image_path)
          const activePrices = p.org_product_variants
            .filter((v: any) => v.is_active)
            .map((v: any) => v.price_cents)
          const price = priceLabel(activePrices)
          const descriptionPreview = productDescriptionToPlainText(p.description)
          return (
            <Link key={p.id} href={`/store/${p.slug}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-muted">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={p.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="font-medium leading-tight">{p.name}</p>
                  {descriptionPreview && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {descriptionPreview}
                    </p>
                  )}
                  <div className="mt-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {price ?? "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
