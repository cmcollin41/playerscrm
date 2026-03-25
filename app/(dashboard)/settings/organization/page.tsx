"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import LoadingDots from "@/components/icons/loading-dots"
import { ArrowLeft, Building2, Plus, Upload } from "lucide-react"
import {
  ORGANIZATION_LOGOS_BUCKET,
  getOrganizationLogoPublicUrl,
  organizationLogoStoragePath,
} from "@/lib/storage/organization-logo"

const SPORTS = [
  { value: "basketball", label: "Basketball" },
  { value: "football", label: "Football" },
  { value: "baseball", label: "Baseball" },
  { value: "soccer", label: "Soccer" },
  { value: "volleyball", label: "Volleyball" },
  { value: "track-and-field", label: "Track & Field" },
  { value: "wrestling", label: "Wrestling" },
  { value: "swimming", label: "Swimming" },
] as const

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
])

function logoContentTypeForUpload(file: File): string | null {
  if (LOGO_MIME.has(file.type)) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "svg") return "image/svg+xml"
  return null
}

interface Organization {
  id: string
  name: string
  slug: string
  sport?: string
  logo?: string | null
}

interface OrgMembership {
  role: string
}

interface Account {
  id: string
  name: string
  sport?: string
  created_at: string
}

export default function OrganizationSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newSport, setNewSport] = useState("")
  const [creating, setCreating] = useState(false)
  const [membership, setMembership] = useState<OrgMembership | null>(null)
  const [canCreateAccount, setCanCreateAccount] = useState(false)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoImageFailed, setLogoImageFailed] = useState(false)
  const [logoImageLoaded, setLogoImageLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canManageLogo =
    membership?.role === "admin" || membership?.role === "owner"

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      const res = await fetch("/api/admin/organization")
      if (res.status === 403) {
        router.replace("/")
        return
      }
      if (!res.ok) {
        toast.error("Failed to load organization data")
        setLoading(false)
        return
      }

      const data = await res.json()
      setOrganization(data.organization)
      setAccounts(data.accounts || [])
      setMembership(data.membership ?? null)
      setCanCreateAccount(!!data.canCreateAccount)
      setLoading(false)
    }

    init()
  }, [router, supabase])

  useEffect(() => {
    setLogoImageFailed(false)
    setLogoImageLoaded(false)
  }, [organization?.id, organization?.logo])

  async function handleLogoFile(file: File) {
    if (!organization || !canManageLogo) return
    const contentType = logoContentTypeForUpload(file)
    if (!contentType) {
      toast.error("Use SVG, JPEG, PNG, WebP, or GIF")
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be 2 MB or smaller")
      return
    }

    setLogoSaving(true)
    const path = `${organization.id}/logo`

    try {
      if (organization.logo) {
        await supabase.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([organization.logo])
      }

      const { error: uploadError } = await supabase.storage
        .from(ORGANIZATION_LOGOS_BUCKET)
        .upload(path, file, { upsert: true, contentType })

      if (uploadError) {
        toast.error(uploadError.message)
        return
      }

      const { data: updated, error: updateError } = await supabase
        .from("organizations")
        .update({ logo: path })
        .eq("id", organization.id)
        .select("logo")
        .maybeSingle()

      if (updateError) {
        toast.error(updateError.message)
        return
      }

      if (!updated?.logo) {
        toast.error(
          "File uploaded, but the logo path was not saved. Ensure you are an organization owner or admin.",
        )
        return
      }

      setOrganization((prev) => (prev ? { ...prev, logo: path } : prev))
      setLogoImageFailed(false)
      setLogoImageLoaded(false)
      toast.success("Logo updated")
    } finally {
      setLogoSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleRemoveLogo() {
    if (!organization || !canManageLogo) return
    const storagePath = organization.logo ?? organizationLogoStoragePath(organization.id)
    setLogoSaving(true)
    try {
      await supabase.storage.from(ORGANIZATION_LOGOS_BUCKET).remove([storagePath])
      const { error } = await supabase
        .from("organizations")
        .update({ logo: null })
        .eq("id", organization.id)

      if (error) {
        toast.error(error.message)
        return
      }

      setOrganization((prev) => (prev ? { ...prev, logo: null } : prev))
      setLogoImageFailed(false)
      setLogoImageLoaded(false)
      toast.success("Logo removed")
    } finally {
      setLogoSaving(false)
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setCreating(true)
    try {
      const res = await fetch("/api/admin/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), sport: newSport.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to create account")
        return
      }

      const { account } = await res.json()
      setAccounts((prev) => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName("")
      setNewSport("")
      setShowNewForm(false)
      toast.success(`${account.name} created`)
    } catch {
      toast.error("Failed to create account")
    } finally {
      setCreating(false)
    }
  }

  const organizationLogoUrl = organization
    ? getOrganizationLogoPublicUrl(supabase, organization.logo, organization.id)
    : undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6 py-8">
      <div>
        <Link
          href="/settings/account"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspace settings
        </Link>
        <h1 className="font-cal text-3xl font-bold dark:text-white">
          Organization
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage accounts within your organization
        </p>
      </div>

      {!organization ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">
            No organization
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Your account is not currently linked to an organization.
          </p>
        </div>
      ) : (
        <>
          {/* Organization info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {organizationLogoUrl && !logoImageFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organizationLogoUrl}
                      width={40}
                      height={40}
                      alt=""
                      className="h-full w-full object-contain"
                      onLoad={() => setLogoImageLoaded(true)}
                      onError={() => setLogoImageFailed(true)}
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {organization.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {accounts.length} account{accounts.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {canManageLogo ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/svg+xml,image/jpeg,image/png,image/webp,image/gif,.svg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleLogoFile(f)
                    }}
                  />
                  <button
                    type="button"
                    disabled={logoSaving}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {logoSaving
                      ? "Saving…"
                      : organization.logo || logoImageLoaded
                        ? "Replace logo"
                        : "Upload logo"}
                  </button>
                  {organization.logo || logoImageLoaded ? (
                    <button
                      type="button"
                      disabled={logoSaving}
                      onClick={() => void handleRemoveLogo()}
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : null}
                  <p className="w-full text-xs text-gray-500">
                    SVG encouraged (crisp at any size); also JPEG, PNG, WebP, or GIF · max 2 MB · shown
                    in the dashboard header and footer for all organization accounts.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Accounts list */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Accounts</h2>
              {canCreateAccount ? (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Account
                </button>
              ) : null}
            </div>

            {showNewForm && (
              <form
                onSubmit={handleCreateAccount}
                className="mb-4 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Provo Football"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Sport
                    </label>
                    <select
                      value={newSport}
                      onChange={(e) => setNewSport(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                      <option value="">Select a sport</option>
                      {SPORTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewForm(false)
                      setNewName("")
                      setNewSport("")
                    }}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {account.name}
                    </p>
                    {account.sport && (
                      <p className="text-xs text-gray-500">
                        {SPORTS.find((s) => s.value === account.sport)?.label || account.sport}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(account.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">
                  No accounts yet
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
