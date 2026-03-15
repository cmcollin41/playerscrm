"use client"

import LoadingDots from "@/components/icons/loading-dots"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  ChevronRight,
  DollarSign,
  RefreshCw,
  Users,
} from "lucide-react"

export default function SettingsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const scope = searchParams.get("scope")
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  const [connecting, setConnecting] = useState(false)
  const [user, setUser] = useState<any>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [stripeConnected, setStripeConnected] = useState<string | undefined>()
  const [stripeAccount, setStripeAccount] = useState<any>()
  const [reconciling, setReconciling] = useState(false)
  const [reconcileResult, setReconcileResult] = useState<{
    totalChecked: number
    totalUpdated: number
    totalErrors: number
    total: number
    done: boolean
    results: any[]
  } | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts(*, senders(*))")
        .eq("id", user?.id)
        .single()

      if (profileError) throw profileError

      if (profile.role !== "admin") {
        router.replace("/")
        return
      }

      setIsAdmin(true)
      setUser(profile)
      setStripeConnected(profile.accounts.stripe_id)
    }

    getUser()
  }, [])

  useEffect(() => {
    if (scope && code && state && user) {
      setConnecting(true)
      const connectPlatformAccount = async () => {
        const response = await fetch("/api/connect", {
          method: "POST",
          body: JSON.stringify({ scope, code, state }),
        })

        if (response.status === 200) {
          const resp = await response.json()
          const { data: updateAccount, error } = await supabase
            .from("accounts")
            .update({ stripe_id: resp.connected_account_id })
            .eq("id", user?.account_id)
            .select()

          if (error) toast("Error connecting stripe.")
          setStripeConnected(updateAccount?.[0]?.stripe_id)
        }
        setConnecting(false)
      }

      connectPlatformAccount()
    }
  }, [scope, code, state, user])

  useEffect(() => {
    if (!stripeConnected) return
    const getAccounts = async () => {
      const response = await fetch("/api/connect/account", {
        method: "POST",
        body: JSON.stringify({ account_id: stripeConnected }),
      })
      const account = await response.json()
      setStripeAccount(account)
    }
    getAccounts()
  }, [stripeConnected])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  async function handleReconcile() {
    setReconciling(true)
    setReconcileResult(null)

    let offset = 0
    let totalChecked = 0
    let totalUpdated = 0
    let totalErrors = 0
    let total = 0
    const allResults: any[] = []

    try {
      while (true) {
        const res = await fetch("/api/admin/reconcile-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        })
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error || "Reconciliation failed")
          return
        }

        totalChecked += data.checked
        totalUpdated += data.updated
        totalErrors += data.errors
        total = data.total
        allResults.push(...(data.results || []))

        setReconcileResult({
          totalChecked,
          totalUpdated,
          totalErrors,
          total,
          done: data.done,
          results: allResults,
        })

        if (data.done || !data.nextOffset) break
        offset = data.nextOffset
      }

      if (totalUpdated > 0) {
        toast.success(`Updated ${totalUpdated} invoice${totalUpdated === 1 ? "" : "s"} from Stripe`)
      } else {
        toast("All invoices are already in sync with Stripe")
      }
    } catch {
      toast.error("Failed to run reconciliation")
    } finally {
      setReconciling(false)
    }
  }

  const items = [
    {
      href: "/settings/fees",
      icon: DollarSign,
      title: "Fees",
      description: "Create and manage fees for your teams and athletes",
    },
    {
      href: "/settings/users",
      icon: Users,
      title: "Users & Roles",
      description: "Manage who has access and what they can do",
    },
  ]

  return (
    <div className="flex flex-col space-y-8 py-8">
      <div>
        <h1 className="font-cal text-3xl font-bold dark:text-white">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your organization settings
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 group-hover:bg-gray-200">
              <item.icon className="h-5 w-5 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <p className="text-muted-foreground text-xs">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600" />
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Stripe Integration</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <span className="inline-block rounded bg-blue-400 px-3 py-1 text-xs font-medium text-white">
            Stripe
          </span>

          {!stripeConnected && (
            <button
              disabled={connecting}
              className="mx-3 mb-2 mt-6 w-auto rounded bg-[#77dd77] px-4 py-2 text-black shadow"
              onClick={() => {
                if (window) {
                  setConnecting(true)
                  const url = `https://dashboard.stripe.com/oauth/authorize?response_type=code&client_id=${
                    process.env.NEXT_PUBLIC_STRIPE_OAUTH_CLIENT_ID
                  }&scope=read_write&state=${
                    Math.random() * 100
                  }&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/settings`

                  window.document.location.href = url
                }
              }}
            >
              {connecting ? (
                <LoadingDots color="#808080" />
              ) : (
                <span>Connect Stripe</span>
              )}
            </button>
          )}

          {stripeConnected && (
            <>
              <h3 className="mt-4 text-xl font-bold text-gray-900">
                {stripeAccount?.business_profile?.name ||
                  stripeAccount?.business_profile?.url ||
                  stripeAccount?.email}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {stripeAccount?.id}
                </span>
              </h3>
              <p className="mt-1.5 text-sm text-gray-600">
                Payouts Enabled:{" "}
                <span className="text-gray-500">
                  {stripeAccount?.payout_enabled ? "true" : "false"}
                </span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Type:{" "}
                <span className="text-gray-500">{stripeAccount?.type}</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Data Tools</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Reconcile Invoice Statuses
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Checks Stripe for actual payment status on all &quot;sent&quot;
                invoices and updates any that have been paid. Run this if
                invoice statuses appear out of sync.
              </p>
            </div>
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`}
              />
              {reconciling ? "Reconciling…" : "Run Now"}
            </button>
          </div>

          {reconcileResult && (
            <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <p>
                {!reconcileResult.done && (
                  <span className="mr-2 text-amber-600">Processing…</span>
                )}
                Progress: <strong>{reconcileResult.totalChecked}</strong> / {reconcileResult.total} &middot;
                Updated: <strong>{reconcileResult.totalUpdated}</strong> &middot;
                Errors: <strong>{reconcileResult.totalErrors}</strong>
              </p>
              {reconcileResult.results?.filter((r: any) => r.newStatus).length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-gray-700">Updated:</p>
                  <ul className="mt-1 space-y-1">
                    {reconcileResult.results
                      .filter((r: any) => r.newStatus)
                      .slice(0, 10)
                      .map((r: any) => (
                        <li key={r.invoiceId}>
                          {r.invoiceId.slice(0, 8)}… {r.oldStatus} → {r.newStatus}
                        </li>
                      ))}
                    {reconcileResult.results.filter((r: any) => r.newStatus)
                      .length > 10 && (
                      <li className="text-gray-400">
                        …and{" "}
                        {reconcileResult.results.filter((r: any) => r.newStatus)
                          .length - 10}{" "}
                        more
                      </li>
                    )}
                  </ul>
                </>
              )}
              {reconcileResult.results?.filter((r: any) => r.error).length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium text-red-600">Errors:</p>
                  <ul className="mt-1 space-y-1">
                    {reconcileResult.results
                      .filter((r: any) => r.error)
                      .slice(0, 5)
                      .map((r: any) => (
                        <li key={r.invoiceId} className="text-red-500">
                          {r.invoiceId.slice(0, 8)}… — {r.error}
                        </li>
                      ))}
                    {reconcileResult.results.filter((r: any) => r.error)
                      .length > 5 && (
                      <li className="text-gray-400">
                        …and{" "}
                        {reconcileResult.results.filter((r: any) => r.error)
                          .length - 5}{" "}
                        more with same error
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
