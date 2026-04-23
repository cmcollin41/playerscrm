"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import LoadingDots from "@/components/icons/loading-dots"
import { AlertCircle, CheckCircle2, ExternalLink, Globe, RefreshCw, Trash2 } from "lucide-react"

interface DomainStatus {
  domain: string | null
  subdomain: string | null
  verified?: boolean
  configured?: boolean
  configuredBy?: string | null
  verification?: { type: string; domain: string; value: string; reason: string }[]
}

export default function DomainSettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [status, setStatus] = useState<DomainStatus | null>(null)
  const [newDomain, setNewDomain] = useState("")
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [removing, setRemoving] = useState(false)

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"

  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_account_id, account_id")
        .eq("id", user.id)
        .single()

      const accountId = profile?.current_account_id ?? profile?.account_id
      if (!accountId) {
        router.replace("/settings")
        return
      }

      const { data: isAdmin } = await supabase.rpc("has_account_role", {
        p_account_id: accountId,
        p_min_role: "admin",
      })

      if (!isAdmin) {
        router.replace("/settings")
        return
      }

      setCanManage(true)
      await refreshStatus()
      setLoading(false)
    })()
  }, [supabase, router])

  async function refreshStatus() {
    const res = await fetch("/api/domains")
    if (res.ok) {
      setStatus(await res.json())
    }
  }

  async function handleAdd() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) return

    setSaving(true)
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to add domain")
        return
      }

      toast.success("Domain added — configure your DNS records below")
      setNewDomain("")
      await refreshStatus()
    } catch {
      toast.error("Failed to add domain")
    } finally {
      setSaving(false)
    }
  }

  async function handleVerify() {
    setVerifying(true)
    try {
      const res = await fetch("/api/domains", { method: "PATCH" })
      const data = await res.json()

      if (data.verified) {
        toast.success("Domain verified!")
      } else {
        toast("Domain not verified yet — check your DNS records")
      }
      await refreshStatus()
    } catch {
      toast.error("Failed to verify domain")
    } finally {
      setVerifying(false)
    }
  }

  async function handleRemove() {
    if (!confirm("Remove this custom domain? Your subdomain will still work.")) return

    setRemoving(true)
    try {
      const res = await fetch("/api/domains", { method: "DELETE" })
      if (res.ok) {
        toast.success("Domain removed")
        await refreshStatus()
      } else {
        toast.error("Failed to remove domain")
      }
    } catch {
      toast.error("Failed to remove domain")
    } finally {
      setRemoving(false)
    }
  }

  if (loading || !canManage) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-8 py-8">
      <div>
        <Link
          href="/settings/account"
          className="text-muted-foreground mb-3 inline-block text-sm hover:text-gray-900"
        >
          &larr; Workspace settings
        </Link>
        <h1 className="font-cal text-3xl font-bold">Custom domain</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Use your own domain instead of{" "}
          <span className="font-mono text-gray-700">
            {status?.subdomain || "your-team"}.{rootDomain}
          </span>
        </p>
      </div>

      {/* Current subdomain */}
      {status?.subdomain && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Default subdomain</h2>
          <p className="flex items-center gap-2 font-mono text-sm text-gray-700">
            <Globe className="h-4 w-4 text-gray-400" />
            {status.subdomain}.{rootDomain}
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Active
            </span>
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            This always works, even with a custom domain configured.
          </p>
        </div>
      )}

      {/* Custom domain config */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Custom domain</h2>

        {!status?.domain ? (
          <div>
            <p className="text-muted-foreground mb-4 text-sm">
              Point your own domain to this workspace. Your visitors will see your domain in the
              URL bar.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="app.yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newDomain.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? <LoadingDots color="#fff" /> : "Add domain"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Domain with status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <span className="font-mono text-sm text-gray-900">{status.domain}</span>
                {status.verified && status.configured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    <AlertCircle className="h-3 w-3" /> Pending
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${verifying ? "animate-spin" : ""}`} />
                  Verify
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </div>

            {/* DNS instructions */}
            {(!status.verified || !status.configured) && (
              <div className="rounded-md border border-amber-100 bg-amber-50 p-4">
                <h3 className="mb-2 text-sm font-medium text-amber-900">
                  Configure your DNS
                </h3>
                <p className="mb-3 text-xs text-amber-800">
                  Add the following record in your domain&apos;s DNS settings, then click Verify.
                </p>
                <div className="overflow-x-auto rounded border border-amber-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-amber-100 bg-amber-50/50">
                        <th className="px-3 py-2 font-medium text-amber-900">Type</th>
                        <th className="px-3 py-2 font-medium text-amber-900">Name</th>
                        <th className="px-3 py-2 font-medium text-amber-900">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 font-mono">CNAME</td>
                        <td className="px-3 py-2 font-mono">{status.domain}</td>
                        <td className="px-3 py-2 font-mono">cname.vercel-dns.com</td>
                      </tr>
                      {status.verification?.map((v, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-mono">{v.type}</td>
                          <td className="px-3 py-2 font-mono">{v.domain}</td>
                          <td className="break-all px-3 py-2 font-mono">{v.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  DNS changes can take up to 48 hours to propagate.
                </p>
              </div>
            )}

            {/* Success state */}
            {status.verified && status.configured && (
              <div className="rounded-md border border-green-100 bg-green-50 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Domain is active</p>
                    <p className="mt-1 text-xs text-green-700">
                      Your custom domain is verified and serving traffic.
                    </p>
                    <a
                      href={`https://${status.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900"
                    >
                      Visit {status.domain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
