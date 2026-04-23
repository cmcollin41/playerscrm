"use client"

import LoadingDots from "@/components/icons/loading-dots"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  DollarSign,
  Globe,
  Mail,
  RefreshCw,
  Trophy,
  Users,
} from "lucide-react"

export default function AccountSettingsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const scope = searchParams.get("scope")
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  const [connecting, setConnecting] = useState(false)
  const [user, setUser] = useState<any>()
  const [canManage, setCanManage] = useState(false)
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
    const load = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) {
        router.replace("/login")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single()

      if (profileError || !profile) {
        router.replace("/")
        return
      }

      const activeAccountId =
        profile.current_account_id ?? profile.account_id ?? null
      if (!activeAccountId) {
        router.replace("/settings")
        return
      }

      const { data: rpcAccess } = await supabase.rpc("has_account_role", {
        p_account_id: activeAccountId,
        p_min_role: "admin",
      })

      let allowed = rpcAccess === true
      if (!allowed) {
        const { data: membership } = await supabase
          .from("account_members")
          .select("role")
          .eq("account_id", activeAccountId)
          .eq("profile_id", u.id)
          .maybeSingle()
        allowed =
          membership?.role === "admin" || membership?.role === "owner"
      }

      if (!allowed) {
        router.replace("/settings")
        return
      }

      const { data: account } = await supabase
        .from("accounts")
        .select("*, senders(*)")
        .eq("id", activeAccountId)
        .single()

      setCanManage(true)
      setUser({ ...profile, account_id: activeAccountId, accounts: account })
      setStripeConnected(account?.stripe_id)
    }

    load()
  }, [supabase, router])

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
          const accountId = user?.current_account_id || user?.account_id
          const { data: updateAccount, error } = await supabase
            .from("accounts")
            .update({ stripe_id: resp.connected_account_id })
            .eq("id", accountId)
            .select()

          if (error) toast("Error connecting stripe.")
          setStripeConnected(updateAccount?.[0]?.stripe_id)
        }
        setConnecting(false)
      }

      connectPlatformAccount()
    }
  }, [scope, code, state, user, supabase])

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

  if (!canManage || !user) {
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

  const accountItems = [
    {
      href: "/settings/organization",
      icon: Building2,
      title: "Organization",
      description: "Accounts under your organization (if applicable)",
    },
    {
      href: "/settings/fees",
      icon: DollarSign,
      title: "Fees",
      description: "Fees for teams and athletes in this workspace",
    },
    {
      href: "/settings/users",
      icon: Users,
      title: "Users & roles",
      description: "Who can access this workspace and their permissions",
    },
    {
      href: "/settings/awards",
      icon: Trophy,
      title: "Award types",
      description: "Standard awards for player recognition",
    },
    {
      href: "/settings/email",
      icon: Mail,
      title: "Email sending",
      description: "Verify sending domains and manage sender addresses",
    },
    {
      href: "/settings/domain",
      icon: Globe,
      title: "Custom domain",
      description: "Use your own domain for public-facing pages",
    },
  ]

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""

  return (
    <div className="flex flex-col space-y-8 py-8">
      <div>
        <Link
          href="/settings"
          className="text-muted-foreground mb-3 inline-block text-sm hover:text-gray-900"
        >
          ← All settings
        </Link>
        <h1 className="font-cal text-3xl font-bold dark:text-white">
          Workspace settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Billing, members, and configuration for{" "}
          <span className="font-medium text-gray-800">
            {user?.accounts?.name || "this account"}
          </span>
          . You need admin access on this workspace to view this page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {accountItems.map((item) => (
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
        <h2 className="mb-3 text-lg font-semibold">Payments</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {!stripeConnected && (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <DollarSign className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                Connect a Stripe account
              </h3>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                Connect Stripe to collect fees, send invoices, and accept payments.
              </p>
              <button
                disabled={connecting}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
                onClick={() => {
                  if (window) {
                    setConnecting(true)
                    const redirectUri = `${baseUrl}/settings/account`
                    const url = `https://dashboard.stripe.com/oauth/authorize?response_type=code&client_id=${
                      process.env.NEXT_PUBLIC_STRIPE_OAUTH_CLIENT_ID
                    }&scope=read_write&state=${
                      Math.random() * 100
                    }&redirect_uri=${encodeURIComponent(redirectUri)}`

                    window.document.location.href = url
                  }
                }}
              >
                {connecting ? (
                  <LoadingDots color="#fff" />
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                    </svg>
                    Connect Stripe
                  </>
                )}
              </button>
            </div>
          )}

          {stripeConnected && (
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {stripeAccount?.business_profile?.name ||
                    stripeAccount?.business_profile?.url ||
                    stripeAccount?.email ||
                    "Connected"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{stripeAccount?.id}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${stripeAccount?.payouts_enabled ? "bg-green-500" : "bg-amber-500"}`}
                    />
                    Payouts {stripeAccount?.payouts_enabled ? "enabled" : "pending"}
                  </span>
                  <span className="capitalize">{stripeAccount?.type} account</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Data tools</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Reconcile invoice statuses
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Syncs sent invoices with Stripe payment status.
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
              {reconciling ? "Reconciling…" : "Run now"}
            </button>
          </div>

          {reconcileResult && (
            <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <p>
                {!reconcileResult.done && (
                  <span className="mr-2 text-amber-600">Processing…</span>
                )}
                Progress: <strong>{reconcileResult.totalChecked}</strong> / {reconcileResult.total}{" "}
                &middot; Updated: <strong>{reconcileResult.totalUpdated}</strong> &middot; Errors:{" "}
                <strong>{reconcileResult.totalErrors}</strong>
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
                    {reconcileResult.results.filter((r: any) => r.newStatus).length > 10 && (
                      <li className="text-gray-400">
                        …and{" "}
                        {reconcileResult.results.filter((r: any) => r.newStatus).length - 10}{" "}
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
