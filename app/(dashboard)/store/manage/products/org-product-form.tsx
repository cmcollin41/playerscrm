"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, ImagePlus, Save, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slug"
import { describeVariant, variantOptionsKey } from "@/lib/store/options"
import {
  getStoreImagePublicUrl,
  makeImageFilename,
  orgProductImagePath,
  orgVariantImagePath,
  uploadStoreImage,
} from "@/lib/storage/store-images"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ImageDropzone } from "@/components/ui/image-dropzone"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  FulfillmentPartners,
  OrgProducts,
  OrgProductStatus,
  OrgProductVariants,
  ProductTemplates,
  ProductTemplateVariants,
} from "@/types/schema.types"

type TemplateWithPartner = ProductTemplates & {
  fulfillment_partners?: Pick<FulfillmentPartners, "slug" | "name">
}

interface OrgProductFormProps {
  accountId: string
  template: TemplateWithPartner
  templateVariants: ProductTemplateVariants[]
  product?: OrgProducts
  productVariants?: OrgProductVariants[]
}

interface VariantState {
  // Internal stable key (variantOptionsKey of the options map). Used to track
  // rows across renders so per-variant edits don't drift when option values
  // change on the parent template.
  key: string
  id: string                          // stable across renders; pre-generated client-side
  template_variant_id: string | null
  options: Record<string, string>
  sku: string
  price: string                       // dollars
  image_path: string | null
  inventory_qty: string               // empty string = unlimited
  is_active: boolean
  ordering: number
}

interface FormState {
  slug: string
  name: string
  description: string
  status: OrgProductStatus
  image_path: string | null
  customization: Record<string, string>
  variants: VariantState[]
}

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function toCents(dollars: string): number {
  const n = parseFloat(dollars)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function fieldKind(name: string): "color" | "url" | "text" {
  if (name.endsWith("_color")) return "color"
  if (name.endsWith("_url")) return "url"
  return "text"
}

function humanize(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\burl\b/i, "URL")
    .replace(/^\w/, (c) => c.toUpperCase())
}

/** Seed variants for a brand-new product: one row per active template variant. */
function seedVariantsFromTemplate(
  template: TemplateWithPartner,
  templateVariants: ProductTemplateVariants[],
): VariantState[] {
  const floor =
    template.base_cost_cents + template.min_markup_cents
  return templateVariants.map((tv, i) => ({
    key: variantOptionsKey(tv.options),
    id: crypto.randomUUID(),
    template_variant_id: tv.id,
    options: tv.options,
    sku: tv.sku, // initial sku copies the template variant's sku
    price: toDollars(floor + tv.delta_cost_cents),
    image_path: tv.image_path ?? null,
    inventory_qty: "",
    is_active: true,
    ordering: tv.ordering || (i + 1) * 10,
  }))
}

/** When editing, reconcile existing rows w/ template variants so newly-added
 * template variants show up while edits to existing rows persist. */
function mergeVariants(
  template: TemplateWithPartner,
  templateVariants: ProductTemplateVariants[],
  existing: OrgProductVariants[],
): VariantState[] {
  const floor =
    template.base_cost_cents + template.min_markup_cents
  const byKey = new Map<string, OrgProductVariants>()
  for (const v of existing) {
    byKey.set(variantOptionsKey(v.options), v)
  }
  // Preserve template ordering as the canonical sort, but keep existing rows
  // that no longer match a template variant (custom variants).
  const rows: VariantState[] = []
  const consumedKeys = new Set<string>()
  templateVariants.forEach((tv, i) => {
    const key = variantOptionsKey(tv.options)
    consumedKeys.add(key)
    const v = byKey.get(key)
    if (v) {
      rows.push({
        key,
        id: v.id,
        template_variant_id: v.template_variant_id ?? tv.id,
        options: v.options,
        sku: v.sku,
        price: toDollars(v.price_cents),
        image_path: v.image_path ?? null,
        inventory_qty:
          v.inventory_qty == null ? "" : String(v.inventory_qty),
        is_active: v.is_active,
        ordering: v.ordering || (i + 1) * 10,
      })
    } else {
      rows.push({
        key,
        id: crypto.randomUUID(),
        template_variant_id: tv.id,
        options: tv.options,
        sku: tv.sku,
        price: toDollars(floor + tv.delta_cost_cents),
        image_path: tv.image_path ?? null,
        inventory_qty: "",
        is_active: true,
        ordering: tv.ordering || (i + 1) * 10,
      })
    }
  })
  // Any existing rows not matched (template variant removed upstream) — keep
  // them visible so the org admin can decide to archive them.
  for (const v of existing) {
    const key = variantOptionsKey(v.options)
    if (consumedKeys.has(key)) continue
    rows.push({
      key,
      id: v.id,
      template_variant_id: v.template_variant_id ?? null,
      options: v.options,
      sku: v.sku,
      price: toDollars(v.price_cents),
      image_path: v.image_path ?? null,
      inventory_qty: v.inventory_qty == null ? "" : String(v.inventory_qty),
      is_active: v.is_active,
      ordering: v.ordering,
    })
  }
  return rows
}

export function OrgProductForm({
  accountId,
  template,
  templateVariants,
  product,
  productVariants,
}: OrgProductFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!product

  // Pre-generate a product ID so image upload paths are stable before first save.
  const productId = useRef(product?.id ?? crypto.randomUUID()).current

  const customizableFields: string[] = useMemo(() => {
    const raw = (template.metadata as any)?.customizable
    return Array.isArray(raw) ? raw.filter((x: any) => typeof x === "string") : []
  }, [template])

  const initialVariants = useMemo(() => {
    if (isEdit && productVariants) {
      return mergeVariants(template, templateVariants, productVariants)
    }
    return seedVariantsFromTemplate(template, templateVariants)
  }, [template, templateVariants, productVariants, isEdit])

  const [state, setState] = useState<FormState>({
    slug: product?.slug ?? "",
    name: product?.name ?? template.name,
    description: product?.description ?? template.description ?? "",
    status: product?.status ?? "draft",
    image_path: product?.image_path ?? template.image_path ?? null,
    customization: customizableFields.reduce<Record<string, string>>((acc, f) => {
      const existing = (product?.customization as any)?.[f]
      acc[f] = existing != null ? String(existing) : ""
      return acc
    }, {}),
    variants: initialVariants,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }
  function updateCustom(field: string, value: string) {
    setState((s) => ({
      ...s,
      customization: { ...s.customization, [field]: value },
    }))
  }
  function updateVariant(key: string, patch: Partial<VariantState>) {
    setState((s) => ({
      ...s,
      variants: s.variants.map((v) =>
        v.key === key ? { ...v, ...patch } : v,
      ),
    }))
  }

  // ---- image uploads ----

  async function uploadProductImage(file: File): Promise<string> {
    const filename = makeImageFilename(file.name)
    const path = orgProductImagePath(accountId, productId, filename)
    return uploadStoreImage(supabase, path, file)
  }

  async function uploadVariantImage(
    variant: VariantState,
    file: File,
  ): Promise<string> {
    const filename = makeImageFilename(file.name)
    const path = orgVariantImagePath(accountId, productId, variant.id, filename)
    return uploadStoreImage(supabase, path, file)
  }

  // ---- save / delete ----

  async function handleSave() {
    if (!state.name.trim()) return toast.error("Name is required")

    // markup floor: every variant must clear base + min markup + delta_cost.
    const baseFloor = template.base_cost_cents + template.min_markup_cents
    for (const v of state.variants) {
      if (!v.is_active) continue
      const priceCents = toCents(v.price)
      // Look up template-variant delta if known.
      const tv = templateVariants.find((t) => t.id === v.template_variant_id)
      const floor = baseFloor + (tv?.delta_cost_cents ?? 0)
      if (priceCents < floor) {
        toast.error(
          `${describeVariant(v.options)}: price must be at least $${(floor / 100).toFixed(2)}`,
        )
        return
      }
    }

    const slug = state.slug.trim() || slugify(state.name.trim())
    const productPayload = {
      id: productId,
      account_id: accountId,
      template_id: template.id,
      slug,
      name: state.name.trim(),
      description: state.description.trim() || null,
      customization: state.customization,
      image_path: state.image_path,
      options: template.options ?? [],
      status: state.status,
      published_at:
        state.status === "active"
          ? (product?.published_at ?? new Date().toISOString())
          : null,
    }

    setSaving(true)
    const { error: prodError } = await supabase
      .from("org_products")
      .upsert(productPayload, { onConflict: "id" })
    if (prodError) {
      setSaving(false)
      if (prodError.code === "23505") {
        toast.error("A product with that slug already exists in your account")
      } else {
        toast.error(prodError.message)
      }
      return
    }

    // Reconcile variants: upsert by (product_id, sku); delete rows whose SKU
    // is no longer in the form.
    const variantRows = state.variants.map((v, i) => ({
      id: v.id,
      product_id: productId,
      template_variant_id: v.template_variant_id,
      sku: v.sku.trim(),
      options: v.options,
      price_cents: toCents(v.price),
      image_path: v.image_path,
      inventory_qty: v.inventory_qty.trim() === ""
        ? null
        : Math.max(0, parseInt(v.inventory_qty, 10) || 0),
      is_active: v.is_active,
      ordering: v.ordering || (i + 1) * 10,
    }))

    const wantedSkus = new Set(variantRows.map((v) => v.sku))
    const stale = (productVariants ?? []).filter((v) => !wantedSkus.has(v.sku))
    if (stale.length > 0) {
      await supabase
        .from("org_product_variants")
        .delete()
        .eq("product_id", productId)
        .in(
          "sku",
          stale.map((s) => s.sku),
        )
    }

    const { error: vError } = await supabase
      .from("org_product_variants")
      .upsert(variantRows, { onConflict: "product_id,sku" })

    setSaving(false)
    if (vError) {
      toast.error(vError.message)
      return
    }

    toast.success(isEdit ? "Product saved" : "Product created")
    if (isEdit) {
      router.refresh()
    } else {
      router.push(`/store/manage/products/${productId}`)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return
    setDeleting(true)
    const { error } = await supabase
      .from("org_products")
      .delete()
      .eq("id", product.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Product deleted")
    router.push("/store/manage/products")
  }

  const partnerName = template.fulfillment_partners?.name ?? "—"

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={isEdit ? "/store/manage/products" : "/store/manage/products/new"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? "All products" : "Pick a different template"}
      </Link>

      {/* basics */}
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? state.name : `New: ${template.name}`}</CardTitle>
          <CardDescription>
            Template: {template.name} · Partner: {partnerName} · Category:{" "}
            <span className="capitalize">{template.category}</span>
            {" · "}
            Base cost ${toDollars(template.base_cost_cents)} + shipping $
            {toDollars(template.shipping_flat_cents)}
            {" · "}
            Min markup ${toDollars(template.min_markup_cents)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name">
              <Input
                value={state.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => {
                  if (!state.slug.trim() && state.name.trim()) {
                    update("slug", slugify(state.name.trim()))
                  }
                }}
              />
            </Field>
            <Field
              label="Slug"
              hint="Used in URLs. Unique within your account."
            >
              <Input
                value={state.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
            />
          </Field>

          <Field label="Status">
            <Select
              value={state.status}
              onValueChange={(v) => update("status", v as OrgProductStatus)}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="active">Active (published)</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Product image"
            hint="Falls back to the template image when left blank."
          >
            <ImageDropzone
              value={getStoreImagePublicUrl(supabase, state.image_path) ?? null}
              onChange={(url) => {
                if (url == null) update("image_path", null)
              }}
              onFileSelect={async (file) => {
                const path = await uploadProductImage(file)
                update("image_path", path)
                return getStoreImagePublicUrl(supabase, path) ?? path
              }}
              onError={(msg) => toast.error(msg)}
              placeholder="Upload a hero image for this product"
              className="aspect-square w-48"
            />
          </Field>

          {customizableFields.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-medium">Customization</p>
              <div className="grid gap-4 md:grid-cols-2">
                {customizableFields.map((field) => (
                  <CustomField
                    key={field}
                    name={field}
                    value={state.customization[field] ?? ""}
                    onChange={(v) => updateCustom(field, v)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* variants */}
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>
            Each variant is sellable separately. Price must clear base cost +
            min markup + the partner&apos;s size/color delta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.variants.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              No variants seeded. Ask the platform admin to add variants to the
              template.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Price (USD)</TableHead>
                    <TableHead>Inventory</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.variants.map((v) => {
                    const tv = templateVariants.find(
                      (t) => t.id === v.template_variant_id,
                    )
                    const floor =
                      template.base_cost_cents +
                      template.min_markup_cents +
                      (tv?.delta_cost_cents ?? 0)
                    const imageUrl =
                      getStoreImagePublicUrl(supabase, v.image_path) ?? null
                    return (
                      <TableRow key={v.key}>
                        <TableCell className="font-medium">
                          {describeVariant(v.options)}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={v.sku}
                            onChange={(e) =>
                              updateVariant(v.key, { sku: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <Input
                              type="number"
                              step="0.01"
                              min={(floor / 100).toFixed(2)}
                              value={v.price}
                              onChange={(e) =>
                                updateVariant(v.key, { price: e.target.value })
                              }
                              className="h-8 w-24 text-right text-xs tabular-nums"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              min ${(floor / 100).toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={v.inventory_qty}
                            onChange={(e) =>
                              updateVariant(v.key, {
                                inventory_qty: e.target.value,
                              })
                            }
                            placeholder="∞"
                            className="h-8 w-20 text-xs tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <VariantImageButton
                            currentUrl={imageUrl}
                            onSelect={async (file) => {
                              const path = await uploadVariantImage(v, file)
                              updateVariant(v.key, { image_path: path })
                            }}
                            onClear={() =>
                              updateVariant(v.key, { image_path: null })
                            }
                            onError={(msg) => toast.error(msg)}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={v.is_active}
                            onCheckedChange={(c) =>
                              updateVariant(v.key, { is_active: c })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between border-t bg-background/95 px-4 py-3 backdrop-blur">
        {isEdit ? (
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete product
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/store/manage/products">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CustomField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (v: string) => void
}) {
  const kind = fieldKind(name)
  const label = humanize(name)

  if (kind === "color") {
    return (
      <Field label={label}>
        <div className="flex gap-2">
          <Input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-16 cursor-pointer p-1"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="flex-1 font-mono"
          />
        </div>
      </Field>
    )
  }

  if (kind === "url") {
    return (
      <Field label={label}>
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      </Field>
    )
  }

  return (
    <Field label={label}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function VariantImageButton({
  currentUrl,
  onSelect,
  onClear,
  onError,
}: {
  currentUrl: string | null
  onSelect: (file: File) => Promise<void>
  onClear: () => void
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)

  function openPicker() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/jpeg,image/png,image/webp"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        onError("Image must be under 5MB")
        return
      }
      setBusy(true)
      try {
        await onSelect(file)
      } catch (err) {
        onError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setBusy(false)
      }
    }
    input.click()
  }

  if (currentUrl) {
    return (
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUrl}
          alt=""
          className="h-10 w-10 rounded border object-cover"
        />
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openPicker}
      disabled={busy}
      className="h-8 text-xs"
    >
      <ImagePlus className="mr-1 h-3 w-3" />
      {busy ? "…" : "Add"}
    </Button>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
