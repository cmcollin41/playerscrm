"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  ImagePlus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slug"
import {
  generateOptionCombinations,
  suggestVariantSku,
  variantOptionsKey,
  describeVariant,
} from "@/lib/store/options"
import {
  getStoreImagePublicUrl,
  makeImageFilename,
  templateImagePath,
  templateVariantImagePath,
  uploadStoreImage,
} from "@/lib/storage/store-images"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  ProductCategory,
  ProductOption,
  ProductTemplateVariants,
  ProductTemplates,
  VariantOptionMap,
} from "@/types/schema.types"

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "uniform", label: "Uniform" },
  { value: "apparel", label: "Apparel" },
  { value: "accessory", label: "Accessory" },
]

interface VariantOverride {
  id?: string
  sku: string
  delta_cost: string
  image_path: string | null
  is_active: boolean
  ordering: number
}

interface TemplateFormProps {
  partners: Pick<FulfillmentPartners, "id" | "slug" | "name">[]
  template?: ProductTemplates
  variants?: ProductTemplateVariants[]
}

interface FormState {
  partner_id: string
  slug: string
  name: string
  description: string
  category: ProductCategory
  base_cost: string
  min_markup: string
  shipping_flat: string
  lead_time_days: string
  image_path: string | null
  options: ProductOption[]
  variantOverrides: Record<string, VariantOverride>
  is_active: boolean
}

function toDollars(cents: number | undefined | null): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}

function toCents(dollars: string): number {
  const n = parseFloat(dollars)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function TemplateForm({
  partners,
  template,
  variants = [],
}: TemplateFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!template

  // Pre-generate an ID so image uploads have a stable storage path before save.
  const templateId = useRef(template?.id ?? crypto.randomUUID()).current

  // Seed override map from existing variants so we preserve their state across renders.
  const initialOverrides: Record<string, VariantOverride> = useMemo(() => {
    const map: Record<string, VariantOverride> = {}
    for (const v of variants) {
      const key = variantOptionsKey(v.options)
      map[key] = {
        id: v.id,
        sku: v.sku,
        delta_cost: toDollars(v.delta_cost_cents),
        image_path: v.image_path ?? null,
        is_active: v.is_active,
        ordering: v.ordering,
      }
    }
    return map
  }, [variants])

  const [state, setState] = useState<FormState>({
    partner_id: template?.partner_id ?? partners[0]?.id ?? "",
    slug: template?.slug ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    category: (template?.category as ProductCategory) ?? "uniform",
    base_cost: toDollars(template?.base_cost_cents),
    min_markup: toDollars(template?.min_markup_cents),
    shipping_flat: toDollars(template?.shipping_flat_cents),
    lead_time_days: template?.lead_time_days?.toString() ?? "",
    image_path: template?.image_path ?? null,
    options: template?.options ?? [],
    variantOverrides: initialOverrides,
    is_active: template?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // ---- options builder ----

  function addOption() {
    update("options", [...state.options, { name: "", values: [] }])
  }

  function updateOption(index: number, next: ProductOption) {
    update(
      "options",
      state.options.map((o, i) => (i === index ? next : o)),
    )
  }

  function removeOption(index: number) {
    update(
      "options",
      state.options.filter((_, i) => i !== index),
    )
  }

  // ---- variant table (derived from options) ----

  const combos: VariantOptionMap[] = useMemo(
    () => generateOptionCombinations(state.options),
    [state.options],
  )

  function ensureOverride(key: string, options: VariantOptionMap, idx: number): VariantOverride {
    const existing = state.variantOverrides[key]
    if (existing) return existing
    return {
      sku: suggestVariantSku(state.slug || slugify(state.name) || "v", options),
      delta_cost: "0.00",
      image_path: null,
      is_active: true,
      ordering: (idx + 1) * 10,
    }
  }

  function updateVariant(key: string, patch: Partial<VariantOverride>) {
    setState((s) => ({
      ...s,
      variantOverrides: {
        ...s.variantOverrides,
        [key]: { ...s.variantOverrides[key], ...patch } as VariantOverride,
      },
    }))
  }

  function autoSeedSkus() {
    const next: Record<string, VariantOverride> = { ...state.variantOverrides }
    combos.forEach((opts, i) => {
      const key = variantOptionsKey(opts)
      const current = next[key] ?? ensureOverride(key, opts, i)
      next[key] = {
        ...current,
        sku:
          current.sku ||
          suggestVariantSku(state.slug || slugify(state.name) || "v", opts),
        ordering: current.ordering || (i + 1) * 10,
      }
    })
    update("variantOverrides", next)
    toast.success("SKUs filled in for all variants")
  }

  // ---- image uploads ----

  async function uploadTemplateImage(file: File): Promise<string> {
    const filename = makeImageFilename(file.name)
    const path = templateImagePath(templateId, filename)
    return uploadStoreImage(supabase, path, file)
  }

  async function uploadVariantImage(key: string, file: File): Promise<string> {
    // Variant ID may not exist yet on first save — use a stable per-key uuid so
    // re-uploading replaces the same object instead of orphaning files.
    const existing = state.variantOverrides[key]
    const variantId = existing?.id ?? `pending-${key.replace(/[^a-z0-9]+/gi, "-")}`
    const filename = makeImageFilename(file.name)
    const path = templateVariantImagePath(variantId, filename)
    return uploadStoreImage(supabase, path, file)
  }

  // ---- save / delete ----

  async function handleSave() {
    if (!state.partner_id) return toast.error("Pick a fulfillment partner")
    if (!state.name.trim()) return toast.error("Name is required")
    if (combos.length === 0) {
      return toast.error("Add at least one option with values (e.g. Size: S, M, L)")
    }

    const slug = state.slug.trim() || slugify(state.name.trim())
    const templatePayload = {
      id: templateId,
      partner_id: state.partner_id,
      slug,
      name: state.name.trim(),
      description: state.description.trim() || null,
      category: state.category,
      base_cost_cents: toCents(state.base_cost),
      min_markup_cents: toCents(state.min_markup),
      shipping_flat_cents: toCents(state.shipping_flat),
      lead_time_days: state.lead_time_days
        ? parseInt(state.lead_time_days, 10)
        : null,
      image_path: state.image_path,
      options: state.options,
      is_active: state.is_active,
    }

    setSaving(true)
    const { error: tplError } = await supabase
      .from("product_templates")
      .upsert(templatePayload, { onConflict: "id" })
    if (tplError) {
      setSaving(false)
      if (tplError.code === "23505") {
        toast.error("A template with that slug already exists")
      } else {
        toast.error(tplError.message)
      }
      return
    }

    // Reconcile variants: insert/update each combo, delete rows whose SKU
    // isn't in the current set.
    const variantRows = combos.map((opts, i) => {
      const key = variantOptionsKey(opts)
      const override = ensureOverride(key, opts, i)
      return {
        template_id: templateId,
        sku: override.sku.trim() || suggestVariantSku(slug, opts),
        options: opts,
        delta_cost_cents: toCents(override.delta_cost),
        image_path: override.image_path,
        is_active: override.is_active,
        ordering: override.ordering || (i + 1) * 10,
      }
    })

    const wantedSkus = new Set(variantRows.map((v) => v.sku))
    const staleSkus = (variants ?? [])
      .filter((v) => !wantedSkus.has(v.sku))
      .map((v) => v.sku)

    if (staleSkus.length > 0) {
      await supabase
        .from("product_template_variants")
        .delete()
        .eq("template_id", templateId)
        .in("sku", staleSkus)
    }

    const { error: vError } = await supabase
      .from("product_template_variants")
      .upsert(variantRows, { onConflict: "template_id,sku" })
    setSaving(false)
    if (vError) {
      toast.error(vError.message)
      return
    }

    toast.success(isEdit ? "Template saved" : "Template created")
    if (isEdit) {
      router.refresh()
    } else {
      router.push(`/admin/store/templates/${templateId}`)
    }
  }

  async function handleDelete() {
    if (!template) return
    if (!confirm(`Delete "${template.name}"? This can't be undone.`)) return
    setDeleting(true)
    const { error } = await supabase
      .from("product_templates")
      .delete()
      .eq("id", template.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Template deleted")
    router.push("/admin/store/templates")
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/store/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All templates
      </Link>

      {/* basics */}
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit template" : "New template"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input
                value={state.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => {
                  if (!state.slug.trim() && state.name.trim()) {
                    update("slug", slugify(state.name.trim()))
                  }
                }}
                placeholder="Home Jersey"
              />
            </Field>
            <Field label="Slug" hint="URL-safe identifier.">
              <Input
                value={state.slug}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="home-jersey"
              />
            </Field>
            <Field label="Fulfillment partner">
              <Select
                value={state.partner_id}
                onValueChange={(v) => update("partner_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={state.category}
                onValueChange={(v) => update("category", v as ProductCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={state.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
            />
          </Field>

          <Field label="Hero image">
            <ImageDropzone
              value={getStoreImagePublicUrl(supabase, state.image_path) ?? null}
              onChange={(url) => {
                // dropzone gives us the URL; we want the storage path. when
                // user clears it, set to null.
                if (url == null) update("image_path", null)
              }}
              onFileSelect={async (file) => {
                const path = await uploadTemplateImage(file)
                update("image_path", path)
                return getStoreImagePublicUrl(supabase, path) ?? path
              }}
              onError={(msg) => toast.error(msg)}
              placeholder="Upload a hero image for this template"
              className="aspect-square w-48"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Base cost (USD)" hint="Partner cost per unit.">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.base_cost}
                onChange={(e) => update("base_cost", e.target.value)}
              />
            </Field>
            <Field label="Min markup (USD)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.min_markup}
                onChange={(e) => update("min_markup", e.target.value)}
              />
            </Field>
            <Field label="Shipping (USD)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.shipping_flat}
                onChange={(e) => update("shipping_flat", e.target.value)}
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                type="number"
                min="0"
                value={state.lead_time_days}
                onChange={(e) => update("lead_time_days", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive templates are hidden from orgs.
              </p>
            </div>
            <Switch
              checked={state.is_active}
              onCheckedChange={(v) => update("is_active", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* options */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Options</CardTitle>
            <CardDescription>
              Define option axes (e.g. Size, Color). Variants are generated from
              every combination of values.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="mr-1 h-4 w-4" />
            Add option
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.options.length === 0 && (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              No options yet. Add Size, Color, or whatever this product varies
              by.
            </p>
          )}
          {state.options.map((option, i) => (
            <OptionRow
              key={i}
              option={option}
              onChange={(next) => updateOption(i, next)}
              onRemove={() => removeOption(i)}
            />
          ))}
        </CardContent>
      </Card>

      {/* variants */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Variants</CardTitle>
            <CardDescription>
              {combos.length} variant{combos.length === 1 ? "" : "s"} from the
              current options.
            </CardDescription>
          </div>
          {combos.length > 0 && (
            <Button variant="outline" size="sm" onClick={autoSeedSkus}>
              <Sparkles className="mr-1 h-4 w-4" />
              Auto-fill SKUs
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {combos.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              Add option values above to generate variants.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Δ cost</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combos.map((opts, i) => {
                    const key = variantOptionsKey(opts)
                    const v = ensureOverride(key, opts, i)
                    const imageUrl =
                      getStoreImagePublicUrl(supabase, v.image_path) ?? null
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">
                          {describeVariant(opts)}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={v.sku}
                            onChange={(e) =>
                              updateVariant(key, { sku: e.target.value })
                            }
                            className="h-8 text-xs"
                            placeholder={suggestVariantSku(
                              state.slug || "v",
                              opts,
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={v.delta_cost}
                            onChange={(e) =>
                              updateVariant(key, {
                                delta_cost: e.target.value,
                              })
                            }
                            className="h-8 w-20 text-right text-xs tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <VariantImageButton
                            currentUrl={imageUrl}
                            onSelect={async (file) => {
                              const path = await uploadVariantImage(key, file)
                              updateVariant(key, { image_path: path })
                            }}
                            onClear={() =>
                              updateVariant(key, { image_path: null })
                            }
                            onError={(msg) => toast.error(msg)}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={v.is_active}
                            onCheckedChange={(c) =>
                              updateVariant(key, { is_active: c })
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
            Delete template
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/store/templates">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function OptionRow({
  option,
  onChange,
  onRemove,
}: {
  option: ProductOption
  onChange: (next: ProductOption) => void
  onRemove: () => void
}) {
  const [valueInput, setValueInput] = useState("")

  function addValue(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (option.values.includes(v)) {
      setValueInput("")
      return
    }
    onChange({ ...option, values: [...option.values, v] })
    setValueInput("")
  }

  function removeValue(v: string) {
    onChange({ ...option, values: option.values.filter((x) => x !== v) })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={option.name}
          onChange={(e) => onChange({ ...option, name: e.target.value })}
          placeholder="Option name (e.g. Size)"
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {option.values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => removeValue(v)}
              className="text-muted-foreground hover:text-red-600"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              addValue(valueInput)
            }
          }}
          onBlur={() => addValue(valueInput)}
          placeholder="Type a value, press enter"
          className="h-7 w-40 text-xs"
        />
      </div>
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
