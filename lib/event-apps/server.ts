/**
 * Server-side event-app hooks registry.
 *
 * The main registry (`lib/event-apps/index.ts`) only carries client-safe
 * metadata + UI hooks so it can be freely imported from client components
 * (e.g. the event-edit page). Server-only behavior (validateRegistration,
 * onRegistrationConfirmed) lives here and gets attached to the in-memory
 * map at runtime.
 *
 * Callers (the register API, the Stripe webhook) use `getServerApp(slug)`
 * to look up an installed app's server hooks.
 */

import "server-only"

import {
  validateRegistration as productsValidate,
  onRegistrationConfirmed as productsConfirmed,
} from "./products/server"
import type {
  EventAppValidateContext,
  EventAppValidateResult,
  EventAppConfirmedContext,
} from "./types"

export interface EventAppServerHooks {
  validateRegistration?: (
    ctx: EventAppValidateContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<EventAppValidateResult>
  onRegistrationConfirmed?: (
    ctx: EventAppConfirmedContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<void>
}

const serverHooksBySlug = new Map<string, EventAppServerHooks>([
  [
    "products",
    {
      validateRegistration: (ctx) => productsValidate(ctx),
      onRegistrationConfirmed: (ctx) => productsConfirmed(ctx),
    },
  ],
])

export function getServerHooks(slug: string): EventAppServerHooks {
  return serverHooksBySlug.get(slug) ?? {}
}
