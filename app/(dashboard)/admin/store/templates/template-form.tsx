"use client"

import { useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  ProductCategory,
  ProductTemplates,
} from "@/types/schema.types"

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "uniform", label: "Uniform" },
  { value: "apparel", label: "Apparel" },
  { value: "accessory", label: "Accessory" },
]

interface TemplateFormProps {
  partners: Pick<FulfillmentPartners, "id" | "slug" | "name">[]
  template?: ProductTemplates
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
  image_url: string
  metadata_json: string
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

export function TemplateForm({ partners, template }: TemplateFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!template

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
    image_url: template?.image_url ?? "",
    metadata_json: template?.metadata
      ? JSON.stringify(template.metadata, null, 2)
      : "{}",
    is_active: template?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  async function handleSave() {
    if (!state.partner_id) {
      toast.error("Pick a fulfillment partner")
      return
    }
    if (!state.name.trim()) {
      toast.error("Name is required")
      return
    }

    let metadata: Record<string, any> = {}
    try {
      metadata = state.metadata_json.trim()
        ? JSON.parse(state.metadata_json)
        : {}
    } catch {
      toast.error("Metadata must be valid JSON")
      return
    }

    const slug = (state.slug.trim() || slugify(state.name.trim()))
    const payload = {
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
      image_url: state.image_url.trim() || null,
      metadata,
      is_active: state.is_active,
    }

    setSaving(true)
    if (isEdit && template) {
      const { error } = await supabase
        .from("product_templates")
        .update(payload)
        .eq("id", template.id)
      setSaving(false)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Template saved")
      router.refresh()
    } else {
      const { data, error } = await supabase
        .from("product_templates")
        .insert(payload)
        .select("id")
        .single()
      setSaving(false)
      if (error) {
        if (error.code === "23505") {
          toast.error("A template with that slug already exists")
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success("Template created")
      router.push(`/admin/store/templates/${data.id}`)
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
            <Field
              label="Slug"
              hint="URL-safe identifier. Leave blank to derive from name."
            >
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

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Base cost (USD)" hint="What the partner charges us.">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.base_cost}
                onChange={(e) => update("base_cost", e.target.value)}
                placeholder="45.00"
              />
            </Field>
            <Field
              label="Min markup (USD)"
              hint="Minimum org markup over base cost."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.min_markup}
                onChange={(e) => update("min_markup", e.target.value)}
                placeholder="5.00"
              />
            </Field>
            <Field label="Shipping (USD)" hint="Flat shipping per unit.">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={state.shipping_flat}
                onChange={(e) => update("shipping_flat", e.target.value)}
                placeholder="8.00"
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                type="number"
                min="0"
                step="1"
                value={state.lead_time_days}
                onChange={(e) => update("lead_time_days", e.target.value)}
                placeholder="21"
              />
            </Field>
          </div>

          <Field label="Image URL">
            <Input
              value={state.image_url}
              onChange={(e) => update("image_url", e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <Field
            label="Metadata (JSON)"
            hint="Free-form config (sizes, customization fields, etc.)."
          >
            <Textarea
              className="font-mono text-xs"
              rows={6}
              value={state.metadata_json}
              onChange={(e) => update("metadata_json", e.target.value)}
            />
          </Field>

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
                <Link href="/admin/store/templates">Cancel</Link>
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {isEdit ? "Save changes" : "Create template"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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
