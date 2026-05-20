import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getTenantAccount } from "@/lib/tenant"
import { getStoreImagePublicUrl } from "@/lib/storage/store-images"
import { sanitizeProductDescription } from "@/lib/store/sanitize"
import { ProductView } from "./product-view"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ productSlug: string }>
}

async function loadProduct(productSlug: string, accountId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("org_products")
    .select(
      "id, slug, name, description, image_path, org_product_variants(id, sku, options, price_cents, image_path, inventory_qty, is_active, ordering)",
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
  const supabase = await createClient()
  const image = getStoreImagePublicUrl(supabase, product.image_path)
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

/**
 * Derive the option axes (Size, Color, etc.) and their values from the
 * variants themselves. Replaces the old product.options column, which used
 * to be set by the in-platform designer.
 */
function deriveOptionsFromVariants(
  variants: { options: Record<string, string> }[],
): { name: string; values: string[] }[] {
  const acc = new Map<string, string[]>()
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options ?? {})) {
      if (!acc.has(name)) acc.set(name, [])
      const list = acc.get(name)!
      if (!list.includes(value)) list.push(value)
    }
  }
  return Array.from(acc.entries()).map(([name, values]) => ({ name, values }))
}

export default async function PublicProductPage({ params }: PageProps) {
  const { productSlug } = await params
  const account = await getTenantAccount()
  if (!account) notFound()

  const product: any = await loadProduct(productSlug, account.id)
  if (!product) notFound()

  const supabase = await createClient()
  const productImageUrl = getStoreImagePublicUrl(supabase, product.image_path)

  const activeVariants = (product.org_product_variants ?? [])
    .filter((v: any) => v.is_active)
    .sort((a: any, b: any) => (a.ordering ?? 0) - (b.ordering ?? 0))

  if (activeVariants.length === 0) {
    notFound()
  }

  const variantsForClient = activeVariants.map((v: any) => ({
    id: v.id,
    sku: v.sku,
    options: (v.options ?? {}) as Record<string, string>,
    price_cents: v.price_cents,
    image_url:
      getStoreImagePublicUrl(supabase, v.image_path) ?? productImageUrl ?? null,
    inventory_qty: v.inventory_qty,
  }))

  const productOptions = deriveOptionsFromVariants(variantsForClient)

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/store"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <ProductView
        productName={product.name}
        descriptionHtml={sanitizeProductDescription(product.description)}
        options={productOptions}
        variants={variantsForClient}
        fallbackImageUrl={productImageUrl ?? null}
      />
    </div>
  )
}
