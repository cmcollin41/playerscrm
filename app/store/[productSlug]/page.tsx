import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getTenantAccount } from "@/lib/tenant"
import { Badge } from "@/components/ui/badge"
import { ProductBuyPanel } from "./product-buy-panel"

export const dynamic = "force-dynamic"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

interface PageProps {
  params: Promise<{ productSlug: string }>
}

async function loadProduct(productSlug: string, accountId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("org_products")
    .select(
      "id, slug, name, description, price_cents, customization, image_url, product_templates(id, name, category, image_url, lead_time_days, shipping_flat_cents, metadata, fulfillment_partners(slug, name))"
    )
    .eq("account_id", accountId)
    .eq("slug", productSlug)
    .eq("status", "active")
    .maybeSingle()
  return data
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { productSlug } = await params
  const account = await getTenantAccount()
  if (!account) return {}
  const product: any = await loadProduct(productSlug, account.id)
  if (!product) return {}

  const accountName = account.name ?? "Team store"
  const image = product.image_url || product.product_templates?.image_url
  return {
    title: `${product.name} · ${accountName}`,
    description: product.description ?? `${product.name} from ${accountName}.`,
    openGraph: {
      type: "website",
      title: product.name,
      description: product.description ?? undefined,
      images: image ? [{ url: image, alt: product.name }] : undefined,
      siteName: accountName,
    },
  }
}

export default async function PublicProductPage({ params }: PageProps) {
  const { productSlug } = await params
  const account = await getTenantAccount()
  if (!account) notFound()

  const product: any = await loadProduct(productSlug, account.id)
  if (!product) notFound()

  const template = product.product_templates
  const image = product.image_url || template?.image_url
  const sizes: string[] = Array.isArray(template?.metadata?.sizes)
    ? template.metadata.sizes.filter((s: any) => typeof s === "string")
    : []
  const customization = (product.customization ?? {}) as Record<string, string>

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/store"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              {template?.category && (
                <Badge variant="outline" className="capitalize">
                  {template.category}
                </Badge>
              )}
              {template?.lead_time_days != null && (
                <span className="text-xs text-muted-foreground">
                  Ships in ~{template.lead_time_days} days
                </span>
              )}
            </div>
            <h1 className="mt-2 font-cal text-3xl font-bold">{product.name}</h1>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatPrice(product.price_cents)}
            </p>
            {template?.shipping_flat_cents > 0 && (
              <p className="text-xs text-muted-foreground">
                + {formatPrice(template.shipping_flat_cents)} shipping
              </p>
            )}
          </div>

          {product.description && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {product.description}
            </p>
          )}

          {Object.keys(customization).length > 0 && (
            <CustomizationSummary customization={customization} />
          )}

          <ProductBuyPanel
            productId={product.id}
            productName={product.name}
            sizes={sizes}
          />
        </div>
      </div>
    </div>
  )
}

function humanize(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\burl\b/i, "URL")
    .replace(/^\w/, (c) => c.toUpperCase())
}

function CustomizationSummary({
  customization,
}: {
  customization: Record<string, string>
}) {
  const entries = Object.entries(customization).filter(
    ([, v]) => v != null && v !== ""
  )
  if (entries.length === 0) return null

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Customization
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{humanize(k)}</dt>
            <dd className="truncate font-medium">
              {k.endsWith("_color") ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded border"
                    style={{ backgroundColor: v }}
                  />
                  <span className="font-mono text-xs">{v}</span>
                </span>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
