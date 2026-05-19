/**
 * Adapter registry — every supported fulfillment partner registers itself
 * here under its `adapter_key`. The dashboard, checkout, and webhook routes
 * look adapters up by the `fulfillment_partners.adapter_key` column.
 *
 * Slice 2: only Printify is wired up (validateCredentials only).
 * Slice 3: Printify gains listSyncProducts + syncProduct.
 * Slice 5: Printify gains createOrder + webhook handling.
 * Slice 6: manual adapter.
 * Slice 7: Printful.
 */

import type { FulfillmentAdapter } from "./types"
import { printifyAdapter } from "./adapters/printify"

const adapters: Record<string, FulfillmentAdapter> = {
  [printifyAdapter.key]: printifyAdapter,
}

export function getAdapter(adapterKey: string): FulfillmentAdapter | null {
  return adapters[adapterKey] ?? null
}

export function listSupportedAdapterKeys(): string[] {
  return Object.keys(adapters)
}
