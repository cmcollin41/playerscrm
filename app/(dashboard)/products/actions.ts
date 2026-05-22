"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin, type AuthProfile } from "@/lib/auth"
import { loadConnection } from "@/lib/integrations/products/connections"
import { encryptCredentialsForBytea } from "@/lib/integrations/products/crypto"
import { slugify, slugWithSuffix } from "@/lib/slugify"
import { productStorefrontUrl } from "@/lib/store/links"
import { getAuthSiteUrl } from "@/lib/auth-site"
import type { OrgProductStatus } from "@/types/schema.types"

function partnerWebhookUrl(connectionId: string): string {
  return `${getAuthSiteUrl()}/api/webhooks/partners/${connectionId}`
}

interface SyncedProductPayload {
  product: {
    title: string
    description?: string | null
    thumbnailUrl?: string | null
  }
  variants: Array<{
    externalId: string
    sku?: string | null
    options: Record<string, string>
    retailPriceCents: number
    partnerCostCents?: number | null
    imageUrl?: string | null
    isActive: boolean
  }>
}

/**
 * Persist a partner's product + variant payload into our mirror tables.
 * Re-runnable: matched on (connection_id, external_product_id). Variants
 * are upserted on (product_id, external_variant_id); variants that have
 * disappeared on the partner side are marked inactive rather than deleted
 * so historical orders keep resolving.
 */
async function upsertSyncedProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  connectionId: string,
  externalProductId: string,
  synced: SyncedProductPayload,
): Promise<{ ok: true; productId: string; slug: string } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from("org_products")
    .select("id, slug, published_at")
    .eq("connection_id", connectionId)
    .eq("external_product_id", externalProductId)
    .maybeSingle()

  const slug =
    existing?.slug ?? (await uniqueSlug(supabase, accountId, synced.product.title))
  const publishedAt = existing?.published_at ?? new Date().toISOString()
  const now = new Date().toISOString()

  const productRow = {
    account_id: accountId,
    connection_id: connectionId,
    external_product_id: externalProductId,
    slug,
    name: synced.product.title,
    description: synced.product.description ?? null,
    image_path: synced.product.thumbnailUrl ?? null,
    status: "active" as OrgProductStatus,
    sync_status: "synced" as const,
    last_synced_at: now,
    published_at: publishedAt,
    updated_at: now,
  }

  const { data: upserted, error: upsertErr } = await supabase
    .from("org_products")
    .upsert(productRow, { onConflict: "connection_id,external_product_id" })
    .select("id")
    .single()
  if (upsertErr || !upserted) {
    return { ok: false, error: upsertErr?.message ?? "Could not write product row." }
  }
  const productId = (upserted as { id: string }).id

  const externalIds = synced.variants.map((v) => v.externalId)
  const variantRows = synced.variants.map((v, idx) => ({
    product_id: productId,
    sku: v.sku ?? `${externalProductId}-${v.externalId}`,
    external_variant_id: v.externalId,
    external_options: v.options,
    options: v.options,
    price_cents: v.retailPriceCents,
    partner_cost_cents: v.partnerCostCents ?? null,
    image_path: v.imageUrl ?? null,
    is_active: v.isActive,
    ordering: idx,
  }))

  if (variantRows.length > 0) {
    const { error: variantErr } = await supabase
      .from("org_product_variants")
      .upsert(variantRows, { onConflict: "product_id,external_variant_id" })
    if (variantErr) return { ok: false, error: variantErr.message }
  }

  if (externalIds.length > 0) {
    await supabase
      .from("org_product_variants")
      .update({ is_active: false })
      .eq("product_id", productId)
      .not(
        "external_variant_id",
        "in",
        `(${externalIds.map((id) => `"${id}"`).join(",")})`,
      )
  }

  return { ok: true, productId, slug }
}

/**
 * Flip a product's status. Publishing requires at least one active variant;
 * the storefront 404s without one. published_at is preserved across
 * draft → active → draft cycles so analytics keeps a stable first-published
 * timestamp.
 */
export async function setProductStatus(
  productId: string,
  status: OrgProductStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireAdmin()
  const supabase = await createClient()

  if (status === "active") {
    const { count, error: countErr } = await supabase
      .from("org_product_variants")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("is_active", true)
    if (countErr) return { ok: false, error: countErr.message }
    if (!count || count === 0) {
      return {
        ok: false,
        error: "Add at least one active variant before publishing.",
      }
    }
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("org_products")
    .select("published_at")
    .eq("id", productId)
    .eq("account_id", profile.account_id)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: fetchErr.message }
  if (!existing) return { ok: false, error: "Product not found" }

  const publishedAt =
    status === "active"
      ? (existing.published_at ?? new Date().toISOString())
      : null

  const { error: updateErr } = await supabase
    .from("org_products")
    .update({ status, published_at: publishedAt })
    .eq("id", productId)
    .eq("account_id", profile.account_id)
  if (updateErr) return { ok: false, error: updateErr.message }

  revalidatePath("/products")
  return { ok: true }
}

/**
 * Pull a single product from a connected partner and create (or refresh)
 * mirror rows in org_products + org_product_variants. After this call the
 * product is `active` and live on the storefront, assuming it has at least
 * one enabled variant.
 *
 * Re-running on the same external_product_id is idempotent: existing rows
 * are upserted via the (connection_id, external_product_id) unique index.
 */
export async function publishFromPartner(input: {
  connectionId: string
  externalProductId: string
}): Promise<
  | { ok: true; productId: string }
  | { ok: false; error: string }
> {
  let profile: AuthProfile
  try {
    profile = await requireAdmin()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unauthorized.",
    }
  }

  const supabase = await createClient()

  let connection
  let synced
  try {
    connection = await loadConnection(
      input.connectionId,
      profile.account_id,
    )
    if (!connection.adapter.syncProduct) {
      return {
        ok: false,
        error: `The ${connection.partnerSlug} adapter does not support publishing yet.`,
      }
    }
    synced = await connection.adapter.syncProduct(
      connection.ctx,
      input.externalProductId,
    )
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not sync from partner.",
    }
  }

  if (synced.variants.length === 0) {
    return {
      ok: false,
      error:
        "No enabled variants on this partner product. Enable at least one variant on the partner side before publishing.",
    }
  }

  const upsertResult = await upsertSyncedProduct(
    supabase,
    profile.account_id,
    input.connectionId,
    input.externalProductId,
    synced,
  )
  if (!upsertResult.ok) return { ok: false, error: upsertResult.error }
  const { productId, slug } = upsertResult

  // Ack the publish to the partner so the product isn't stuck in their
  // "Publishing..." state. Best-effort: failures here don't block the import,
  // since the product is already live on our storefront.
  if (connection.adapter.markPublishSucceeded) {
    const { data: account } = await supabase
      .from("accounts")
      .select("subdomain, custom_domain")
      .eq("id", profile.account_id)
      .maybeSingle()
    const handle = account ? productStorefrontUrl(account, slug) : null
    if (handle) {
      try {
        await connection.adapter.markPublishSucceeded(
          connection.ctx,
          input.externalProductId,
          { externalId: productId, handle },
        )
      } catch (err) {
        console.error(
          "[publishFromPartner] markPublishSucceeded failed",
          input.externalProductId,
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  revalidatePath("/products")
  revalidatePath(`/products/browse/${input.connectionId}`)

  return { ok: true, productId }
}

/**
 * Re-fire markPublishSucceeded for every imported partner product on the
 * account and (re)register inbound webhooks on each connection. Used to
 * unstick products that were imported before we started acking publishes,
 * and to backfill webhook registrations on connections that pre-date the
 * auto-registration in connectIntegration.
 */
export async function ackAllPublishedToPartners(): Promise<
  | {
      ok: true
      succeeded: number
      failed: number
      skipped: number
      resynced: number
      webhooksRegistered: number
    }
  | { ok: false; error: string }
> {
  let profile: AuthProfile
  try {
    profile = await requireAdmin()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unauthorized.",
    }
  }

  const supabase = await createClient()

  const [{ data: products, error: productsErr }, { data: account }] =
    await Promise.all([
      supabase
        .from("org_products")
        .select("id, slug, connection_id, external_product_id")
        .eq("account_id", profile.account_id)
        .not("connection_id", "is", null)
        .not("external_product_id", "is", null),
      supabase
        .from("accounts")
        .select("subdomain, custom_domain")
        .eq("id", profile.account_id)
        .maybeSingle(),
    ])

  if (productsErr) return { ok: false, error: productsErr.message }

  const adapterByConnection = new Map<
    string,
    Awaited<ReturnType<typeof loadConnection>>
  >()
  let webhooksRegistered = 0

  async function ensureWebhooks(
    conn: Awaited<ReturnType<typeof loadConnection>>,
  ): Promise<void> {
    if (!conn.adapter.registerWebhooks) return
    let secret = conn.ctx.credentials.webhook_secret as string | undefined
    const isNewSecret = !secret
    if (!secret) {
      secret = randomBytes(32).toString("hex")
      conn.ctx.credentials.webhook_secret = secret
    }
    try {
      await conn.adapter.registerWebhooks(conn.ctx, {
        url: partnerWebhookUrl(conn.ctx.connectionId),
        secret,
      })
      webhooksRegistered++
    } catch (err) {
      console.error(
        "[ackAllPublishedToPartners] registerWebhooks failed",
        conn.ctx.connectionId,
        err instanceof Error ? err.message : err,
      )
      return
    }
    if (isNewSecret) {
      // Persist the new secret onto BOTH backing tables so verifyWebhook can
      // HMAC inbound deliveries. We re-encrypt because credentials_encrypted
      // is a single AES-GCM blob, not field-addressable.
      const ciphertext = encryptCredentialsForBytea(conn.ctx.credentials)
      await Promise.all([
        supabase
          .from("account_partner_connections")
          .update({ credentials_encrypted: ciphertext })
          .eq("id", conn.ctx.connectionId),
        supabase
          .from("account_integrations")
          .update({ credentials_encrypted: ciphertext })
          .eq("account_id", profile.account_id)
          .eq("integration_slug", conn.partnerSlug),
      ])
    }
  }

  // Register webhooks for every connection on this account, even those that
  // haven't published any products yet.
  const { data: allConnections } = await supabase
    .from("account_partner_connections")
    .select("id")
    .eq("account_id", profile.account_id)
    .eq("is_active", true)

  for (const c of (allConnections ?? []) as Array<{ id: string }>) {
    try {
      const conn = await loadConnection(c.id, profile.account_id)
      adapterByConnection.set(c.id, conn)
      await ensureWebhooks(conn)
    } catch (err) {
      console.error(
        "[ackAllPublishedToPartners] loadConnection failed",
        c.id,
        err instanceof Error ? err.message : err,
      )
    }
  }

  if (!products || products.length === 0) {
    return {
      ok: true,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      resynced: 0,
      webhooksRegistered,
    }
  }

  let succeeded = 0
  let failed = 0
  let skipped = 0
  let resynced = 0

  for (const p of products as Array<{
    id: string
    slug: string
    connection_id: string
    external_product_id: string
  }>) {
    const conn = adapterByConnection.get(p.connection_id)
    if (!conn) {
      failed++
      continue
    }

    // Re-pull from the partner so new/edited variants on their side land in
    // our mirror tables. Best-effort: if the partner fetch fails we still
    // try to ack so the product isn't stuck in their publishing state.
    let resolvedSlug = p.slug
    if (conn.adapter.syncProduct) {
      try {
        const synced = await conn.adapter.syncProduct(
          conn.ctx,
          p.external_product_id,
        )
        if (synced.variants.length > 0) {
          const upsertResult = await upsertSyncedProduct(
            supabase,
            profile.account_id,
            p.connection_id,
            p.external_product_id,
            synced,
          )
          if (upsertResult.ok) {
            resolvedSlug = upsertResult.slug
            resynced++
          } else {
            console.error(
              "[ackAllPublishedToPartners] upsert failed",
              p.external_product_id,
              upsertResult.error,
            )
          }
        }
      } catch (err) {
        console.error(
          "[ackAllPublishedToPartners] syncProduct failed",
          p.external_product_id,
          err instanceof Error ? err.message : err,
        )
      }
    }

    if (!conn.adapter.markPublishSucceeded) {
      skipped++
      continue
    }

    const handle = account
      ? productStorefrontUrl(account, resolvedSlug)
      : null
    if (!handle) {
      skipped++
      continue
    }

    try {
      await conn.adapter.markPublishSucceeded(conn.ctx, p.external_product_id, {
        externalId: p.id,
        handle,
      })
      succeeded++
    } catch (err) {
      console.error(
        "[ackAllPublishedToPartners] markPublishSucceeded failed",
        p.external_product_id,
        err instanceof Error ? err.message : err,
      )
      failed++
    }
  }

  revalidatePath("/products")
  return { ok: true, succeeded, failed, skipped, resynced, webhooksRegistered }
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  title: string,
): Promise<string> {
  const base = slugify(title) || "product"
  // First try the clean slug; if taken inside this account, suffix it.
  const { data: existing } = await supabase
    .from("org_products")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", base)
    .maybeSingle()
  if (!existing) return base
  return slugWithSuffix(base)
}
