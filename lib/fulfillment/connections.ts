/**
 * Helpers for loading a per-account partner connection with decrypted
 * credentials. Server-side only — decryption requires PLATFORM_ENCRYPTION_KEY
 * and the credentials must never leave the server.
 */

import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { decryptCredentials } from "./crypto"
import { getAdapter } from "./registry"
import type { ConnectionContext, FulfillmentAdapter } from "./types"

/**
 * Postgres `bytea` round-trips as either a Buffer/Uint8Array (newer
 * supabase-js) or a hex/base64 string (older PostgREST). Normalize either
 * shape into a Buffer the crypto helper can read.
 */
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input
  if (input instanceof Uint8Array) return Buffer.from(input)
  if (typeof input === "string") {
    if (input.startsWith("\\x")) {
      return Buffer.from(input.slice(2), "hex")
    }
    return Buffer.from(input, "base64")
  }
  throw new Error(
    `Unexpected credentials_encrypted shape: ${typeof input}. Expected bytea.`,
  )
}

export interface LoadedConnection {
  ctx: ConnectionContext
  adapter: FulfillmentAdapter
  partnerSlug: string
  externalAccountLabel: string | null
}

/**
 * Load a connection by id, scoped to `accountId`. RLS will reject reads from
 * accounts the caller isn't a member of, but we double-bind in the query for
 * defense-in-depth (a leaked connection_id should not let an attacker hit a
 * partner API on someone else's behalf).
 *
 * Pass an explicit `supabase` client (e.g. the service-role admin client) when
 * called from public-facing routes like guest checkout / shipping-quote where
 * the buyer is not authenticated and RLS would block the read. The route is
 * responsible for verifying the caller is allowed to act for `accountId`
 * (the tenant subdomain in our case).
 */
export async function loadConnection(
  connectionId: string,
  accountId: string,
  supabaseOverride?: SupabaseClient,
): Promise<LoadedConnection> {
  const supabase = supabaseOverride ?? (await createClient())
  const { data, error } = await supabase
    .from("account_partner_connections")
    .select(
      "id, account_id, credentials_encrypted, external_shop_id, external_account_label, is_active, fulfillment_partners(slug, adapter_key)",
    )
    .eq("id", connectionId)
    .eq("account_id", accountId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("Connection not found.")
  if (!data.is_active) throw new Error("Connection is disabled.")

  // Supabase serializes nested joins as arrays even for single-FK reads.
  const partnerRaw = (data as any).fulfillment_partners
  const partner = (Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw) as
    | { slug: string; adapter_key: string }
    | null
    | undefined
  if (!partner) throw new Error("Partner is missing from registry.")

  const adapter = getAdapter(partner.adapter_key)
  if (!adapter) {
    throw new Error(`No adapter is registered for "${partner.adapter_key}".`)
  }

  const credentials = decryptCredentials(
    toBuffer((data as any).credentials_encrypted),
  )

  return {
    adapter,
    partnerSlug: partner.slug,
    externalAccountLabel:
      (data as any).external_account_label ?? null,
    ctx: {
      connectionId: (data as any).id,
      accountId: (data as any).account_id,
      partnerSlug: partner.slug,
      externalShopId: (data as any).external_shop_id ?? null,
      credentials,
    },
  }
}
