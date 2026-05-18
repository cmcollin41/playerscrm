import { createClient } from "@/lib/supabase/server"
import { TemplateForm } from "../template-form"

export const dynamic = "force-dynamic"

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const { data: partners } = await supabase
    .from("fulfillment_partners")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("name")

  return <TemplateForm partners={partners ?? []} />
}
