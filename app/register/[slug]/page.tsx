import { cache } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getSubdomainFromHeaders } from "@/lib/tenant"
import { notFound } from "next/navigation"
import { RegisterClient } from "./register-client"

const fetchEventForSlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const subdomain = await getSubdomainFromHeaders()

  let query = supabase
    .from("events")
    .select("*, accounts!inner(id, name, stripe_id, application_fee, subdomain)")
    .eq("slug", slug)
    .eq("is_published", true)

  if (subdomain) {
    query = query.eq("accounts.subdomain", subdomain)
  }

  const { data, error } = await query.single()
  if (error || !data) return null
  return data
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await fetchEventForSlug(slug)
  if (!event) return {}

  const accountName = event.accounts?.name
  const startsAt = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const descriptionParts: string[] = []
  if (event.description) {
    descriptionParts.push(event.description)
  } else {
    if (startsAt) descriptionParts.push(startsAt)
    if (event.location) descriptionParts.push(event.location)
    descriptionParts.push(`Register${accountName ? ` with ${accountName}` : ""}.`)
  }
  const description = descriptionParts.join(" • ").slice(0, 300)

  const images = event.image_url ? [{ url: event.image_url, alt: event.name }] : undefined

  return {
    title: event.name,
    description,
    openGraph: {
      type: "website",
      title: event.name,
      description,
      images,
      siteName: accountName ?? undefined,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: event.name,
      description,
      images: event.image_url ? [event.image_url] : undefined,
    },
  }
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await fetchEventForSlug(slug)

  if (!event) notFound()

  // Check registration window
  const now = new Date()
  const regOpen = event.registration_opens_at ? new Date(event.registration_opens_at) <= now : true
  const regClosed = event.registration_closes_at ? new Date(event.registration_closes_at) < now : false
  const atCapacity = event.capacity
    ? false // We'll check actual count client-side
    : false

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        <RegisterClient
          event={event}
          account={event.accounts}
          registrationOpen={regOpen && !regClosed}
        />
      </div>
    </div>
  )
}
