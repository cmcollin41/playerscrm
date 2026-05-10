import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { getSubdomainFromHeaders } from "@/lib/tenant"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Check } from "lucide-react"

const fetchEventForSlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const subdomain = await getSubdomainFromHeaders()

  let query = supabase
    .from("events")
    .select("name, slug, accounts!inner(name, subdomain)")
    .eq("slug", slug)
    .eq("is_published", true)

  if (subdomain) {
    query = query.eq("accounts.subdomain", subdomain)
  }

  const { data, error } = await query.single()
  if (error || !data) return null
  return data
})

export default async function RegisterSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await fetchEventForSlug(slug)
  if (!event) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Payment received</h3>
            <p className="mt-2 text-sm text-gray-500">
              You&apos;re all set for {event.name}. We&apos;ll send confirmation details to your email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
