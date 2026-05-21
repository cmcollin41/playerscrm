/**
 * Central integrations registry. Replaces the split between
 * `lib/event-apps/` and `lib/fulfillment/`.
 *
 * Each entry is a code-side `Integration` value that declares:
 *  - what kind of thing it is (`category`: events | products)
 *  - where it surfaces in the UI (`placement`: event_type_picker | event_edit_card | product_source)
 *  - whether the account needs to provide credentials to use it
 *  - per-category hooks (event form fields/capabilities, product adapter, etc.)
 *
 * Account-level enable + credentials live in the `account_integrations` table;
 * per-event installs live in `event_integrations`. See ./install.ts.
 */

import { campIntegration } from "./events/camp"
import { gameIntegration } from "./events/game"
import { practiceIntegration } from "./events/practice"
import { tournamentIntegration } from "./events/tournament"
import { otherIntegration } from "./events/other"
import { bundledProductsIntegration } from "./events/bundled-products"
import { printifyIntegration } from "./products/printify"
import type { Integration, IntegrationCategory, IntegrationPlacement } from "./types"

export type {
  Integration,
  IntegrationCategory,
  IntegrationPlacement,
  EventCapabilities,
  EventDefaults,
  IntegrationFormContext,
  IntegrationValidateContext,
  IntegrationValidateResult,
  IntegrationConfirmedContext,
} from "./types"

export const integrations: Integration[] = [
  campIntegration,
  gameIntegration,
  practiceIntegration,
  tournamentIntegration,
  otherIntegration,
  bundledProductsIntegration,
  printifyIntegration,
]

// Fallback so unknown slugs (legacy data, in-flight integrations) never crash
// a render. Inherits the "other" defaults — it looks like a vanilla event.
const FALLBACK_INTEGRATION: Integration = {
  slug: "unknown",
  name: "Integration",
  description: "",
  category: "events",
  placement: "event_type_picker",
  hidden: true,
  capabilities: {},
  defaults: otherIntegration.defaults,
}

const bySlug = new Map(integrations.map((i) => [i.slug, i]))

export function getIntegration(slug: string | null | undefined): Integration {
  if (!slug) return FALLBACK_INTEGRATION
  return bySlug.get(slug) ?? { ...FALLBACK_INTEGRATION, slug, name: slug }
}

export function listIntegrations(filter?: {
  category?: IntegrationCategory
  placement?: IntegrationPlacement
  includeHidden?: boolean
}): Integration[] {
  return integrations.filter((i) => {
    if (!filter?.includeHidden && i.hidden) return false
    if (filter?.category && i.category !== filter.category) return false
    if (filter?.placement && i.placement !== filter.placement) return false
    return true
  })
}
