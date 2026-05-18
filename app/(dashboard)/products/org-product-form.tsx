"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slug"
import { describeVariant, variantOptionsKey } from "@/lib/store/options"
import {
  DEFAULT_DESIGN,
  DEFAULT_MOCKUP_OPTIONS,
  EMBELLISHMENT_LABELS,
  PLACEMENT_DEFAULTS,
  PLACEMENT_LABELS,
  parseDesign,
  type ColorMode,
  type DesignConfig,
  type DesignPlacement,
  type Embellishment,
  type MockupGenerationOptions,
} from "@/lib/store/design"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  getStoreImagePublicUrl,
  makeImageFilename,
  orgProductImagePath,
  orgVariantImagePath,
  uploadStoreImage,
} from "@/lib/storage/store-images"
import {
  createArtworkSignedUrl,
  makeArtworkFilename,
  orgProductArtworkPath,
  uploadArtwork,
} from "@/lib/storage/store-artwork"
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
  /** Pre-resolved signed URL for the existing artwork preview (private bucket). */
  initialArtworkUrl?: string | null
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
  design_color_hex: string | null     // explicit ink color; null = auto
  is_active: boolean
  ordering: number
}

interface FormState {
  slug: string
  name: string
  description: string
  status: OrgProductStatus
  image_path: string | null
  artwork_path: string | null
  design: DesignConfig
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
    design_color_hex: null,
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
        design_color_hex: v.design_color_hex ?? null,
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
        design_color_hex: null,
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
      design_color_hex: v.design_color_hex ?? null,
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
  initialArtworkUrl,
}: OrgProductFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!product

  // Pre-generate a product ID so image upload paths are stable before first save.
  const productId = useRef(product?.id ?? crypto.randomUUID()).current

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
    artwork_path: product?.artwork_path ?? null,
    design: parseDesign(product?.design),
    variants: initialVariants,
  })
  // Artwork is in a private bucket; its preview is a signed URL we refresh
  // after upload. Server pre-resolves the initial URL via createArtworkSignedUrl().
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(
    initialArtworkUrl ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Which variant the big preview pane is showing. Defaults to the first
  // variant; clicking a color swatch swaps it.
  const [previewKey, setPreviewKey] = useState<string>(
    initialVariants[0]?.key ?? "",
  )
  // Which variant (if any) currently has an AI mockup generation in flight.
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)
  // Variant key of the AI-mockup dialog, or null when closed.
  const [mockupVariantKey, setMockupVariantKey] = useState<string | null>(null)

  // Group active variants by Color and remember the first one per color —
  // used both for the color swatch row and the preview.
  const firstVariantPerColor = useMemo(() => {
    const map = new Map<string, VariantState>()
    for (const v of state.variants) {
      if (!v.is_active) continue
      const c = v.options?.Color
      if (!c) continue
      if (!map.has(c)) map.set(c, v)
    }
    return map
  }, [state.variants])

  // Currently previewed variant (falls back to the first variant in state).
  const previewVariant: VariantState | undefined =
    state.variants.find((v) => v.key === previewKey) ?? state.variants[0]

  // Resolve a base image for a variant: prefer the variant's own image_path
  // (which is what the AI mockup overwrites), then the linked template
  // variant's image, then the template's hero.
  function variantBaseImagePath(v: VariantState): string | null {
    if (v.image_path) return v.image_path
    const tv = templateVariants.find((t) => t.id === v.template_variant_id)
    return tv?.image_path ?? template.image_path ?? null
  }

  const previewBaseUrl = previewVariant
    ? getStoreImagePublicUrl(supabase, variantBaseImagePath(previewVariant))
    : undefined

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }
  function updateDesign(patch: Partial<DesignConfig>) {
    setState((s) => ({ ...s, design: { ...s.design, ...patch } }))
  }
  function setPlacement(p: DesignPlacement) {
    // Switching placement snaps position + scale to that placement's defaults.
    const d = PLACEMENT_DEFAULTS[p]
    setState((s) => ({
      ...s,
      design: { ...s.design, placement: p, x: d.x, y: d.y, scale: d.scale },
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

  // ---- artwork upload (private bucket; signed URL preview) ----

  async function handleArtworkSelect(file: File) {
    const filename = makeArtworkFilename(file.name)
    const path = orgProductArtworkPath(accountId, productId, filename)
    const stored = await uploadArtwork(supabase, path, file)
    update("artwork_path", stored)
    const signed = await createArtworkSignedUrl(supabase, stored)
    setArtworkPreviewUrl(signed)
  }

  function handleArtworkClear() {
    update("artwork_path", null)
    setArtworkPreviewUrl(null)
  }

  // ---- AI mockup generation ----

  async function generateMockup(
    v: VariantState,
    options: MockupGenerationOptions,
  ) {
    if (!isEdit) {
      toast.error("Save the product once before generating mockups.")
      return
    }
    if (!state.artwork_path) {
      toast.error("Upload your design (artwork) first.")
      return
    }
    const basePath = variantBaseImagePath(v)
    if (!basePath) {
      toast.error("No base image available for this variant.")
      return
    }
    setGeneratingKey(v.key)
    try {
      const res = await fetch("/api/store/generate-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          variant_id: v.id,
          artwork_path: state.artwork_path,
          base_image_path: basePath,
          embellishment: options.embellishment,
          color_mode: options.colorMode,
          ink_color_hex:
            options.colorMode === "single_ink"
              ? options.inkColorHex
              : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Generation failed")
      }
      updateVariant(v.key, { image_path: json.image_path })
      toast.success(`Mockup ready: ${describeVariant(v.options)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGeneratingKey(null)
    }
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
      image_path: state.image_path,
      artwork_path: state.artwork_path,
      options: template.options ?? [],
      design: state.design,
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
      design_color_hex: v.design_color_hex,
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
      router.push(`/products/${productId}`)
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
    router.push("/products")
  }

  const partnerName = template.fulfillment_partners?.name ?? "—"

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={isEdit ? "/products" : "/products/new"}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit ? "All products" : "Pick a different template"}
      </Link>

      {/* live preview + design controls */}
      {previewVariant && (
        <Card>
          <CardHeader>
            <CardTitle>Design</CardTitle>
            <CardDescription>
              Drag the artwork on the preview, resize it, set placement /
              embellishment, and choose ink color per variant. Click
              &quot;AI mockup&quot; on a variant below for the photoreal version.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[480px_1fr]">
            <div className="flex flex-col items-center gap-4">
              <DesignPreview
                baseUrl={previewBaseUrl ?? null}
                artworkUrl={artworkPreviewUrl}
                design={state.design}
                onDesignChange={updateDesign}
              />

              {firstVariantPerColor.size > 0 && (
                <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
                  {Array.from(firstVariantPerColor.entries()).map(
                    ([color, v]) => {
                      const tv = templateVariants.find(
                        (t) => t.id === v.template_variant_id,
                      )
                      const swatchUrl =
                        getStoreImagePublicUrl(supabase, v.image_path) ??
                        getStoreImagePublicUrl(supabase, tv?.image_path)
                      const isActive = previewVariant?.key === v.key
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setPreviewKey(v.key)}
                          title={color}
                          className={cn(
                            "h-9 w-9 overflow-hidden rounded-full border-2 transition",
                            isActive
                              ? "border-foreground"
                              : "border-transparent hover:border-muted-foreground/60",
                          )}
                        >
                          {swatchUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={swatchUrl}
                              alt={color}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="block h-full w-full bg-muted" />
                          )}
                        </button>
                      )
                    },
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Previewing: {describeVariant(previewVariant.options)}
                {!state.artwork_path && " · upload your design to see it"}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Field
                label="Your design (artwork)"
                hint="PNG, SVG, or PDF. Private to you — handed to the partner at order time."
              >
                <ArtworkDropzone
                  previewUrl={artworkPreviewUrl}
                  onSelect={handleArtworkSelect}
                  onClear={handleArtworkClear}
                  onError={(msg) => toast.error(msg)}
                />
              </Field>

              <Field label="Placement">
                <Select
                  value={state.design.placement}
                  onValueChange={(v) => setPlacement(v as DesignPlacement)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLACEMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label={`Size — ${Math.round(state.design.scale * 100)}% of garment width`}
              >
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.01}
                  value={state.design.scale}
                  onChange={(e) =>
                    updateDesign({ scale: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
              </Field>
              <Field label={`Rotation — ${Math.round(state.design.rotation)}°`}>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={state.design.rotation}
                  onChange={(e) =>
                    updateDesign({ rotation: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
              </Field>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = PLACEMENT_DEFAULTS[state.design.placement]
                  updateDesign({
                    x: d.x,
                    y: d.y,
                    scale: d.scale,
                    rotation: 0,
                  })
                }}
              >
                Reset to default position
              </Button>

              <p className="text-xs text-muted-foreground">
                You&apos;ll choose embellishment (screenprint, embroidery, etc.)
                and any color treatment when you generate the AI mockup on a
                specific variant.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
            label="Storefront cover image"
            hint="Optional hero shown on the catalog grid. Falls back to the first variant's image when blank."
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
              placeholder="Optional — upload a custom cover image"
              className="aspect-square w-48"
            />
          </Field>
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
                          <div className="flex items-center gap-2">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => setMockupVariantKey(v.key)}
                              disabled={
                                generatingKey !== null ||
                                !isEdit ||
                                !state.artwork_path
                              }
                              title={
                                !isEdit
                                  ? "Save the product first"
                                  : !state.artwork_path
                                    ? "Upload your design first"
                                    : "Generate a photorealistic mockup"
                              }
                              className="h-8 text-xs"
                            >
                              {generatingKey === v.key ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="mr-1 h-3 w-3" />
                              )}
                              {generatingKey === v.key ? "Generating…" : "AI mockup"}
                            </Button>
                          </div>
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
            <Link href="/products">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>

      {(() => {
        const v = state.variants.find((x) => x.key === mockupVariantKey)
        if (!v) return null
        return (
          <MockupDialog
            open={!!mockupVariantKey}
            onOpenChange={(o) => !o && setMockupVariantKey(null)}
            variantLabel={describeVariant(v.options)}
            busy={generatingKey === v.key}
            onGenerate={async (opts) => {
              await generateMockup(v, opts)
              if (generatingKey === null) setMockupVariantKey(null)
            }}
          />
        )
      })()}
    </div>
  )
}

function DesignPreview({
  baseUrl,
  artworkUrl,
  design,
  onDesignChange,
}: {
  baseUrl: string | null
  artworkUrl: string | null
  design: DesignConfig
  onDesignChange: (patch: Partial<DesignConfig>) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<{
    startX: number
    startY: number
    designX: number
    designY: number
    rect: DOMRect
  } | null>(null)

  function clamp01(n: number) {
    return Math.min(1, Math.max(0, n))
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!artworkUrl || !containerRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      designX: design.x,
      designY: design.y,
      rect,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = draggingRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) / drag.rect.width
    const dy = (e.clientY - drag.startY) / drag.rect.height
    onDesignChange({
      x: clamp01(drag.designX + dx),
      y: clamp01(drag.designY + dy),
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    draggingRef.current = null
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-[480px] select-none overflow-hidden rounded-lg bg-muted"
    >
      {baseUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={baseUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No base image
        </div>
      )}

      {artworkUrl && (
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            left: `${design.x * 100}%`,
            top: `${design.y * 100}%`,
            width: `${design.scale * 100}%`,
            aspectRatio: "1 / 1",
            transform: `translate(-50%, -50%) rotate(${design.rotation}deg)`,
            cursor: draggingRef.current ? "grabbing" : "grab",
            touchAction: "none",
          }}
          className="rounded-sm ring-1 ring-foreground/0 hover:ring-foreground/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artworkUrl}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-contain drop-shadow"
          />
        </div>
      )}
    </div>
  )
}

interface MockupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantLabel: string
  busy: boolean
  onGenerate: (options: MockupGenerationOptions) => Promise<void> | void
}

function MockupDialog({
  open,
  onOpenChange,
  variantLabel,
  busy,
  onGenerate,
}: MockupDialogProps) {
  const [embellishment, setEmbellishment] = useState<Embellishment>(
    DEFAULT_MOCKUP_OPTIONS.embellishment,
  )
  const [colorMode, setColorMode] = useState<ColorMode>(
    DEFAULT_MOCKUP_OPTIONS.colorMode,
  )
  const [inkColorHex, setInkColorHex] = useState<string>("#000000")

  async function submit() {
    await onGenerate({
      embellishment,
      colorMode,
      inkColorHex: colorMode === "single_ink" ? inkColorHex : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate AI mockup</DialogTitle>
          <DialogDescription>
            Renders a photorealistic mockup of{" "}
            <span className="font-medium">{variantLabel}</span> with your
            artwork applied. ~10–20s, costs ~$0.04 per generation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Embellishment</Label>
            <Select
              value={embellishment}
              onValueChange={(v) => setEmbellishment(v as Embellishment)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMBELLISHMENT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Color treatment</Label>
            <RadioGroup
              value={colorMode}
              onValueChange={(v) => setColorMode(v as ColorMode)}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2">
                <RadioGroupItem value="preserve" id="mockup-color-preserve" />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Preserve original colors
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Render the artwork as-is. Best for full-color logos.
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2">
                <RadioGroupItem value="single_ink" id="mockup-color-single" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Single ink color</div>
                  <div className="text-xs text-muted-foreground">
                    Replace every color in the artwork with one ink. Best for
                    screenprint on dark shirts.
                  </div>
                  {colorMode === "single_ink" && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="color"
                        value={inkColorHex}
                        onChange={(e) => setInkColorHex(e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border p-0"
                      />
                      <Input
                        value={inkColorHex}
                        onChange={(e) => setInkColorHex(e.target.value)}
                        className="h-8 max-w-[100px] font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} type="button">
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            {busy ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ArtworkDropzone({
  previewUrl,
  onSelect,
  onClear,
  onError,
}: {
  previewUrl: string | null
  onSelect: (file: File) => Promise<void>
  onClear: () => void
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)

  function openPicker() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept =
      "image/jpeg,image/png,image/webp,image/svg+xml,application/pdf"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (file.size > 20 * 1024 * 1024) {
        onError("Artwork must be under 20MB")
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

  // PDFs and SVGs can't always render inline in <img>; show a generic preview
  // tile for non-raster types.
  const isImage =
    previewUrl != null &&
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(previewUrl)

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border-2 border-dashed p-4">
      {previewUrl ? (
        <div className="flex items-center gap-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Artwork"
              className="h-24 w-24 rounded border object-contain"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
              File
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="sm" onClick={openPicker} disabled={busy}>
              {busy ? "Uploading…" : "Replace"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={busy}
              className="text-muted-foreground hover:text-red-600"
            >
              Remove
            </Button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Open
            </a>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={openPicker} disabled={busy}>
          <ImagePlus className="mr-1 h-4 w-4" />
          {busy ? "Uploading…" : "Upload artwork"}
        </Button>
      )}
    </div>
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
