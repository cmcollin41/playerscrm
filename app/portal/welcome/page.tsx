import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Temporary landing for the magic-link callback. PR 4 introduces the real
// /portal route group with the parent dashboard; this page exists so PR 3
// has a stable post-auth destination while we build that out.
export default async function PortalWelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/portal-login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, people_id")
    .eq("id", user.id)
    .maybeSingle()

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    user.email ||
    "there"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome, {displayName}.
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          You&apos;re signed in to the Athletes App portal. We&apos;re building
          out your dashboard — your teams, events, and invoices will show up
          here soon.
        </p>
        {profile?.people_id ? (
          <p className="mt-4 text-xs text-gray-500">
            Linked person: <code className="font-mono">{profile.people_id}</code>
          </p>
        ) : (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            We couldn&apos;t automatically link your account to a person record.
            Your program admin may need to set that up.
          </p>
        )}
      </div>
    </div>
  )
}
