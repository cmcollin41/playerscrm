"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { encryptCredentialsForBytea } from "@/lib/fulfillment/crypto"
import { getAdapter } from "@/lib/fulfillment/registry"

export interface ConnectResult {
  ok: boolean
  error?: string
}

/**
 * Connect a fulfillment partner: validate the pasted credentials with the
 * partner API, encrypt them, and persist a connection row.
 *
 * `accountId` is required because a user can be a member of multiple
 * accounts; the integrations page always passes the active account.
 */
export async function connectPartner(input: {
  accountId: string
  partnerId: string
  token: string
}): Promise<ConnectResult> {
  await requireAuth()
  const supabase = await createClient()

  const { data: partner, error: partnerErr } = await supabase
    .from("fulfillment_partners")
    .select("id, adapter_key, slug, name")
    .eq("id", input.partnerId)
    .maybeSingle()
  if (partnerErr) return { ok: false, error: partnerErr.message }
  if (!partner) return { ok: false, error: "Partner not found." }

  const adapter = getAdapter(partner.adapter_key)
  if (!adapter) {
    return {
      ok: false,
      error: `No adapter is registered for ${partner.name} yet.`,
    }
  }

  const trimmed = input.token.trim()
  if (!trimmed) return { ok: false, error: "Paste a token to continue." }

  const validation = await adapter.validateCredentials({ token: trimmed })
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error ?? "The partner rejected the credentials.",
    }
  }

  const ciphertext = encryptCredentialsForBytea({ token: trimmed })

  const { error: upsertErr } = await supabase
    .from("account_partner_connections")
    .upsert(
      {
        account_id: input.accountId,
        partner_id: partner.id,
        credentials_encrypted: ciphertext,
        external_shop_id: validation.externalShopId ?? null,
        external_account_label: validation.externalAccountLabel ?? null,
        auth_type: "personal_token",
        is_active: true,
      },
      { onConflict: "account_id,partner_id" },
    )
  if (upsertErr) return { ok: false, error: upsertErr.message }

  revalidatePath("/settings/integrations")
  return { ok: true }
}

export async function disconnectPartner(input: {
  connectionId: string
}): Promise<ConnectResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("account_partner_connections")
    .delete()
    .eq("id", input.connectionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings/integrations")
  return { ok: true }
}
