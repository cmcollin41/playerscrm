/**
 * Server-only hook map for integrations.
 *
 * The main registry (`./index.ts`) is client-safe — it only holds metadata +
 * UI hooks so it can be freely imported from client components. Server-only
 * behavior (validateRegistration, onRegistrationConfirmed) lives here and
 * gets looked up by slug at runtime.
 *
 * Callers (the register API, the Stripe webhook) use `getServerHooks(slug)`
 * to look up an integration's server hooks.
 */

import "server-only"

import {
  validateRegistration as bundledProductsValidate,
  onRegistrationConfirmed as bundledProductsConfirmed,
} from "./events/bundled-products/server"
import type {
  IntegrationValidateContext,
  IntegrationValidateResult,
  IntegrationConfirmedContext,
} from "./types"

export interface IntegrationServerHooks {
  validateRegistration?: (
    ctx: IntegrationValidateContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<IntegrationValidateResult>
  onRegistrationConfirmed?: (
    ctx: IntegrationConfirmedContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<void>
}

const serverHooksBySlug = new Map<string, IntegrationServerHooks>([
  [
    "products",
    {
      validateRegistration: (ctx) => bundledProductsValidate(ctx),
      onRegistrationConfirmed: (ctx) => bundledProductsConfirmed(ctx),
    },
  ],
])

export function getServerHooks(slug: string): IntegrationServerHooks {
  return serverHooksBySlug.get(slug) ?? {}
}
