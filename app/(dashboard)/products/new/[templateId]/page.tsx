import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { OrgProductForm } from "../../org-product-form"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ templateId: string }>
}

export default async function NewOrgProductPage({ params }: PageProps) {
  const { templateId } = await params
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const [{ data: template }, { data: templateVariants }] = await Promise.all([
    supabase
      .from("product_templates")
      .select("*, fulfillment_partners(slug, name)")
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("product_template_variants")
      .select("*")
      .eq("template_id", templateId)
      .eq("is_active", true)
      .order("ordering"),
  ])

  if (!template) notFound()

  return (
    <OrgProductForm
      accountId={profile.account_id}
      template={template as any}
      templateVariants={(templateVariants ?? []) as any[]}
    />
  )
}
