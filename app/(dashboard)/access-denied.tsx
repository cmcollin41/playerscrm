"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function DashboardAccessDenied({ email }: { email: string | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          No dashboard access
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          You&apos;re signed in
          {email ? (
            <>
              {" "}as <span className="font-medium text-gray-900">{email}</span>
            </>
          ) : null}
          , but you&apos;re not a staff member of any organization. The dashboard
          is only available to coaches and admins.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          If you registered for an event, your confirmation was emailed to you.
          If you think this is a mistake, ask your organization&apos;s admin to
          add you as a member.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Sign out
        </Button>
      </div>
    </div>
  )
}
