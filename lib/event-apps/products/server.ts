/**
 * Server-side hooks for the bundled-products event app:
 *   - validateRegistration: validates items + computes Stripe lines +
 *     returns a persist callback that inserts event_registration_items
 *   - onRegistrationConfirmed: thin wrapper around the existing
 *     dispatchRegistrationProducts helper
 *
 * Extracted from app/api/register/route.ts so the API route doesn't have
 * to know anything about products specifically — it just iterates
 * installed apps and calls their hooks.
 */

import "server-only"

import type {
  EventAppValidateContext,
  EventAppValidateResult,
  EventAppConfirmedContext,
} from "../types"
import { dispatchRegistrationProducts } from "@/lib/events/dispatch-registration-products"

interface IncomingItem {
  person_id: string
  event_product_id: string
  variant_id: string
  shipping_address?: Record<string, any>
}

interface ValidatedItem {
  person_id: string
  event_product_id: string
  variant_id: string
  unit_price_cents: number
  options: Record<string, string>
  product_name: string
  variant_sku: string
  image_url: string | null
  shipping_address: Record<string, any> | null
}

export async function validateRegistration(
  ctx: EventAppValidateContext,
): Promise<EventAppValidateResult> {
  const { admin, eventId, personIds, payload } = ctx
  const incomingItems: IncomingItem[] = Array.isArray(payload.items)
    ? payload.items
    : []

  // Load the event again here (cheap) so this hook doesn't depend on the
  // route passing every column through ctx. We only need product_delivery_mode.
  const { data: event, error: eventErr } = await admin
    .from("events")
    .select("product_delivery_mode")
    .eq("id", eventId)
    .single()
  if (eventErr || !event) {
    return { ok: false, error: "Event not found" }
  }

  const { data: eventProducts, error: epErr } = await admin
    .from("event_products")
    .select(
      "id, event_id, product_id, is_required, price_cents, org_products(id, name, image_path, org_product_variants(id, sku, options, price_cents, image_path, is_active))",
    )
    .eq("event_id", eventId)
  if (epErr) return { ok: false, error: epErr.message }

  const epIndex = new Map<string, any>(
    (eventProducts ?? []).map((ep: any) => [ep.id, ep]),
  )
  const requiredEpIds = (eventProducts ?? [])
    .filter((ep: any) => ep.is_required)
    .map((ep: any) => ep.id)

  // No event_products attached → no products validation needed.
  if (epIndex.size === 0 && incomingItems.length === 0) {
    return { ok: true }
  }

  const validatedItems: ValidatedItem[] = []
  let itemsTotalCents = 0
  const seen = new Set<string>()

  for (const it of incomingItems) {
    const ep = epIndex.get(it.event_product_id)
    if (!ep) return { ok: false, error: "Unknown product on this event" }
    if (!personIds.includes(it.person_id)) {
      return {
        ok: false,
        error: "Item references a registrant not in this signup",
      }
    }
    const variants = ep.org_products?.org_product_variants ?? []
    const variant = variants.find(
      (v: any) => v.id === it.variant_id && v.is_active,
    )
    if (!variant) {
      return { ok: false, error: "Picked variant isn't valid for that product" }
    }
    const key = `${it.person_id}:${it.event_product_id}`
    if (seen.has(key)) {
      return { ok: false, error: "Duplicate selection for a registrant" }
    }
    seen.add(key)

    validatedItems.push({
      person_id: it.person_id,
      event_product_id: it.event_product_id,
      variant_id: it.variant_id,
      unit_price_cents: Number(ep.price_cents) || 0,
      options: (variant.options ?? {}) as Record<string, string>,
      product_name: ep.org_products?.name ?? "",
      variant_sku: variant.sku ?? "",
      image_url: variant.image_path ?? ep.org_products?.image_path ?? null,
      shipping_address:
        event.product_delivery_mode === "shipped_to_registrant"
          ? it.shipping_address ?? null
          : null,
    })
    itemsTotalCents += Number(ep.price_cents) || 0
  }

  // Every required product needs a selection per registrant.
  for (const personId of personIds) {
    for (const epId of requiredEpIds) {
      if (!seen.has(`${personId}:${epId}`)) {
        return { ok: false, error: "Missing required product selection" }
      }
    }
  }

  // In shipped mode every registrant with items needs an address.
  if (
    event.product_delivery_mode === "shipped_to_registrant" &&
    validatedItems.length > 0
  ) {
    const haveAddress = new Set(
      validatedItems
        .filter((it) => it.shipping_address)
        .map((it) => it.person_id),
    )
    for (const personId of personIds) {
      if (!haveAddress.has(personId)) {
        return {
          ok: false,
          error: "Missing shipping address for a registrant",
        }
      }
    }
  }

  // Roll up Stripe lines by (event_product, unit_price).
  const linesByProduct = new Map<
    string,
    { name: string; unit_amount: number; quantity: number }
  >()
  for (const it of validatedItems) {
    if (it.unit_price_cents <= 0) continue
    const key = `${it.event_product_id}:${it.unit_price_cents}`
    const existing = linesByProduct.get(key)
    if (existing) {
      existing.quantity += 1
    } else {
      linesByProduct.set(key, {
        name: it.product_name || "Add-on",
        unit_amount: it.unit_price_cents,
        quantity: 1,
      })
    }
  }
  const stripeLineItems = Array.from(linesByProduct.values()).map((l) => ({
    price_data: {
      currency: "usd",
      product_data: { name: l.name },
      unit_amount: l.unit_amount,
    },
    quantity: l.quantity,
  }))

  return {
    ok: true,
    extraCents: itemsTotalCents,
    stripeLineItems,
    persist: async (registrationIdByPerson, adminClient) => {
      if (validatedItems.length === 0) return
      const registrationIds = Array.from(
        new Set(
          validatedItems
            .map((it) => registrationIdByPerson.get(it.person_id))
            .filter(Boolean),
        ),
      ) as string[]

      // Idempotency: wipe prior items for these registrations so a retry
      // doesn't pile up stale selections.
      if (registrationIds.length > 0) {
        await adminClient
          .from("event_registration_items")
          .delete()
          .in("registration_id", registrationIds)
      }

      const itemRows = validatedItems
        .map((it) => {
          const registrationId = registrationIdByPerson.get(it.person_id)
          if (!registrationId) return null
          return {
            registration_id: registrationId,
            event_product_id: it.event_product_id,
            variant_id: it.variant_id,
            unit_price_cents: it.unit_price_cents,
            options_snapshot: it.options,
            product_name_snapshot: it.product_name,
            variant_sku_snapshot: it.variant_sku,
            image_url_snapshot: it.image_url,
            shipping_address: it.shipping_address,
          }
        })
        .filter(Boolean)

      if (itemRows.length === 0) return
      const { error } = await adminClient
        .from("event_registration_items")
        .insert(itemRows as any)
      if (error) throw new Error(error.message)
    },
  }
}

export async function onRegistrationConfirmed(
  ctx: EventAppConfirmedContext,
): Promise<void> {
  await dispatchRegistrationProducts({
    eventId: ctx.eventId,
    registrationIds: ctx.registrationIds,
    stripePaymentIntentId: ctx.stripePaymentIntentId,
  })
}
