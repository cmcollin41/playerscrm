import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { RegisterClient } from "./register-client"

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch published event by slug (uses anon policy)
  const { data: event, error } = await supabase
    .from("events")
    .select("*, accounts(id, name, stripe_id, application_fee)")
    .eq("slug", slug)
    .eq("is_published", true)
    .single()

  if (error || !event) notFound()

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
