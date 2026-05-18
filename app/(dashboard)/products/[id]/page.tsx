import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { createArtworkSignedUrl } from "@/lib/storage/store-artwork"
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

  const [{ data: templateVariants }, { data: productVariants }] = await Promise.all([
    supabase
      .from("product_template_variants")
      .select("*")
      .eq("template_id", template.id)
      .order("ordering"),
    supabase
      .from("org_product_variants")
      .select("*")
      .eq("product_id", id)
      .order("ordering"),
  ])

  const artworkPath = (product as any).artwork_path as string | null
  const initialArtworkUrl = artworkPath
    ? (await createArtworkSignedUrl(supabase, artworkPath)) ?? null
    : null

  return (
    <OrgProductForm
      accountId={profile.account_id}
      template={template}
      templateVariants={(templateVariants ?? []) as any[]}
      product={product as any}
      productVariants={(productVariants ?? []) as any[]}
      initialArtworkUrl={initialArtworkUrl}
    />
  )
}
