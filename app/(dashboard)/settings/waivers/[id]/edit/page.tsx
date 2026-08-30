"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import LoadingCircle from "@/components/icons/loading-circle"
import LoadingDots from "@/components/icons/loading-dots"

interface Waiver {
  id: string
  account_id: string
  title: string
  body: string
  is_active: boolean
}

export default function EditWaiverPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [waiver, setWaiver] = useState<Waiver | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [canAdmin, setCanAdmin] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }

      const { data, error } = await supabase
        .from("waivers")
        .select("*")
        .eq("id", id)
        .single()

      if (error || !data) {
        toast.error("Waiver not found")
        router.replace("/settings/waivers")
        return
      }

      const w = data as Waiver
      setWaiver(w)
      setTitle(w.title)
      setBody(w.body)
      setIsActive(w.is_active)

      const { data: adminAccess } = await supabase.rpc("has_account_role", {
        p_account_id: w.account_id,
        p_min_role: "admin",
      })
      setCanAdmin(!!adminAccess)
      setLoading(false)
    })()
  }, [id, supabase, router])

  async function handleSave() {
    if (!waiver) return
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody) {
      toast.error("Title and body are required")
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from("waivers")
      .update({
        title: trimmedTitle,
        body: trimmedBody,
        is_active: isActive,
      })
      .eq("id", waiver.id)
    setSaving(false)

    if (error) {
      toast.error(error.message || "Failed to save")
      return
    }
    toast.success("Waiver saved")
  }

  async function handleDelete() {
    if (!waiver) return
    if (
      !confirm(
        "Delete this waiver? This will fail if it's attached to any events — archive it instead to keep historical signatures intact.",
      )
    ) {
      return
    }
    setDeleting(true)
    const { error } = await supabase.from("waivers").delete().eq("id", waiver.id)
    setDeleting(false)

    if (error) {
      toast.error(
        error.message?.includes("foreign key")
          ? "Cannot delete — this waiver is attached to one or more events. Archive it instead."
          : error.message || "Failed to delete",
      )
      return
    }
    toast.success("Waiver deleted")
    router.replace("/settings/waivers")
  }

  if (loading || !waiver) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingCircle />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <Link
        href="/settings/waivers"
        className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Waivers
      </Link>
      <h1 className="font-cal text-3xl font-bold">Edit waiver</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Existing signatures snapshot the title and body at signing time, so
        edits here only affect future signers.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
          <CardDescription>
            Body supports plain text and basic markdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-gray-500">
                Inactive waivers are hidden from event editors but stay
                attached to events they're already on.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-2">
        {canAdmin ? (
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <LoadingDots color="#fff" /> : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
