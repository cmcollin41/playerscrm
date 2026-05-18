import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TemplateForm } from "../template-form"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: template }, { data: partners }, { data: variants }] = await Promise.all([
    supabase.from("product_templates").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("fulfillment_partners")
      .select("id, slug, name")
      .order("name"),
    supabase
      .from("product_template_variants")
      .select("*")
      .eq("template_id", id)
      .order("ordering", { ascending: true }),
  ])

  if (!template) notFound()

  return (
    <TemplateForm
      partners={partners ?? []}
      template={template as any}
      variants={(variants ?? []) as any[]}
    />
  )
}
