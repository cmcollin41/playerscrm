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

  const [{ data: template }, { data: partners }] = await Promise.all([
    supabase.from("product_templates").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("fulfillment_partners")
      .select("id, slug, name")
      .order("name"),
  ])

  if (!template) notFound()

  return <TemplateForm partners={partners ?? []} template={template} />
}
