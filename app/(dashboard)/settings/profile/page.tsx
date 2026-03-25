"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import LoadingDots from "@/components/icons/loading-dots"
import { ArrowLeft } from "lucide-react"
import { ChangePasswordForm } from "@/components/settings/change-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function ProfileSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)

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
        .select("first_name, last_name")
        .eq("id", user.id)
        .single()
      if (cancelled) return
      setEmail(user.email ?? null)
      setFirstName(profile?.first_name ?? null)
      setLastName(profile?.last_name ?? null)
      setLoading(false)
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
    <div className="flex flex-col space-y-6 py-8">
      <div>
        <Link
          href="/settings"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Settings
        </Link>
        <h1 className="font-cal text-3xl font-bold dark:text-white">
          Your Profile
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your sign-in identity and password. This is private to you — not your
          team workspace settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact</CardTitle>
          <CardDescription>
            Name and email come from your profile. Contact a workspace admin if
            something needs updating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Email</Label>
            <p className="text-sm font-medium leading-none text-foreground">
              {email || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Name</Label>
            <p className="text-sm font-medium leading-none text-foreground">
              {[firstName, lastName].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  )
}
