"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { loadConnection } from "@/lib/fulfillment/connections"
import { slugify, slugWithSuffix } from "@/lib/slugify"
import type { OrgProductStatus } from "@/types/schema.types"

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
  let profile
  try {
    profile = await requireAdmin()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unauthorized.",
    }
  }

  const supabase = await createClient()

  let synced
  try {
    const connection = await loadConnection(
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

  // Reuse an existing slug if we've published this product before; otherwise
  // generate one from the title and append a short suffix if it collides
  // inside the account.
  const { data: existing } = await supabase
    .from("org_products")
    .select("id, slug, published_at")
    .eq("connection_id", input.connectionId)
    .eq("external_product_id", input.externalProductId)
    .maybeSingle()

  const slug = existing?.slug ?? (await uniqueSlug(supabase, profile.account_id, synced.product.title))
  const publishedAt = existing?.published_at ?? new Date().toISOString()
  const now = new Date().toISOString()

  const productRow = {
    account_id: profile.account_id,
    connection_id: input.connectionId,
    external_product_id: input.externalProductId,
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
    return {
      ok: false,
      error: upsertErr?.message ?? "Could not write product row.",
    }
  }
  const productId = (upserted as { id: string }).id

  // Variants: mirror the partner's enabled set. Anything previously synced
  // but no longer present on the partner side is marked inactive (not
  // deleted, because past orders may reference it).
  const externalIds = synced.variants.map((v) => v.externalId)

  const variantRows = synced.variants.map((v, idx) => ({
    product_id: productId,
    sku: v.sku ?? `${input.externalProductId}-${v.externalId}`,
    external_variant_id: v.externalId,
    external_options: v.options,
    options: v.options, // legacy mirror — storefront buy panel reads this
    price_cents: v.retailPriceCents,
    partner_cost_cents: v.partnerCostCents ?? null,
    image_path: v.imageUrl ?? null,
    is_active: v.isActive,
    ordering: idx,
  }))

  const { error: variantErr } = await supabase
    .from("org_product_variants")
    .upsert(variantRows, { onConflict: "product_id,external_variant_id" })
  if (variantErr) {
    return { ok: false, error: variantErr.message }
  }

  // Deactivate variants that disappeared on the partner side.
  if (externalIds.length > 0) {
    await supabase
      .from("org_product_variants")
      .update({ is_active: false })
      .eq("product_id", productId)
      .not("external_variant_id", "in", `(${externalIds.map((id) => `"${id}"`).join(",")})`)
  }

  revalidatePath("/products")
  revalidatePath(`/products/browse/${input.connectionId}`)

  return { ok: true, productId }
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
