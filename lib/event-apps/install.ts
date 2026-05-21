/**
 * Installed-apps helpers. Bridges the database row in
 * `event_apps_installed` to the code-side registry in `lib/event-apps/`.
 *
 * Callers pass a Supabase client because some callsites are server
 * components, some are route handlers using the admin client, some are
 * browser RLS clients.
 */

import { getEventApp } from "./index"
import type { EventApp } from "./types"

export interface InstalledApp {
  installedId: string
  app: EventApp
  config: Record<string, unknown>
  ordering: number
}

export async function getInstalledApps(
  eventId: string,
  supabase: any,
): Promise<InstalledApp[]> {
  const { data, error } = await supabase
    .from("event_apps_installed")
    .select("id, app_slug, config, ordering")
    .eq("event_id", eventId)
    .order("ordering", { ascending: true })

  if (error) {
    console.error("[event-apps] getInstalledApps failed", error.message)
    return []
  }
  return (data ?? []).map((row: any) => ({
    installedId: row.id as string,
    app: getEventApp(row.app_slug),
    config: (row.config ?? {}) as Record<string, unknown>,
    ordering: row.ordering ?? 0,
  }))
}

/**
 * Idempotent upsert. Safe to call from a manager UI that doesn't know
 * whether the app is already installed.
 */
export async function installApp(
  eventId: string,
  appSlug: string,
  supabase: any,
  config: Record<string, unknown> = {},
  ordering?: number,
): Promise<void> {
  const payload: Record<string, unknown> = {
    event_id: eventId,
    app_slug: appSlug,
    config,
  }
  if (ordering !== undefined) payload.ordering = ordering

  const { error } = await supabase
    .from("event_apps_installed")
    .upsert(payload, { onConflict: "event_id,app_slug" })
  if (error) {
    console.error(
      "[event-apps] installApp failed",
      { eventId, appSlug, message: error.message },
    )
    throw new Error(error.message)
  }
}

export async function uninstallApp(
  eventId: string,
  appSlug: string,
  supabase: any,
): Promise<void> {
  const { error } = await supabase
    .from("event_apps_installed")
    .delete()
    .eq("event_id", eventId)
    .eq("app_slug", appSlug)
  if (error) {
    console.error(
      "[event-apps] uninstallApp failed",
      { eventId, appSlug, message: error.message },
    )
    throw new Error(error.message)
  }
}

/**
 * Defensive fallback used when an event somehow has no install rows yet
 * (e.g. created before the migration). Maps the legacy `event_type`
 * column to its equivalent app slug. The backfill migration makes this
 * dead code for existing data; left in for safety.
 */
export function legacyAppFromEventType(eventType: string | null | undefined): EventApp {
  return getEventApp(eventType)
}
