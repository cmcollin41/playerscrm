/**
 * Printify integration — Model B fulfillment partner.
 *
 * The adapter (HTTP calls, webhook verification, etc.) lives at
 * ./adapters/printify and is attached here so the unified integrations
 * registry has one entry per partner. Account-level credentials live on
 * account_integrations.credentials_encrypted, keyed by (account_id, slug).
 */
import { printifyAdapter } from "./adapters/printify"
import type { Integration } from "../types"

export const printifyIntegration: Integration = {
  slug: "printify",
  name: "Printify",
  description:
    "Print-on-demand catalog. Create products in Printify, then publish them to your storefront.",
  category: "products",
  placement: "product_source",
  requiresCredentials: true,
  capabilities: {},
  adapterKey: printifyAdapter.key,
  adapter: printifyAdapter,
}
