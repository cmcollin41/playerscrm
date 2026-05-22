"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { encryptCredentialsForBytea } from "@/lib/integrations/products/crypto"
import { getIntegration } from "@/lib/integrations"
import { getAuthSiteUrl } from "@/lib/auth-site"
import type {
  ConnectionContext,
  FulfillmentAdapter,
} from "@/lib/integrations/products/types"

function partnerWebhookUrl(connectionId: string): string {
  return `${getAuthSiteUrl()}/api/webhooks/partners/${connectionId}`
}

async function tryRegisterWebhooks(
  adapter: FulfillmentAdapter,
  ctx: ConnectionContext,
  webhookUrl: string,
  secret: string,
): Promise<void> {
  if (!adapter.registerWebhooks) return
  try {
    await adapter.registerWebhooks(ctx, { url: webhookUrl, secret })
  } catch (err) {
    console.error(
      "[connectIntegration] registerWebhooks failed",
      adapter.key,
      err instanceof Error ? err.message : err,
    )
  }
}

export interface ConnectResult {
  ok: boolean
  error?: string
}

/**
 * Toggle a code-only integration on or off for the account. For integrations
 * that require credentials, the enable toggle is implicit — Connect enables
 * and Disconnect disables — and this action is a no-op fast-path that just
 * updates the flag without touching credentials.
 */
export async function setIntegrationEnabled(input: {
  accountId: string
  slug: string
  enabled: boolean
}): Promise<ConnectResult> {
  await requireAuth()
  const supabase = await createClient()

  const integration = getIntegration(input.slug)
  if (integration.slug === "unknown") {
    return { ok: false, error: "Unknown integration." }
  }

  const { error } = await supabase
    .from("account_integrations")
    .upsert(
      {
        account_id: input.accountId,
        integration_slug: input.slug,
        is_enabled: input.enabled,
      },
      { onConflict: "account_id,integration_slug" },
    )
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings/integrations")
  return { ok: true }
}

/**
 * Connect a credentialed integration: validate the pasted token with the
 * partner API, encrypt it, and upsert the integration into BOTH backing
 * stores so the existing product-side code (org_products.connection_id FK,
 * webhook URL keying) keeps working unchanged:
 *
 *   - account_integrations is the unified settings-UI source of truth.
 *   - account_partner_connections retains the typed columns + UUID PK that
 *     the rest of the storefront / fulfillment pipeline still reads.
 *
 * A follow-up migration will collapse these into one row; today the bridge
 * keeps everything in sync without a risky one-shot rewrite.
 */
export async function connectIntegration(input: {
  accountId: string
  slug: string
  token: string
}): Promise<ConnectResult> {
  await requireAuth()
  const supabase = await createClient()

  const integration = getIntegration(input.slug)
  if (integration.slug === "unknown") {
    return { ok: false, error: "Unknown integration." }
  }
  if (!integration.adapter) {
    return {
      ok: false,
      error: `No adapter is registered for ${integration.name} yet.`,
    }
  }

  const trimmed = input.token.trim()
  if (!trimmed) return { ok: false, error: "Paste a token to continue." }

  const validation = await integration.adapter.validateCredentials({
    token: trimmed,
  })
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error ?? "The partner rejected the credentials.",
    }
  }

  // Generate the webhook secret up front so the same value lands in the
  // encrypted credentials blob AND the partner's webhook registration.
  // verifyWebhook later HMACs inbound deliveries against this secret.
  const webhookSecret = randomBytes(32).toString("hex")

  const credentialsPayload = {
    token: trimmed,
    webhook_secret: webhookSecret,
  }
  const ciphertext = encryptCredentialsForBytea(credentialsPayload)

  const connectionState: Record<string, unknown> = { auth_type: "personal_token" }
  if (validation.externalShopId) connectionState.external_shop_id = validation.externalShopId
  if (validation.externalAccountLabel)
    connectionState.external_account_label = validation.externalAccountLabel

  const { error: integrationErr } = await supabase
    .from("account_integrations")
    .upsert(
      {
        account_id: input.accountId,
        integration_slug: input.slug,
        is_enabled: true,
        credentials_encrypted: ciphertext,
        connection_state: connectionState,
      },
      { onConflict: "account_id,integration_slug" },
    )
  if (integrationErr) return { ok: false, error: integrationErr.message }

  // Bridge write: keep account_partner_connections in sync so the storefront,
  // dispatch pipeline, and partner webhooks (which key on the UUID id and
  // FK target) keep resolving this connection.
  const { data: partner, error: partnerErr } = await supabase
    .from("fulfillment_partners")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle()
  if (partnerErr) return { ok: false, error: partnerErr.message }
  let connectionId: string | null = null
  if (partner?.id) {
    const { data: upserted, error: partnerUpsertErr } = await supabase
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
      .select("id")
      .maybeSingle()
    if (partnerUpsertErr) return { ok: false, error: partnerUpsertErr.message }
    connectionId = (upserted as { id: string } | null)?.id ?? null
  }

  // Best-effort: register inbound webhooks with the partner so events flow
  // back to our /api/webhooks endpoint. Skipped if no adapter, no connection
  // id, or no shop id; logged-and-swallowed on partner errors so the user
  // still sees the connection succeed.
  if (connectionId && integration.adapter && validation.externalShopId) {
    const ctx: ConnectionContext = {
      connectionId,
      accountId: input.accountId,
      partnerSlug: input.slug,
      externalShopId: validation.externalShopId,
      credentials: credentialsPayload,
    }
    await tryRegisterWebhooks(
      integration.adapter,
      ctx,
      partnerWebhookUrl(connectionId),
      webhookSecret,
    )
  }

  revalidatePath("/settings/integrations")
  return { ok: true }
}

/**
 * Disconnect a credentialed integration. Deletes from BOTH backing stores
 * so the unified settings UI and the existing fulfillment pipeline agree
 * on the disconnected state.
 */
export async function disconnectIntegration(input: {
  accountId: string
  slug: string
}): Promise<ConnectResult> {
  await requireAuth()
  const supabase = await createClient()

  const { error } = await supabase
    .from("account_integrations")
    .delete()
    .eq("account_id", input.accountId)
    .eq("integration_slug", input.slug)
  if (error) return { ok: false, error: error.message }

  // Bridge delete: mirror in account_partner_connections.
  const { data: partner } = await supabase
    .from("fulfillment_partners")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle()
  if (partner?.id) {
    const { error: partnerDeleteErr } = await supabase
      .from("account_partner_connections")
      .delete()
      .eq("account_id", input.accountId)
      .eq("partner_id", partner.id)
    if (partnerDeleteErr)
      return { ok: false, error: partnerDeleteErr.message }
  }

  revalidatePath("/settings/integrations")
  return { ok: true }
}
