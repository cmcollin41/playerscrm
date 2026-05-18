import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { OrgProductForm } from "../org-product-form"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditOrgProductPage({ params }: PageProps) {
  const { id } = await params
  const profile = await getUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const { data: product } = await supabase
    .from("org_products")
    .select(
      "*, product_templates(*, fulfillment_partners(slug, name))"
    )
    .eq("id", id)
    .eq("account_id", profile.account_id)
    .maybeSingle()

  if (!product) notFound()

  const template = (product as any).product_templates
  if (!template) notFound()

  return (
    <OrgProductForm
      accountId={profile.account_id}
      template={template}
      product={product as any}
    />
  )
}
