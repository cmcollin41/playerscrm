/**
 * Printify adapter.
 *
 * Slice 2: validateCredentials (connect flow).
 * Slice 3: listSyncProducts + syncProduct (catalog browse + publish).
 * Slices 4, 5: calculateShipping, createOrder, webhooks.
 *
 * Docs: https://developers.printify.com/
 * Auth: Bearer personal access token from https://printify.com/app/account/api
 * Rate limit: ~600 req / 30min per shop.
 */

import type {
  ConnectionContext,
  ConnectionCredentials,
  FulfillmentAdapter,
  PartnerSyncProduct,
  PartnerSyncVariant,
  ValidationResult,
} from "../../types"

const PRINTIFY_BASE = "https://api.printify.com/v1"
const UA = "athletes.app/store-model-b"

interface PrintifyShop {
  id: number
  title: string
  sales_channel?: string
}

interface PrintifyOptionValue {
  id: number
  title: string
  colors?: string[]
}

interface PrintifyOption {
  name: string
  type?: string
  values: PrintifyOptionValue[]
}

interface PrintifyVariant {
  id: number
  sku?: string | null
  cost: number // cents
  price: number // cents
  title?: string
  options: number[] // value ids
  is_enabled: boolean
  is_default?: boolean
  is_available?: boolean
}

interface PrintifyImage {
  src: string
  variant_ids: number[]
  position?: string
  is_default?: boolean
}

interface PrintifyProductListItem {
  id: string | number
  title: string
  description?: string
  visible?: boolean
  variants?: PrintifyVariant[]
  images?: PrintifyImage[]
}

interface PrintifyProductDetail extends PrintifyProductListItem {
  options: PrintifyOption[]
  variants: PrintifyVariant[]
  images: PrintifyImage[]
}

interface PrintifyListResponse<T> {
  current_page: number
  last_page: number
  total: number
  data: T[]
}

async function printifyFetch<T>(
  token: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Printify ${path} responded ${res.status}: ${body.slice(0, 200)}`,
    )
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Slice 2: validateCredentials
// ---------------------------------------------------------------------------

async function validateCredentials(
  credentials: ConnectionCredentials,
): Promise<ValidationResult> {
  if (!credentials.token || typeof credentials.token !== "string") {
    return { valid: false, error: "Personal access token is required." }
  }
  try {
    const shops = await printifyFetch<PrintifyShop[]>(
      credentials.token,
      "/shops.json",
    )
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

// ---------------------------------------------------------------------------
// Slice 3: listSyncProducts + syncProduct
// ---------------------------------------------------------------------------

function requireShopId(ctx: ConnectionContext): string {
  if (!ctx.externalShopId) {
    throw new Error(
      "Printify connection is missing external_shop_id. Reconnect the integration to pull the shop ID.",
    )
  }
  return ctx.externalShopId
}

function pickThumbnail(images: PrintifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null
  const def = images.find((i) => i.is_default)
  return def?.src ?? images[0].src
}

async function listSyncProducts(
  ctx: ConnectionContext,
): Promise<PartnerSyncProduct[]> {
  const shopId = requireShopId(ctx)
  // MVP: fetch page 1 only (limit=50, Printify's max). Larger shops can
  // paginate later.
  const res = await printifyFetch<PrintifyListResponse<PrintifyProductListItem>>(
    ctx.credentials.token,
    `/shops/${shopId}/products.json?limit=50`,
  )
  return res.data.map((p) => ({
    externalId: String(p.id),
    title: p.title,
    description: p.description ?? null,
    thumbnailUrl: pickThumbnail(p.images),
    variantCount: (p.variants ?? []).filter((v) => v.is_enabled).length,
    status: p.visible === false ? "inactive" : "active",
  }))
}

/**
 * Build a {OptionName: ValueTitle} map for a variant.
 *
 * Printify's variant.options is an array of option *value* IDs; the human
 * labels live in product.options[].values[]. We resolve here so the rest of
 * Athletes.app sees a tidy {"Size":"M","Color":"Red"} shape.
 */
function resolveVariantOptions(
  product: PrintifyProductDetail,
  variant: PrintifyVariant,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < product.options.length; i++) {
    const opt = product.options[i]
    const valueId = variant.options[i]
    if (valueId == null) continue
    const value = opt.values.find((v) => v.id === valueId)
    if (!value) continue
    // Normalize Size / Color naming so the storefront swatch logic
    // (which special-cases "Color") still works without partner-specific code.
    const name = normalizeOptionName(opt.name)
    out[name] = value.title
  }
  return out
}

function normalizeOptionName(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower === "colors" || lower === "color") return "Color"
  if (lower === "sizes" || lower === "size") return "Size"
  if (lower.length === 0) return raw
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function variantImageUrl(
  product: PrintifyProductDetail,
  variantId: number,
): string | null {
  for (const img of product.images) {
    if (img.variant_ids.includes(variantId)) return img.src
  }
  return null
}

async function syncProduct(
  ctx: ConnectionContext,
  externalProductId: string,
): Promise<{
  product: PartnerSyncProduct
  variants: PartnerSyncVariant[]
  images: string[]
}> {
  const shopId = requireShopId(ctx)
  const detail = await printifyFetch<PrintifyProductDetail>(
    ctx.credentials.token,
    `/shops/${shopId}/products/${externalProductId}.json`,
  )

  const enabled = detail.variants.filter((v) => v.is_enabled)
  const images = (detail.images ?? []).map((i) => i.src)
  const thumbnail = pickThumbnail(detail.images)

  const variants: PartnerSyncVariant[] = enabled.map((v) => ({
    externalId: String(v.id),
    sku: v.sku ?? null,
    title: v.title ?? null,
    options: resolveVariantOptions(detail, v),
    retailPriceCents: v.price,
    partnerCostCents: v.cost,
    imageUrl: variantImageUrl(detail, v.id) ?? thumbnail,
    isActive: v.is_available !== false,
  }))

  const product: PartnerSyncProduct = {
    externalId: String(detail.id),
    title: detail.title,
    description: detail.description ?? null,
    thumbnailUrl: thumbnail,
    variantCount: variants.length,
    status: detail.visible === false ? "inactive" : "active",
  }

  return { product, variants, images }
}

export const printifyAdapter: FulfillmentAdapter = {
  key: "printify",
  validateCredentials,
  listSyncProducts,
  syncProduct,
}
