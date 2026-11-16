"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Plus, X } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  VariantPicker,
  resolveVariant,
  type VariantForPicker,
} from "@/components/store/variant-picker"
import { centsToDecimalString } from "@/lib/money"

type DeliveryMode = "pickup_at_event" | "shipped_to_registrant"

interface RawVariant {
  id: string
  sku: string
  options: Record<string, string> | null
  price_cents: number
  image_path: string | null
  inventory_qty: number | null
  is_active: boolean
}

export interface EventProductForRegister {
  id: string // event_products.id
  product_id: string
  is_required: boolean
  price_cents: number
  description_override: string | null
  ordering: number
  org_products: {
    id: string
    name: string
    image_path: string | null
    slug: string
    org_product_variants: RawVariant[]
  } | null
}

export interface Registrant {
  id: string
  first_name: string | null
  last_name: string | null
  dependent: boolean
}

export interface ShippingAddress {
  name: string
  address1: string
  address2?: string
  city: string
  region: string
  postalCode: string
  country: string
  phone?: string
  email?: string
}

export interface SelectionEntry {
  variantId: string
  unitPriceCents: number
  options: Record<string, string>
  productName: string
  variantSku: string
  imageUrl: string | null
}

export interface SelectionsByPerson {
  // key: `${personId}:${eventProductId}` → entry. Absence = not selected.
  [key: string]: SelectionEntry
}

export interface AddressesByPerson {
  [personId: string]: ShippingAddress
}

interface ProductSelectionStepProps {
  registrants: Registrant[]
  eventProducts: EventProductForRegister[]
  deliveryMode: DeliveryMode
  selections: SelectionsByPerson
  onSelectionsChange: (next: SelectionsByPerson) => void
  addresses: AddressesByPerson
  onAddressesChange: (next: AddressesByPerson) => void
}

function selectionKey(personId: string, eventProductId: string) {
  return `${personId}:${eventProductId}`
}

function emptyAddress(): ShippingAddress {
  return {
    name: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
  }
}

function deriveOptionAxes(variants: VariantForPicker[]) {
  const axisOrder: string[] = []
  const axisValues: Record<string, string[]> = {}
  for (const v of variants) {
    for (const [k, val] of Object.entries(v.options ?? {})) {
      if (!axisValues[k]) {
        axisValues[k] = []
        axisOrder.push(k)
      }
      if (!axisValues[k].includes(val)) axisValues[k].push(val)
    }
  }
  return axisOrder.map((name) => ({ name, values: axisValues[name] }))
}

function toPickerVariants(raw: RawVariant[]): VariantForPicker[] {
  return raw
    .filter((v) => v.is_active)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      options: v.options ?? {},
      price_cents: v.price_cents,
      image_url: v.image_path,
      inventory_qty: v.inventory_qty,
    }))
}

function ProductRow({
  personId,
  ep,
  variants,
  isAttached,
  selectionEntry,
  onPick,
  onRemove,
}: {
  personId: string
  ep: EventProductForRegister
  variants: VariantForPicker[]
  isAttached: boolean
  selectionEntry: SelectionEntry | undefined
  onPick: (next: Record<string, string>, resolvedVariant: VariantForPicker) => void
  onRemove: () => void
}) {
  const options = useMemo(() => deriveOptionAxes(variants), [variants])
  const initialSelection = selectionEntry?.options ?? {}
  const [selection, setSelection] = useState<Record<string, string>>(
    initialSelection,
  )
  const resolved = resolveVariant(variants, selection)
  const productName = ep.org_products?.name ?? "Product"
  const image = ep.org_products?.image_path

  function applySelection(next: Record<string, string>) {
    setSelection(next)
    const variant = resolveVariant(variants, next)
    if (variant) onPick(next, variant)
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start gap-3">
        {image ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <Image
              src={image}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-md bg-gray-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{productName}</p>
          {ep.is_required ? (
            <p className="text-[11px] text-gray-500">Required</p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Optional — ${centsToDecimalString(ep.price_cents)} extra
            </p>
          )}
        </div>
        {!ep.is_required && isAttached && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelection({})
              onRemove()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {(ep.is_required || isAttached) && (
        <>
          <VariantPicker
            options={options}
            variants={variants}
            selection={selection}
            onSelectionChange={applySelection}
            size="sm"
          />
          {!resolved && (
            <p className="text-xs text-amber-600">Pick options to continue</p>
          )}
        </>
      )}
      <input
        type="hidden"
        data-personid={personId}
        data-eventproductid={ep.id}
      />
    </div>
  )
}

function AddressForm({
  value,
  onChange,
}: {
  value: ShippingAddress
  onChange: (next: ShippingAddress) => void
}) {
  function set<K extends keyof ShippingAddress>(k: K, v: ShippingAddress[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <div className="space-y-2 rounded-md border bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">Shipping address</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Recipient name</Label>
          <Input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="First Last"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Address</Label>
          <Input
            value={value.address1}
            onChange={(e) => set("address1", e.target.value)}
            placeholder="Street address"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Apt / suite (optional)</Label>
          <Input
            value={value.address2 ?? ""}
            onChange={(e) => set("address2", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input value={value.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">State / region</Label>
          <Input
            value={value.region}
            onChange={(e) => set("region", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Postal code</Label>
          <Input
            value={value.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input
            value={value.country}
            onChange={(e) => set("country", e.target.value.toUpperCase())}
          />
        </div>
      </div>
    </div>
  )
}

export function ProductSelectionStep({
  registrants,
  eventProducts,
  deliveryMode,
  selections,
  onSelectionsChange,
  addresses,
  onAddressesChange,
}: ProductSelectionStepProps) {
  const required = useMemo(
    () => eventProducts.filter((ep) => ep.is_required),
    [eventProducts],
  )
  const optional = useMemo(
    () => eventProducts.filter((ep) => !ep.is_required),
    [eventProducts],
  )

  function setSelection(
    personId: string,
    ep: EventProductForRegister,
    variant: VariantForPicker,
    options: Record<string, string>,
  ) {
    const next = { ...selections }
    next[selectionKey(personId, ep.id)] = {
      variantId: variant.id,
      unitPriceCents: ep.price_cents,
      options,
      productName: ep.org_products?.name ?? "",
      variantSku: variant.sku,
      imageUrl: variant.image_url ?? ep.org_products?.image_path ?? null,
    }
    onSelectionsChange(next)
  }

  function clearSelection(personId: string, ep: EventProductForRegister) {
    const next = { ...selections }
    delete next[selectionKey(personId, ep.id)]
    onSelectionsChange(next)
  }

  function setAddress(personId: string, address: ShippingAddress) {
    onAddressesChange({ ...addresses, [personId]: address })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pick options</CardTitle>
        <CardDescription>
          {required.length > 0 && optional.length > 0
            ? "Choose required options for each registrant; add optional extras if you'd like."
            : required.length > 0
              ? "Each registrant needs to pick the required options below."
              : "Add any optional extras you'd like for each registrant."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {registrants.map((p) => {
          const displayName = p.dependent
            ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Registrant"
            : `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Myself"
          const personAddress = addresses[p.id] ?? emptyAddress()
          return (
            <div key={p.id} className="space-y-3">
              <p className="text-sm font-medium">{displayName}</p>
              <div className="space-y-2">
                {required.map((ep) => {
                  const variants = toPickerVariants(
                    ep.org_products?.org_product_variants ?? [],
                  )
                  return (
                    <ProductRow
                      key={`${p.id}-${ep.id}`}
                      personId={p.id}
                      ep={ep}
                      variants={variants}
                      isAttached
                      selectionEntry={selections[selectionKey(p.id, ep.id)]}
                      onPick={(next, v) => setSelection(p.id, ep, v, next)}
                      onRemove={() => {}}
                    />
                  )
                })}
                {optional.map((ep) => {
                  const variants = toPickerVariants(
                    ep.org_products?.org_product_variants ?? [],
                  )
                  const entry = selections[selectionKey(p.id, ep.id)]
                  const isAttached = !!entry
                  if (!isAttached) {
                    return (
                      <button
                        key={`${p.id}-${ep.id}`}
                        type="button"
                        onClick={() => {
                          // Insert a placeholder entry so the picker shows.
                          // The first valid pick will overwrite this.
                          const next = { ...selections }
                          next[selectionKey(p.id, ep.id)] = {
                            variantId: "",
                            unitPriceCents: ep.price_cents,
                            options: {},
                            productName: ep.org_products?.name ?? "",
                            variantSku: "",
                            imageUrl: ep.org_products?.image_path ?? null,
                          }
                          onSelectionsChange(next)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add {ep.org_products?.name ?? "add-on"} (+$
                        {centsToDecimalString(ep.price_cents)})
                      </button>
                    )
                  }
                  return (
                    <ProductRow
                      key={`${p.id}-${ep.id}`}
                      personId={p.id}
                      ep={ep}
                      variants={variants}
                      isAttached
                      selectionEntry={entry}
                      onPick={(next, v) => setSelection(p.id, ep, v, next)}
                      onRemove={() => clearSelection(p.id, ep)}
                    />
                  )
                })}
              </div>
              {deliveryMode === "shipped_to_registrant" && (
                <AddressForm
                  value={personAddress}
                  onChange={(next) => setAddress(p.id, next)}
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function selectionsAreComplete(args: {
  registrants: Registrant[]
  eventProducts: EventProductForRegister[]
  deliveryMode: DeliveryMode | null
  selections: SelectionsByPerson
  addresses: AddressesByPerson
}): { complete: boolean; reason?: string } {
  const required = args.eventProducts.filter((ep) => ep.is_required)
  for (const p of args.registrants) {
    for (const ep of required) {
      const entry = args.selections[selectionKey(p.id, ep.id)]
      if (!entry || !entry.variantId) {
        return {
          complete: false,
          reason: `Pick a ${ep.org_products?.name ?? "product"} for ${p.first_name ?? "everyone"}`,
        }
      }
    }
    // Optional entries with no chosen variant are placeholders — block submit
    // until they're either resolved or removed.
    for (const ep of args.eventProducts) {
      if (ep.is_required) continue
      const entry = args.selections[selectionKey(p.id, ep.id)]
      if (entry && !entry.variantId) {
        return {
          complete: false,
          reason: `Pick options for ${ep.org_products?.name ?? "add-on"} or remove it`,
        }
      }
    }
    if (args.deliveryMode === "shipped_to_registrant") {
      const a = args.addresses[p.id]
      if (
        !a ||
        !a.name ||
        !a.address1 ||
        !a.city ||
        !a.region ||
        !a.postalCode ||
        !a.country
      ) {
        return {
          complete: false,
          reason: `Enter a shipping address for ${p.first_name ?? "each registrant"}`,
        }
      }
    }
  }
  return { complete: true }
}

export function buildItemsPayload(args: {
  registrants: Registrant[]
  eventProducts: EventProductForRegister[]
  deliveryMode: DeliveryMode | null
  selections: SelectionsByPerson
  addresses: AddressesByPerson
}): Array<{
  person_id: string
  event_product_id: string
  variant_id: string
  shipping_address?: ShippingAddress
}> {
  const out: Array<{
    person_id: string
    event_product_id: string
    variant_id: string
    shipping_address?: ShippingAddress
  }> = []
  for (const p of args.registrants) {
    const personAddress =
      args.deliveryMode === "shipped_to_registrant"
        ? args.addresses[p.id]
        : undefined
    for (const ep of args.eventProducts) {
      const entry = args.selections[selectionKey(p.id, ep.id)]
      if (!entry || !entry.variantId) continue
      out.push({
        person_id: p.id,
        event_product_id: ep.id,
        variant_id: entry.variantId,
        ...(personAddress ? { shipping_address: personAddress } : {}),
      })
    }
  }
  return out
}
