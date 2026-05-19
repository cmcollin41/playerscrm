import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, Plug, ShoppingBag, ChevronRight } from "lucide-react"
import { productStorefrontUrl, storefrontUrl } from "@/lib/store/links"
import { getStoreImagePublicUrl } from "@/lib/storage/store-images"
import { PublishButton } from "./publish-button"

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function priceRangeLabel(prices: number[]): string {
  if (prices.length === 0) return "—"
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} – ${formatPrice(max)}`
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "active") return "default"
  if (status === "draft") return "outline"
  return "secondary"
}

interface ConnectionRow {
  id: string
  external_account_label: string | null
  is_active: boolean
  // Supabase returns nested joins as arrays even when the FK is single-valued.
  // The first (and only) element is the partner.
  fulfillment_partners: { name: string; slug: string }[] | null
}

export default async function OrgProductsListPage() {
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const [{ data: products }, { data: connections }, { data: account }] =
    await Promise.all([
      supabase
        .from("org_products")
        .select(
          "id, slug, name, status, updated_at, image_path, connection_id, org_product_variants(price_cents, is_active)",
        )
        .eq("account_id", profile.account_id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("account_partner_connections")
        .select(
          "id, external_account_label, is_active, fulfillment_partners(name, slug)",
        )
        .eq("account_id", profile.account_id)
        .eq("is_active", true),
      supabase
        .from("accounts")
        .select("subdomain, custom_domain")
        .eq("id", profile.account_id)
        .maybeSingle(),
    ])

  const storeUrl = account ? storefrontUrl(account) : null
  const activeConnections = (connections ?? []) as ConnectionRow[]

  return (
    <div className="flex flex-col gap-4">
      {storeUrl ? (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your store
            </p>
            <code className="truncate text-sm">{storeUrl}</code>
          </div>
          <div className="flex shrink-0 gap-2">
            <CopyButton value={storeUrl} label="store URL">
              Copy
            </CopyButton>
            <Button asChild variant="outline" size="sm">
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          Set a subdomain in{" "}
          <Link href="/settings/domain" className="underline">
            Settings → Domain
          </Link>{" "}
          to share your store.
        </div>
      )}

      {activeConnections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <Plug className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No fulfillment partners connected</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Connect Printify, Printful, or another partner to start publishing
            products to your storefront. You design products on the
            partner&apos;s side; we sync them here and handle checkout +
            payments.
          </p>
          <Button asChild className="mt-4">
            <Link href="/settings/integrations">
              <Plug className="mr-1 h-4 w-4" />
              Connect a partner
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Publish from your partner shop
          </p>
          <div className="flex flex-wrap gap-2">
            {activeConnections.map((c) => {
              const partner = c.fulfillment_partners?.[0]
              return (
                <Button
                  key={c.id}
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <Link href={`/products/browse/${c.id}`}>
                    Browse {partner?.name ?? "partner"}
                    {c.external_account_label
                      ? ` (${c.external_account_label})`
                      : ""}
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {products?.length ?? 0} published product
          {(products?.length ?? 0) === 1 ? "" : "s"}
        </p>
      </div>

      {!products || products.length === 0 ? (
        activeConnections.length > 0 && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
            <ShoppingBag className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No products published yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse your connected partner shop above to publish products.
            </p>
          </div>
        )
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => {
                const activePrices = (p.org_product_variants ?? [])
                  .filter((v: any) => v.is_active)
                  .map((v: any) => v.price_cents)
                const variantCount = (p.org_product_variants ?? []).length
                const imageUrl = getStoreImagePublicUrl(supabase, p.image_path)
                return (
                  <TableRow key={p.id}>
                    <TableCell className="w-12">
                      <div className="relative h-10 w-10 overflow-hidden rounded-md bg-muted">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={p.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                            unoptimized
                          />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.slug}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {priceRangeLabel(activePrices)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {activePrices.length}/{variantCount} active
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(p.status)}
                        className="capitalize"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {account && p.status === "active" ? (
                          <CopyButton
                            value={productStorefrontUrl(account, p.slug) ?? ""}
                            label="product link"
                            variant="ghost"
                            disabled={!productStorefrontUrl(account, p.slug)}
                          />
                        ) : null}
                        <PublishButton productId={p.id} status={p.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
