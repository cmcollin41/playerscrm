"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import type { OrgProductStatus } from "@/types/schema.types"

/**
 * Flip a product's status. Publishing requires at least one active variant;
 * the storefront 404s without one, so we reject up-front instead of letting
 * an org "publish" a product nobody can buy.
 *
 * published_at is preserved on republish so analytics keep a stable "first
 * published" timestamp even if the org toggles draft/active later.
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
  revalidatePath(`/products/${productId}`)
  return { ok: true }
}
