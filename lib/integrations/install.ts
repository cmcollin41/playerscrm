/**
 * DB-bridge helpers for the integrations system.
 *
 *  - account_integrations rows answer "is this integration turned on for this
 *    account, and what credentials/state does it have?"
 *  - event_integrations rows answer "which integrations are installed on this
 *    particular event?"
 *
 * Callers pass a Supabase client because callsites mix server components
 * (RLS client), route handlers (admin client), and browser RLS clients.
 */

import { getIntegration, listIntegrations } from "./index"
import type { Integration, IntegrationPlacement } from "./types"

export interface AccountIntegrationRow {
  integration_slug: string
  is_enabled: boolean
  connection_state: Record<string, unknown>
}

export interface EnabledIntegration {
  integration: Integration
  connectionState: Record<string, unknown>
}

export interface InstalledIntegration {
  installedId: string
  integration: Integration
  config: Record<string, unknown>
  ordering: number
}

/**
 * Account-level: which integrations has this account enabled, and what
 * sidecar connection state (external_shop_id, etc.) goes with each.
 *
 * Filter by `placement` (e.g. only event_type_picker integrations for the
 * new-event picker). Disabled rows are filtered out unless includeDisabled.
 */
export async function listEnabledIntegrations(
  accountId: string,
  supabase: any,
  filter?: {
    placement?: IntegrationPlacement
    includeDisabled?: boolean
  },
): Promise<EnabledIntegration[]> {
  const { data, error } = await supabase
    .from("account_integrations")
    .select("integration_slug, is_enabled, connection_state")
    .eq("account_id", accountId)

  if (error) {
    console.error(
      "[integrations] listEnabledIntegrations failed",
      error.message,
    )
    return []
  }

  const rows = (data ?? []) as AccountIntegrationRow[]
  const result: EnabledIntegration[] = []

  for (const row of rows) {
    if (!filter?.includeDisabled && !row.is_enabled) continue
    const integration = getIntegration(row.integration_slug)
    if (integration.slug === "unknown") continue
    if (filter?.placement && integration.placement !== filter.placement) continue
    result.push({
      integration,
      connectionState: (row.connection_state ?? {}) as Record<string, unknown>,
    })
  }

  // Preserve registry order for a stable UI listing.
  const indexBySlug = new Map(
    listIntegrations({ includeHidden: true }).map((i, idx) => [i.slug, idx]),
  )
  result.sort(
    (a, b) =>
      (indexBySlug.get(a.integration.slug) ?? 999) -
      (indexBySlug.get(b.integration.slug) ?? 999),
  )
  return result
}

export async function isIntegrationEnabled(
  accountId: string,
  slug: string,
  supabase: any,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("account_integrations")
    .select("is_enabled")
    .eq("account_id", accountId)
    .eq("integration_slug", slug)
    .maybeSingle()
  if (error || !data) return false
  return !!data.is_enabled
}

export async function setIntegrationEnabled(
  accountId: string,
  slug: string,
  enabled: boolean,
  supabase: any,
): Promise<void> {
  const { error } = await supabase
    .from("account_integrations")
    .upsert(
      { account_id: accountId, integration_slug: slug, is_enabled: enabled },
      { onConflict: "account_id,integration_slug" },
    )
  if (error) {
    console.error(
      "[integrations] setIntegrationEnabled failed",
      { accountId, slug, enabled, message: error.message },
    )
    throw new Error(error.message)
  }
}

/**
 * Per-event: which integrations are installed on this event. Used by the
 * event detail / edit / register flows to decide which form sections,
 * admin cards, and registration steps to render.
 */
export async function getEventIntegrations(
  eventId: string,
  supabase: any,
): Promise<InstalledIntegration[]> {
  const { data, error } = await supabase
    .from("event_integrations")
    .select("id, integration_slug, config, ordering")
    .eq("event_id", eventId)
    .order("ordering", { ascending: true })

  if (error) {
    console.error(
      "[integrations] getEventIntegrations failed",
      error.message,
    )
    return []
  }
  return (data ?? []).map((row: any) => ({
    installedId: row.id as string,
    integration: getIntegration(row.integration_slug),
    config: (row.config ?? {}) as Record<string, unknown>,
    ordering: row.ordering ?? 0,
  }))
}

/** Idempotent upsert — safe to call from a manager UI that doesn't know whether the integration is already installed on the event. */
export async function installIntegration(
  eventId: string,
  slug: string,
  supabase: any,
  config: Record<string, unknown> = {},
  ordering?: number,
): Promise<void> {
  const payload: Record<string, unknown> = {
    event_id: eventId,
    integration_slug: slug,
    config,
  }
  if (ordering !== undefined) payload.ordering = ordering

  const { error } = await supabase
    .from("event_integrations")
    .upsert(payload, { onConflict: "event_id,integration_slug" })
  if (error) {
    console.error(
      "[integrations] installIntegration failed",
      { eventId, slug, message: error.message },
    )
    throw new Error(error.message)
  }
}

export async function uninstallIntegration(
  eventId: string,
  slug: string,
  supabase: any,
): Promise<void> {
  const { error } = await supabase
    .from("event_integrations")
    .delete()
    .eq("event_id", eventId)
    .eq("integration_slug", slug)
  if (error) {
    console.error(
      "[integrations] uninstallIntegration failed",
      { eventId, slug, message: error.message },
    )
    throw new Error(error.message)
  }
}
