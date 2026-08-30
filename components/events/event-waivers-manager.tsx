"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface WaiverTemplate {
  id: string
  title: string
  is_active: boolean
}

interface AttachmentRow {
  event_id: string
  waiver_id: string
  is_required: boolean
  requires_guardian: boolean
  ordering: number
  waiver: WaiverTemplate | null
}

export function EventWaiversManager({
  eventId,
  accountId,
}: {
  eventId: string
  accountId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [catalog, setCatalog] = useState<WaiverTemplate[]>([])
  const [picking, setPicking] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [catalogRes, attachedRes] = await Promise.all([
        supabase
          .from("waivers")
          .select("id, title, is_active")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .order("title"),
        supabase
          .from("event_waivers")
          .select(
            "event_id, waiver_id, is_required, requires_guardian, ordering, waiver:waivers(id, title, is_active)",
          )
          .eq("event_id", eventId)
          .order("ordering"),
      ])

      if (cancelled) return

      setCatalog((catalogRes.data ?? []) as WaiverTemplate[])
      setAttachments(
        ((attachedRes.data ?? []) as any[]).map((a) => ({
          event_id: a.event_id,
          waiver_id: a.waiver_id,
          is_required: a.is_required,
          requires_guardian: a.requires_guardian,
          ordering: a.ordering,
          waiver: Array.isArray(a.waiver) ? a.waiver[0] : a.waiver,
        })),
      )
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [accountId, eventId, supabase])

  const availableToAdd = catalog.filter(
    (w) => !attachments.some((a) => a.waiver_id === w.id),
  )

  async function handleAdd() {
    if (!picking) return
    const waiver = catalog.find((w) => w.id === picking)
    if (!waiver) return

    const nextOrdering = attachments.length
    const { error } = await supabase.from("event_waivers").insert({
      event_id: eventId,
      waiver_id: waiver.id,
      is_required: true,
      requires_guardian: false,
      ordering: nextOrdering,
    })

    if (error) {
      toast.error(error.message || "Failed to attach waiver")
      return
    }

    setAttachments((prev) => [
      ...prev,
      {
        event_id: eventId,
        waiver_id: waiver.id,
        is_required: true,
        requires_guardian: false,
        ordering: nextOrdering,
        waiver,
      },
    ])
    setPicking("")
    toast.success("Waiver attached")
  }

  async function handleRemove(waiverId: string) {
    const { error } = await supabase
      .from("event_waivers")
      .delete()
      .eq("event_id", eventId)
      .eq("waiver_id", waiverId)

    if (error) {
      toast.error(error.message || "Failed to remove")
      return
    }
    setAttachments((prev) => prev.filter((a) => a.waiver_id !== waiverId))
  }

  async function handleToggle(
    waiverId: string,
    field: "is_required" | "requires_guardian",
    value: boolean,
  ) {
    const { error } = await supabase
      .from("event_waivers")
      .update({ [field]: value })
      .eq("event_id", eventId)
      .eq("waiver_id", waiverId)

    if (error) {
      toast.error(error.message || "Failed to update")
      return
    }
    setAttachments((prev) =>
      prev.map((a) =>
        a.waiver_id === waiverId ? { ...a, [field]: value } : a,
      ),
    )
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Waivers</CardTitle>
        <CardDescription>
          Templates that registrants must sign during signup. Manage templates
          in{" "}
          <Link
            href="/settings/waivers"
            className="text-gray-900 underline hover:text-gray-700"
          >
            Settings &rsaquo; Waivers
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 && (
          <p className="text-sm text-gray-500">No waivers attached.</p>
        )}
        {attachments.map((a) => (
          <div
            key={a.waiver_id}
            className="rounded-lg border border-gray-200 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <p className="truncate text-sm font-medium text-gray-900">
                  {a.waiver?.title ?? "Untitled waiver"}
                </p>
                <Link
                  href={`/settings/waivers/${a.waiver_id}/edit`}
                  target="_blank"
                  className="text-gray-400 hover:text-gray-600"
                  title="Edit template"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(a.waiver_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-800">Required</p>
                  <p className="text-[11px] text-gray-500">
                    Registrants can't complete signup until this is signed
                  </p>
                </div>
                <Switch
                  checked={a.is_required}
                  onCheckedChange={(v) =>
                    handleToggle(a.waiver_id, "is_required", v)
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Guardian must sign
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Forces a guardian signature for every registrant regardless
                    of age
                  </p>
                </div>
                <Switch
                  checked={a.requires_guardian}
                  onCheckedChange={(v) =>
                    handleToggle(a.waiver_id, "requires_guardian", v)
                  }
                />
              </div>
            </div>
          </div>
        ))}

        {catalog.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-center">
            <p className="text-sm text-gray-700">No waiver templates yet.</p>
            <Link
              href="/settings/waivers/new"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline"
            >
              Create your first waiver
            </Link>
          </div>
        ) : availableToAdd.length === 0 ? (
          <p className="text-xs text-gray-500">
            All active waiver templates are already attached.
          </p>
        ) : (
          <div className="flex gap-2">
            <Select value={picking} onValueChange={setPicking}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add a waiver template" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={!picking}
            >
              <Plus className="mr-1 h-4 w-4" />
              Attach
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
