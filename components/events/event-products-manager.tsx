"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { installIntegration, uninstallIntegration } from "@/lib/integrations/install"
import { centsToDecimalString, dollarsToCents } from "@/lib/money"

type DeliveryMode = "pickup_at_event" | "shipped_to_registrant" | null

interface ProductOption {
  id: string
  name: string
  image_path: string | null
  has_active_variants: boolean
}

interface AttachmentRow {
  id: string
  event_id: string
  product_id: string
  is_required: boolean
  price_cents: number
  ordering: number
}

interface AttachmentDraft extends AttachmentRow {
  product: ProductOption | null
  priceDollars: string
  // local edit flag to suppress immediate updates while user is typing
  dirty?: boolean
}

export function EventProductsManager({
  eventId,
  accountId,
  initialDeliveryMode,
}: {
  eventId: string
  accountId: string
  /** Optional. When omitted the manager fetches product_delivery_mode itself. */
  initialDeliveryMode?: DeliveryMode
}) {
  const supabase = createClient()

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(
    initialDeliveryMode ?? null,
  )
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const [catalog, setCatalog] = useState<ProductOption[]>([])
  const [picking, setPicking] = useState<string>("")
  const [loading, setLoading] = useState(true)

  // Load catalog + current attachments.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [productsRes, attachedRes, deliveryRes] = await Promise.all([
        supabase
          .from("org_products")
          .select("id, name, image_path, org_product_variants(id, is_active)")
          .eq("account_id", accountId)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("event_products")
          .select(
            "id, event_id, product_id, is_required, price_cents, ordering, org_products(id, name, image_path)",
          )
          .eq("event_id", eventId)
          .order("ordering"),
        // Only fetch the delivery mode if the parent didn't pass one in.
        initialDeliveryMode === undefined
          ? supabase
              .from("events")
              .select("product_delivery_mode")
              .eq("id", eventId)
              .single()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return

      if (deliveryRes.data) {
        setDeliveryMode(
          (deliveryRes.data as any).product_delivery_mode ?? null,
        )
      }

      const products: ProductOption[] = (productsRes.data ?? []).map(
        (p: any) => ({
          id: p.id,
          name: p.name,
          image_path: p.image_path,
          has_active_variants: (p.org_product_variants ?? []).some(
            (v: any) => v.is_active,
          ),
        }),
      )
      setCatalog(products)

      const drafts: AttachmentDraft[] = (attachedRes.data ?? []).map(
        (r: any) => ({
          id: r.id,
          event_id: r.event_id,
          product_id: r.product_id,
          is_required: r.is_required,
          price_cents: r.price_cents,
          ordering: r.ordering,
          priceDollars: centsToDecimalString(r.price_cents),
          product: r.org_products
            ? {
                id: r.org_products.id,
                name: r.org_products.name,
                image_path: r.org_products.image_path,
                has_active_variants: true,
              }
            : null,
        }),
      )
      setAttachments(drafts)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase, eventId, accountId])

  const availableToAttach = useMemo(() => {
    const attachedIds = new Set(attachments.map((a) => a.product_id))
    return catalog.filter(
      (p) => p.has_active_variants && !attachedIds.has(p.id),
    )
  }, [catalog, attachments])

  async function persistDeliveryMode(next: DeliveryMode) {
    setDeliveryMode(next)
    const { error } = await supabase
      .from("events")
      .update({ product_delivery_mode: next })
      .eq("id", eventId)
    if (error) toast.error(`Couldn't save delivery mode: ${error.message}`)
  }

  async function handleAdd() {
    if (!picking) return
    const product = catalog.find((p) => p.id === picking)
    if (!product) return

    const ordering = attachments.length
    const { data, error } = await supabase
      .from("event_products")
      .insert({
        event_id: eventId,
        product_id: product.id,
        is_required: true,
        price_cents: 0,
        ordering,
      })
      .select("id, event_id, product_id, is_required, price_cents, ordering")
      .single()

    if (error || !data) {
      toast.error(error?.message ?? "Couldn't attach product")
      return
    }

    setAttachments((prev) => [
      ...prev,
      {
        ...(data as AttachmentRow),
        product,
        priceDollars: centsToDecimalString(data.price_cents),
      },
    ])
    setPicking("")

    // First attachment for this event: default delivery to pickup AND
    // install the products app so the platform knows this event runs
    // the products contract (validation + post-payment dispatch).
    if (attachments.length === 0) {
      if (!deliveryMode) {
        await persistDeliveryMode("pickup_at_event")
      }
      try {
        await installIntegration(eventId, "products", supabase)
      } catch (err) {
        console.error("[products] installIntegration failed", err)
      }
    }
  }

  async function handleRemove(id: string) {
    const prior = attachments
    const next = prior.filter((a) => a.id !== id)
    setAttachments(next)
    const { error } = await supabase
      .from("event_products")
      .delete()
      .eq("id", id)
    if (error) {
      toast.error(error.message)
      setAttachments(prior)
      return
    }
    // Last attachment removed → uninstall the products app so the event
    // no longer runs the products contract.
    if (next.length === 0) {
      try {
        await uninstallIntegration(eventId, "products", supabase)
      } catch (err) {
        console.error("[products] uninstallIntegration failed", err)
      }
    }
  }

  async function handleToggleRequired(id: string, value: boolean) {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_required: value } : a)),
    )
    const { error } = await supabase
      .from("event_products")
      .update({ is_required: value })
      .eq("id", id)
    if (error) toast.error(error.message)
  }

  function handlePriceChange(id: string, dollars: string) {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, priceDollars: dollars, dirty: true } : a,
      ),
    )
  }

  async function handlePriceBlur(id: string) {
    const attachment = attachments.find((a) => a.id === id)
    if (!attachment || !attachment.dirty) return
    const parsed = parseFloat(attachment.priceDollars)
    const cents =
      Number.isFinite(parsed) && parsed >= 0 ? dollarsToCents(parsed) : 0
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              price_cents: cents,
              priceDollars: centsToDecimalString(cents),
              dirty: false,
            }
          : a,
      ),
    )
    const { error } = await supabase
      .from("event_products")
      .update({ price_cents: cents })
      .eq("id", id)
    if (error) toast.error(error.message)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Products &amp; Add-ons</CardTitle>
        <CardDescription>
          Bundle products into registration. Required products are picked by
          every registrant (e.g. camp t-shirt size). Optional ones are offered
          as add-ons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Delivery</Label>
                <Select
                  value={deliveryMode ?? "pickup_at_event"}
                  onValueChange={(v) =>
                    persistDeliveryMode(v as DeliveryMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup_at_event">
                      Picked up at the event
                    </SelectItem>
                    <SelectItem value="shipped_to_registrant">
                      Shipped to each registrant
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {deliveryMode === "shipped_to_registrant"
                    ? "Each registrant enters a shipping address during signup."
                    : "Products ship to the org address and are distributed in person."}
                </p>
              </div>
            )}

            {attachments.length === 0 && (
              <p className="text-sm text-gray-500">
                No products attached. Add one below to let registrants pick a
                variant during signup.
              </p>
            )}

            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start gap-3">
                  {a.product?.image_path ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      <Image
                        src={a.product.image_path}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.product?.name ?? "Unknown product"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">Required</p>
                      <p className="text-[11px] text-gray-500">
                        Every registrant picks a variant
                      </p>
                    </div>
                    <Switch
                      checked={a.is_required}
                      onCheckedChange={(v) => handleToggleRequired(a.id, v)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor={`price-${a.id}`}
                      className="text-xs font-medium"
                    >
                      Per-registrant price ($)
                    </Label>
                    <Input
                      id={`price-${a.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.priceDollars}
                      onChange={(e) =>
                        handlePriceChange(a.id, e.target.value)
                      }
                      onBlur={() => handlePriceBlur(a.id)}
                    />
                    <p className="text-[11px] text-gray-500">
                      0.00 = included in event fee (comp)
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-end gap-2 border-t pt-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="add-product">Add a product</Label>
                <Select
                  value={picking || "__pick__"}
                  onValueChange={(v) =>
                    setPicking(v === "__pick__" ? "" : v)
                  }
                >
                  <SelectTrigger id="add-product">
                    <SelectValue placeholder="Pick a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__pick__" disabled>
                      Pick a product…
                    </SelectItem>
                    {availableToAttach.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableToAttach.length === 0 && catalog.length > 0 && (
                  <p className="text-xs text-gray-500">
                    All eligible products are already attached.
                  </p>
                )}
                {catalog.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No active products with active variants in this account
                    yet.
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!picking}
                size="sm"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
