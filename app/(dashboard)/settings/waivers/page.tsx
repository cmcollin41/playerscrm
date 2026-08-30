"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, FileText, Plus, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import LoadingCircle from "@/components/icons/loading-circle"

interface Waiver {
  id: string
  title: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function WaiversPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [waivers, setWaivers] = useState<Waiver[]>([])

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

      const activeAccountId =
        profile?.current_account_id ?? profile?.account_id
      if (!activeAccountId) {
        router.replace("/settings")
        return
      }

      const { data: hasAccess } = await supabase.rpc("has_account_role", {
        p_account_id: activeAccountId,
        p_min_role: "manager",
      })
      if (!hasAccess) {
        router.replace("/settings")
        return
      }

      setAccountId(activeAccountId)

      const { data, error } = await supabase
        .from("waivers")
        .select("*")
        .eq("account_id", activeAccountId)
        .order("created_at", { ascending: false })

      if (error) {
        toast.error("Failed to load waivers")
      } else {
        setWaivers((data ?? []) as Waiver[])
      }
      setLoading(false)
    })()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingCircle />
      </div>
    )
  }

  const active = waivers.filter((w) => w.is_active)
  const archived = waivers.filter((w) => !w.is_active)

  return (
    <div className="flex flex-col space-y-6 py-8">
      <div>
        <Link
          href="/settings/account"
          className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspace settings
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-cal text-3xl font-bold">Waivers</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Reusable liability and consent templates. Attach a waiver to any
              event and registrants will sign it during signup.
            </p>
          </div>
          <Link href="/settings/waivers/new">
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              New waiver
            </Button>
          </Link>
        </div>
      </div>

      {waivers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">
            No waivers yet
          </p>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto text-xs">
            Create a waiver template once and reuse it across every camp,
            clinic, or event. Registrants type their name and accept the terms
            during signup; the signature, timestamp, and IP are captured for
            your records.
          </p>
          <Link href="/settings/waivers/new" className="mt-4 inline-block">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Create your first waiver
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-700">Active</h2>
              {active.map((w) => (
                <WaiverRow key={w.id} waiver={w} />
              ))}
            </div>
          )}
          {archived.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-500">Archived</h2>
              {archived.map((w) => (
                <WaiverRow key={w.id} waiver={w} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function WaiverRow({ waiver }: { waiver: Waiver }) {
  const updated = new Date(waiver.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return (
    <Link
      href={`/settings/waivers/${waiver.id}/edit`}
      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {waiver.title}
          </p>
          <p className="text-muted-foreground text-xs">
            Updated {updated}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!waiver.is_active && (
          <Badge variant="secondary" className="text-[10px]">
            Archived
          </Badge>
        )}
        <Pencil className="h-3.5 w-3.5 text-gray-400" />
      </div>
    </Link>
  )
}
