import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getTenantAccount } from "@/lib/tenant"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag } from "lucide-react"

export const dynamic = "force-dynamic"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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
      "id, slug, name, description, price_cents, image_url, product_templates(category, image_url, lead_time_days)"
    )
    .eq("account_id", account.id)
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-20 text-center">
        <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No products available yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-cal text-3xl font-bold">Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"} available
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p: any) => {
          const image = p.image_url || p.product_templates?.image_url
          return (
            <Link key={p.id} href={`/store/${p.slug}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-muted">
                  {image ? (
                    <Image
                      src={image}
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
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-tight">{p.name}</p>
                    {p.product_templates?.category && (
                      <Badge variant="outline" className="capitalize">
                        {p.product_templates.category}
                      </Badge>
                    )}
                  </div>
                  {p.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPrice(p.price_cents)}
                    </span>
                    {p.product_templates?.lead_time_days != null && (
                      <span className="text-xs text-muted-foreground">
                        ~{p.product_templates.lead_time_days}d to ship
                      </span>
                    )}
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
