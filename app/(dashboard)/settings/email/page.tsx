"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import LoadingDots from "@/components/icons/loading-dots"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from "lucide-react"

interface SenderDomain {
  id: string
  domain: string
  verification_status: string
  dns_records: any[]
  resend_domain_id: string
  created_at: string
}

interface Sender {
  id: string
  name: string
  email: string
  verified: boolean
  created_at: string
}

export default function EmailSettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [domains, setDomains] = useState<SenderDomain[]>([])
  const [senders, setSenders] = useState<Sender[]>([])

  // Domain form
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [addingDomain, setAddingDomain] = useState(false)

  // Sender form
  const [showSenderForm, setShowSenderForm] = useState(false)
  const [newSenderName, setNewSenderName] = useState("")
  const [newSenderEmail, setNewSenderEmail] = useState("")
  const [addingSender, setAddingSender] = useState(false)

  const [verifyingId, setVerifyingId] = useState<string | null>(null)

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
      await refreshData()
      setLoading(false)
    })()
  }, [supabase, router])

  async function refreshData() {
    const res = await fetch("/api/sender-domains")
    if (res.ok) {
      const data = await res.json()
      setDomains(data.domains)
      setSenders(data.senders)
    }
  }

  async function handleAddDomain() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) return

    setAddingDomain(true)
    try {
      const res = await fetch("/api/sender-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_domain", domain }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to add domain")
        return
      }

      toast.success("Domain added — configure the DNS records below")
      setNewDomain("")
      setShowDomainForm(false)
      await refreshData()
    } catch {
      toast.error("Failed to add domain")
    } finally {
      setAddingDomain(false)
    }
  }

  async function handleVerifyDomain(domainId: string) {
    setVerifyingId(domainId)
    try {
      const res = await fetch("/api/sender-domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domainId }),
      })
      const data = await res.json()

      if (data.status === "verified") {
        toast.success("Domain verified!")
      } else {
        toast("Domain not verified yet — check your DNS records")
      }
      await refreshData()
    } catch {
      toast.error("Verification failed")
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleDeleteDomain(domainId: string) {
    if (!confirm("Remove this domain? Associated senders will also be removed."))
      return

    try {
      const res = await fetch("/api/sender-domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "domain", id: domainId }),
      })
      if (res.ok) {
        toast.success("Domain removed")
        await refreshData()
      }
    } catch {
      toast.error("Failed to remove domain")
    }
  }

  async function handleAddSender() {
    if (!newSenderName.trim() || !newSenderEmail.trim()) return

    setAddingSender(true)
    try {
      const res = await fetch("/api/sender-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_sender",
          name: newSenderName.trim(),
          email: newSenderEmail.trim().toLowerCase(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Failed to add sender")
        return
      }

      toast.success("Sender added")
      setNewSenderName("")
      setNewSenderEmail("")
      setShowSenderForm(false)
      await refreshData()
    } catch {
      toast.error("Failed to add sender")
    } finally {
      setAddingSender(false)
    }
  }

  async function handleDeleteSender(senderId: string) {
    if (!confirm("Remove this sender?")) return

    try {
      const res = await fetch("/api/sender-domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sender", id: senderId }),
      })
      if (res.ok) {
        toast.success("Sender removed")
        await refreshData()
      }
    } catch {
      toast.error("Failed to remove sender")
    }
  }

  if (loading || !canManage) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  const verifiedDomains = domains.filter(
    (d) => d.verification_status === "verified",
  )

  return (
    <div className="flex flex-col space-y-8 py-8">
      <div>
        <Link
          href="/settings/account"
          className="text-muted-foreground mb-3 inline-block text-sm hover:text-gray-900"
        >
          &larr; Workspace settings
        </Link>
        <h1 className="font-cal text-3xl font-bold">Email settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Verify your domain and manage sender addresses for this workspace.
        </p>
      </div>

      {/* Sending Domains */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sending domains</h2>
          <button
            onClick={() => setShowDomainForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-gray-800"
          >
            <Plus className="h-3 w-3" />
            Add domain
          </button>
        </div>

        {showDomainForm && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Add sending domain
              </h3>
              <button
                onClick={() => {
                  setShowDomainForm(false)
                  setNewDomain("")
                }}
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-muted-foreground mb-3 text-xs">
              Enter the domain you want to send emails from (e.g.
              provobasketball.com).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
              <button
                onClick={handleAddDomain}
                disabled={addingDomain || !newDomain.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {addingDomain ? <LoadingDots color="#fff" /> : "Add"}
              </button>
            </div>
          </div>
        )}

        {domains.length === 0 && !showDomainForm ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <Server className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              No sending domains
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Add a domain to start sending emails from your own address.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {domain.domain}
                    </span>
                    {domain.verification_status === "verified" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.verification_status !== "verified" && (
                      <button
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={verifyingId === domain.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${verifyingId === domain.id ? "animate-spin" : ""}`}
                        />
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteDomain(domain.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* DNS Records */}
                {domain.verification_status !== "verified" &&
                  domain.dns_records &&
                  domain.dns_records.length > 0 && (
                    <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3">
                      <p className="mb-2 text-xs font-medium text-amber-900">
                        Add these DNS records to verify your domain:
                      </p>
                      <div className="overflow-x-auto rounded border border-amber-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-amber-100 bg-amber-50/50">
                              <th className="px-3 py-2 font-medium text-amber-900">
                                Type
                              </th>
                              <th className="px-3 py-2 font-medium text-amber-900">
                                Name
                              </th>
                              <th className="px-3 py-2 font-medium text-amber-900">
                                Value
                              </th>
                              <th className="px-3 py-2 font-medium text-amber-900">
                                Priority
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {domain.dns_records.map((record: any, i: number) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-3 py-2 font-mono">
                                  {record.type || record.record_type}
                                </td>
                                <td className="break-all px-3 py-2 font-mono">
                                  {record.name}
                                </td>
                                <td className="break-all px-3 py-2 font-mono">
                                  {record.value}
                                </td>
                                <td className="px-3 py-2 font-mono">
                                  {record.priority || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-amber-700">
                        DNS changes can take up to 72 hours to propagate. Click
                        Verify to check.
                      </p>
                    </div>
                  )}

                {domain.verification_status === "verified" && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    You can now add sender addresses using @{domain.domain}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sender Addresses */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sender addresses</h2>
          {verifiedDomains.length > 0 && (
            <button
              onClick={() => setShowSenderForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-gray-800"
            >
              <Plus className="h-3 w-3" />
              Add sender
            </button>
          )}
        </div>

        {showSenderForm && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Add sender address
              </h3>
              <button
                onClick={() => {
                  setShowSenderForm(false)
                  setNewSenderName("")
                  setNewSenderEmail("")
                }}
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Display name (e.g. Provo Basketball)"
                value={newSenderName}
                onChange={(e) => setNewSenderName(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
              <div className="flex flex-1 gap-2">
                <input
                  type="email"
                  placeholder="info@yourdomain.com"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSender()}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                <button
                  onClick={handleAddSender}
                  disabled={
                    addingSender ||
                    !newSenderName.trim() ||
                    !newSenderEmail.trim()
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  {addingSender ? <LoadingDots color="#fff" /> : "Add"}
                </button>
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              The email must use a verified domain (
              {verifiedDomains.map((d) => d.domain).join(", ")}).
            </p>
          </div>
        )}

        {senders.length === 0 && !showSenderForm ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              No sender addresses
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {verifiedDomains.length > 0
                ? "Add a sender to start sending emails."
                : "Verify a domain first, then add sender addresses."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {senders.map((sender) => (
              <div
                key={sender.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sender.name}
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      {sender.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSender(sender.id)}
                  className="inline-flex items-center rounded-md border border-red-200 bg-white p-1.5 text-red-600 shadow-sm hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="mb-1 text-sm font-medium text-gray-900">
          How email sending works
        </h3>
        <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-xs">
          <li>Add your domain (e.g. provobasketball.com)</li>
          <li>Add the DNS records to your domain registrar</li>
          <li>Click Verify to confirm the records are set</li>
          <li>
            Add sender addresses (e.g. info@provobasketball.com) — these are the
            &quot;from&quot; addresses for your emails
          </li>
        </ol>
      </div>
    </div>
  )
}
