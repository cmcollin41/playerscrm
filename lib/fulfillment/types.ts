/**
 * Fulfillment adapter framework — Model B.
 *
 * Each fulfillment partner (Printify, Printful, Truwear, ...) implements the
 * `FulfillmentAdapter` interface. The shared shape was validated against
 * Printify + Printful API docs:
 *   /plans/ok-now-that-we-validated-goblet.md → "Shared API patterns"
 *
 * Per-account credentials live in account_partner_connections, encrypted at
 * rest with AES-256-GCM (lib/fulfillment/crypto.ts). Decrypted credentials
 * are passed to adapter methods inside `ConnectionContext`.
 */

export type DispatchStatus =
  | "queued"
  | "sent"
  | "accepted"
  | "fulfilled"
  | "cancelled"
  | "failed"

export type SyncStatus = "synced" | "stale" | "error" | "deleted"

/**
 * Decrypted credential payload stored inside a connection. Schemaless because
 * partners differ — Printify just needs `token`; Printful may add OAuth
 * refresh fields; webhook secret is per-shop.
 */
export interface ConnectionCredentials {
  token: string
  refresh_token?: string
  expires_at?: string
  webhook_secret?: string
  // Per-adapter extras allowed.
  [key: string]: unknown
}

/** What an adapter method receives for a connected partner. */
export interface ConnectionContext {
  connectionId: string
  accountId: string
  partnerSlug: string // 'printify' | 'printful' | 'manual' | ...
  externalShopId: string | null
  credentials: ConnectionCredentials
}

/**
 * Result of validating a freshly pasted token. Returned by `validateCredentials`
 * during the connect flow; the page persists external_shop_id + label on the
 * connection row.
 */
export interface ValidationResult {
  valid: boolean
  externalShopId?: string
  externalAccountLabel?: string
  error?: string
}

/** Normalized partner product, for the publish picker (Slice 3). */
export interface PartnerSyncProduct {
  externalId: string
  title: string
  description?: string | null
  thumbnailUrl?: string | null
  variantCount: number
  status?: "active" | "inactive" | "draft"
}

/** Normalized partner variant, used at sync time (Slice 3). */
export interface PartnerSyncVariant {
  externalId: string
  sku?: string | null
  title?: string | null
  options: Record<string, string> // {size: "M", color: "Red"}
  retailPriceCents: number
  partnerCostCents?: number | null
  imageUrl?: string | null
  isActive: boolean
}

/** Shipping address (matches the buyer address we'll snapshot on store_orders). */
export interface ShippingAddress {
  name: string
  address1: string
  address2?: string
  city: string
  region?: string // state/province
  postalCode: string
  country: string // ISO 2-letter
  phone?: string
  email?: string
}

/** Cart line for shipping calc / order push (Slices 4–5). */
export interface FulfillmentLine {
  externalVariantId: string
  quantity: number
}

export interface ShippingQuote {
  shippingCents: number
  breakdown?: unknown
}

export interface CreateOrderInput {
  externalOrderRef: string // store_orders.id, for partner-side traceability
  lines: FulfillmentLine[]
  address: ShippingAddress
  shippingCents: number // already collected from buyer
}

export interface CreateOrderResult {
  externalOrderId: string
  externalOrderUrl?: string
}

export interface WebhookEvent {
  externalOrderId: string
  status: DispatchStatus
  tracking?: {
    number?: string
    url?: string
    carrier?: string
  }
}

/**
 * The contract every partner adapter implements. Optional methods are
 * sliced in over time — Slice 2 ships only `validateCredentials`.
 */
export interface FulfillmentAdapter {
  key: string

  /** Called by the connect modal to verify a pasted token and pull shop info. */
  validateCredentials(
    credentials: ConnectionCredentials,
  ): Promise<ValidationResult>

  /** Slice 3: list the merchant's customized products on the partner side. */
  listSyncProducts?(ctx: ConnectionContext): Promise<PartnerSyncProduct[]>

  /** Slice 3: pull full detail (variants, images) for one product. */
  syncProduct?(
    ctx: ConnectionContext,
    externalProductId: string,
  ): Promise<{
    product: PartnerSyncProduct
    variants: PartnerSyncVariant[]
    images: string[]
  }>

  /** Slice 4: live shipping quote for cart + destination. */
  calculateShipping?(
    ctx: ConnectionContext,
    lines: FulfillmentLine[],
    address: ShippingAddress,
  ): Promise<ShippingQuote>

  /** Slice 5: push a confirmed order to the partner after payment lands. */
  createOrder?(
    ctx: ConnectionContext,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult>

  /** Slice 5: HMAC verification on inbound partner webhooks. */
  verifyWebhook?(
    req: Request,
    ctx: ConnectionContext,
  ): Promise<boolean>

  /** Slice 5: normalize a partner webhook payload to our internal shape. */
  handleWebhook?(
    body: unknown,
    ctx: ConnectionContext,
  ): Promise<WebhookEvent | null>
}
