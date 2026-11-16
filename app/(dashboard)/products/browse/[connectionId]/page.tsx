import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile, hasAccountAdminAccess } from "@/lib/auth"
import { loadConnection } from "@/lib/integrations/products/connections"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PublishFromPartnerButton } from "./publish-button"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ connectionId: string }>
}

export default async function BrowsePartnerCatalogPage({ params }: PageProps) {
  const { connectionId } = await params
  const profile = await getUserProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const allowed = await hasAccountAdminAccess(supabase, profile.account_id)
  if (!allowed) redirect("/")

  let connection
  try {
    connection = await loadConnection(connectionId, profile.account_id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      "[products/browse] loadConnection failed",
      { connectionId, accountId: profile.account_id, message: msg },
    )
    return (
      <div className="flex flex-col gap-4 py-8">
        <BackLink />
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Couldn&apos;t load the partner connection.</p>
          <p className="mt-1 text-xs">{msg}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            If this persists, the encryption key may have changed since the
            connection was created. Disconnect and reconnect the integration
            in Settings → Integrations.
          </p>
        </div>
      </div>
    )
  }

  if (!connection.adapter.listSyncProducts) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <BackLink />
        <p className="text-sm text-muted-foreground">
          The {connection.partnerSlug} adapter doesn&apos;t support browsing
          yet.
        </p>
      </div>
    )
  }

  let catalog
  try {
    catalog = await connection.adapter.listSyncProducts(connection.ctx)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return (
      <div className="flex flex-col gap-4 py-8">
        <BackLink />
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Could not load partner catalog.</p>
          <p className="mt-1 text-xs">{msg}</p>
        </div>
      </div>
    )
  }

  // Mark already-published products in this account+connection.
  const externalIds = catalog.map((c) => c.externalId)
  const { data: published } = externalIds.length
    ? await supabase
        .from("org_products")
        .select("id, external_product_id, slug, status")
        .eq("connection_id", connectionId)
        .in("external_product_id", externalIds)
    : { data: [] as Array<{
        id: string
        external_product_id: string
        slug: string
        status: string
      }> }

  const publishedByExternalId = new Map(
    (published ?? []).map((p: any) => [p.external_product_id as string, p]),
  )

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <BackLink />
        <h1 className="font-cal text-3xl font-bold">
          Publish from{" "}
          {connection.externalAccountLabel ?? connection.partnerSlug}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {catalog.length} product{catalog.length === 1 ? "" : "s"} on your{" "}
          {connection.partnerSlug} shop. Click publish to add one to your
          PlayersCRM storefront.
        </p>
      </div>

      {catalog.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No products in your partner shop</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a product on the partner side, then refresh this page.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((p) => {
            const existing = publishedByExternalId.get(p.externalId)
            return (
              <Card key={p.externalId} className="overflow-hidden">
                <div className="relative aspect-square bg-muted">
                  {p.thumbnailUrl ? (
                    <Image
                      src={p.thumbnailUrl}
                      alt={p.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium leading-tight">
                      {p.title}
                    </p>
                    {existing ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 bg-emerald-100 text-emerald-900"
                      >
                        Published
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                  </p>
                  <PublishFromPartnerButton
                    connectionId={connectionId}
                    externalProductId={p.externalId}
                    alreadyPublished={Boolean(existing)}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/products"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to products
    </Link>
  )
}
