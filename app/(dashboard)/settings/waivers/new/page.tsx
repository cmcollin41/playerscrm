"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
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
import LoadingCircle from "@/components/icons/loading-circle"
import LoadingDots from "@/components/icons/loading-dots"

const SAMPLE_BODY = `# Liability Release and Assumption of Risk

I acknowledge that participation in this camp involves inherent risks of physical injury. By signing below, I voluntarily assume all risks associated with participation and release the organizers, coaches, and venue from any claims arising out of participation.

I certify that the participant is in good physical condition and has no known medical conditions that would prevent safe participation. In the event of a medical emergency, I authorize the organizers to seek appropriate medical care.

I grant permission for photographs and video taken during the event to be used for promotional purposes.`

export default function NewWaiverPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

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
        .select("id, current_account_id, account_id")
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
      setProfileId(profile?.id ?? null)
      setLoading(false)
    })()
  }, [supabase, router])

  async function handleSave() {
    if (!accountId) return
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle) {
      toast.error("Title is required")
      return
    }
    if (!trimmedBody) {
      toast.error("Waiver body is required")
      return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from("waivers")
      .insert({
        account_id: accountId,
        title: trimmedTitle,
        body: trimmedBody,
        is_active: true,
        created_by: profileId,
      })
      .select("id")
      .single()
    setSaving(false)

    if (error) {
      toast.error(error.message || "Failed to save waiver")
      return
    }

    toast.success("Waiver created")
    router.push(`/settings/waivers/${data.id}/edit`)
  }

  if (loading) {
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
      <h1 className="font-cal text-3xl font-bold">New waiver</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Create a reusable waiver template. You'll attach it to events from
        the event editor.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
          <CardDescription>
            Body supports plain text and basic markdown. The full text is shown
            to the registrant during signup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Liability Release"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Body *</Label>
              {!body && (
                <button
                  type="button"
                  onClick={() => setBody(SAMPLE_BODY)}
                  className="text-xs text-gray-500 hover:text-gray-900"
                >
                  Use sample text
                </button>
              )}
            </div>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              placeholder="The full waiver text the registrant will read and accept..."
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <LoadingDots color="#fff" /> : "Save waiver"}
        </Button>
      </div>
    </div>
  )
}
