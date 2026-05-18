"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slug"
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
import type {
  FulfillmentPartners,
  OrgProducts,
  OrgProductStatus,
  ProductTemplates,
} from "@/types/schema.types"

type TemplateWithPartner = ProductTemplates & {
  fulfillment_partners?: Pick<FulfillmentPartners, "slug" | "name">
}

interface OrgProductFormProps {
  accountId: string
  template: TemplateWithPartner
  product?: OrgProducts
}

interface FormState {
  slug: string
  name: string
  description: string
  price: string
  status: OrgProductStatus
  image_url: string
  customization: Record<string, string>
}

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function toCents(dollars: string): number {
  const n = parseFloat(dollars)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

// Map a customization field name to a sensible input type. Keep names that end
// in `_color`, `_url`, etc. mapped to dedicated inputs; everything else is plain
// text. The template author controls field names via metadata.customizable.
function fieldKind(name: string): "color" | "url" | "text" {
  if (name.endsWith("_color")) return "color"
  if (name.endsWith("_url")) return "url"
  return "text"
}

function humanizeField(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\burl\b/i, "URL")
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function OrgProductForm({
  accountId,
  template,
  product,
}: OrgProductFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!product

  const customizableFields: string[] = useMemo(() => {
    const raw = (template.metadata as any)?.customizable
    return Array.isArray(raw) ? raw.filter((x: any) => typeof x === "string") : []
  }, [template])

  const minPriceCents = template.base_cost_cents + template.min_markup_cents

  const [state, setState] = useState<FormState>({
    slug: product?.slug ?? "",
    name: product?.name ?? template.name,
    description: product?.description ?? template.description ?? "",
    price: toDollars(product?.price_cents ?? minPriceCents),
    status: product?.status ?? "draft",
    image_url: product?.image_url ?? template.image_url ?? "",
    customization: customizableFields.reduce<Record<string, string>>((acc, f) => {
      const existing = (product?.customization as any)?.[f]
      acc[f] = existing != null ? String(existing) : ""
      return acc
    }, {}),
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

  async function handleSave() {
    if (!state.name.trim()) {
      toast.error("Name is required")
      return
    }
    const priceCents = toCents(state.price)
    if (priceCents < minPriceCents) {
      toast.error(
        `Price must be at least $${(minPriceCents / 100).toFixed(2)} (base + min markup)`
      )
      return
    }

    const slug = state.slug.trim() || slugify(state.name.trim())
    const payload = {
      account_id: accountId,
      template_id: template.id,
      slug,
      name: state.name.trim(),
      description: state.description.trim() || null,
      price_cents: priceCents,
      customization: state.customization,
      image_url: state.image_url.trim() || null,
      status: state.status,
      published_at:
        state.status === "active"
          ? (product?.published_at ?? new Date().toISOString())
          : null,
    }

    setSaving(true)
    if (isEdit && product) {
      const { error } = await supabase
        .from("org_products")
        .update(payload)
        .eq("id", product.id)
      setSaving(false)
      if (error) {
        if (error.code === "23505") {
          toast.error("A product with that slug already exists in your account")
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success("Product saved")
      router.refresh()
    } else {
      const { data, error } = await supabase
        .from("org_products")
        .insert(payload)
        .select("id")
        .single()
      setSaving(false)
      if (error) {
        if (error.code === "23505") {
          toast.error("A product with that slug already exists in your account")
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success("Product created")
      router.push(`/store/manage/products/${data.id}`)
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

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? state.name : `New: ${template.name}`}</CardTitle>
          <CardDescription>
            Template: {template.name} · Partner: {partnerName} · Category:{" "}
            <span className="capitalize">{template.category}</span>
            {" · "}
            Base cost ${toDollars(template.base_cost_cents)} + shipping $
            {toDollars(template.shipping_flat_cents)}
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
                placeholder="2026 Home Jersey"
              />
            </Field>
            <Field
              label="Slug"
              hint="Used in URLs. Unique within your account."
            >
              <Input
                value={state.slug}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="2026-home-jersey"
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

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Sell price (USD)"
              hint={`Minimum $${(minPriceCents / 100).toFixed(2)} (base + min markup).`}
            >
              <Input
                type="number"
                step="0.01"
                min={(minPriceCents / 100).toFixed(2)}
                value={state.price}
                onChange={(e) => update("price", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select
                value={state.status}
                onValueChange={(v) => update("status", v as OrgProductStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (hidden)</SelectItem>
                  <SelectItem value="active">Active (published)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Override image URL"
            hint="Defaults to the template image when left blank."
          >
            <Input
              value={state.image_url}
              onChange={(e) => update("image_url", e.target.value)}
              placeholder="https://..."
            />
          </Field>

          {customizableFields.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-medium">Customization</p>
              <div className="grid gap-4 md:grid-cols-2">
                {customizableFields.map((field) => (
                  <CustomizationField
                    key={field}
                    name={field}
                    value={state.customization[field] ?? ""}
                    onChange={(v) => updateCustom(field, v)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              {isEdit && (
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/store/manage/products">Cancel</Link>
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {isEdit ? "Save changes" : "Create product"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CustomizationField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (v: string) => void
}) {
  const kind = fieldKind(name)
  const label = humanizeField(name)

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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
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
