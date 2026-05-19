/**
 * Printify adapter. Slice 2 implements only `validateCredentials` so the
 * /settings/integrations connect flow can verify a pasted personal token
 * and pull the shop ID + name. Slices 3, 4, 5 fill in the rest.
 *
 * Docs: https://developers.printify.com/
 * Auth: Bearer personal access token from https://printify.com/app/account/api
 */

import type {
  FulfillmentAdapter,
  ValidationResult,
  ConnectionCredentials,
} from "../../types"

const PRINTIFY_BASE = "https://api.printify.com/v1"

interface PrintifyShop {
  id: number
  title: string
  sales_channel?: string
}

async function listShops(token: string): Promise<PrintifyShop[]> {
  const res = await fetch(`${PRINTIFY_BASE}/shops.json`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "athletes.app/store-model-b",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Printify /shops responded ${res.status}: ${body.slice(0, 200)}`,
    )
  }
  return (await res.json()) as PrintifyShop[]
}

async function validateCredentials(
  credentials: ConnectionCredentials,
): Promise<ValidationResult> {
  if (!credentials.token || typeof credentials.token !== "string") {
    return { valid: false, error: "Personal access token is required." }
  }
  try {
    const shops = await listShops(credentials.token)
    if (shops.length === 0) {
      return {
        valid: false,
        error:
          "Token is valid but no Printify shops are linked to this account. Create one at https://printify.com/app/store-manager and try again.",
      }
    }
    const shop = shops[0]
    return {
      valid: true,
      externalShopId: String(shop.id),
      externalAccountLabel: shop.title,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { valid: false, error: msg }
  }
}

export const printifyAdapter: FulfillmentAdapter = {
  key: "printify",
  validateCredentials,
  // listSyncProducts, syncProduct, calculateShipping, createOrder,
  // verifyWebhook, handleWebhook — added in Slices 3 / 4 / 5.
}
