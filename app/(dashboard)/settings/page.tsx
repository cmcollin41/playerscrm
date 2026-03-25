"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import LoadingDots from "@/components/icons/loading-dots"
import { ChevronRight, UserCircle, Building2 } from "lucide-react"

export default function SettingsHubPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [workspaceAdmin, setWorkspaceAdmin] = useState(false)
  const [activeAccountName, setActiveAccountName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_account_id, account_id")
        .eq("id", user.id)
        .single()

      const activeId = profile?.current_account_id ?? profile?.account_id ?? null
      if (!activeId || cancelled) {
        setLoading(false)
        return
      }

      const { data: rpcAccess } = await supabase.rpc("has_account_role", {
        p_account_id: activeId,
        p_min_role: "admin",
      })

      let allowed = rpcAccess === true
      if (!allowed) {
        const { data: membership } = await supabase
          .from("account_members")
          .select("role")
          .eq("account_id", activeId)
          .eq("profile_id", user.id)
          .maybeSingle()
        allowed =
          membership?.role === "admin" || membership?.role === "owner"
      }

      if (cancelled) return

      if (allowed) {
        const { data: account } = await supabase
          .from("accounts")
          .select("name")
          .eq("id", activeId)
          .single()
        if (!cancelled) setActiveAccountName(account?.name ?? null)
      }

      if (!cancelled) {
        setWorkspaceAdmin(allowed)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-10 py-8">
      <div>
        <h1 className="font-cal text-3xl font-bold dark:text-white">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-xl">
          Your personal sign-in and profile, plus workspace configuration for the account
          you’re viewing if you’re an admin.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          You
        </h2>
        <Link
          href="/settings/profile"
          className="group flex max-w-xl items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-slate-200">
            <UserCircle className="h-5 w-5 text-slate-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">Your profile</p>
            <p className="text-muted-foreground text-xs">
              Email, name, and password for your login
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600" />
        </Link>
      </section>

      {workspaceAdmin ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Workspace
          </h2>
          <Link
            href="/settings/account"
            className="group flex max-w-xl items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-gray-200">
              <Building2 className="h-5 w-5 text-gray-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">Workspace settings</p>
              <p className="text-muted-foreground text-xs">
                {activeAccountName
                  ? `Organization, fees, users, awards, Stripe, and tools for ${activeAccountName}`
                  : "Organization, fees, users, awards, payments, and admin tools"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600" />
          </Link>
        </section>
      ) : (
        <section>
          <p className="text-muted-foreground max-w-xl text-sm">
            You don’t have admin access on the current workspace. Ask an owner or admin to
            change workspace settings, or switch accounts if you manage another team.
          </p>
        </section>
      )}
    </div>
  )
}
