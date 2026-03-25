"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import LoadingDots from "@/components/icons/loading-dots"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ChangePasswordForm() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [show1, setShow1] = useState(false)
  const [show2, setShow2] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const p1 = String(fd.get("password") || "")
    const p2 = String(fd.get("password_confirm") || "")
    if (p1.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    if (p1 !== p2) {
      toast.error("Passwords do not match")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success("Password updated")
    e.currentTarget.reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Password</CardTitle>
        <CardDescription>
          Update the password for this email. If you’re locked out, use{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            forgot password
          </Link>{" "}
          on the sign-in page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show1 ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => setShow1(!show1)}
                aria-label={show1 ? "Hide password" : "Show password"}
              >
                {show1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_confirm">Confirm new password</Label>
            <div className="relative">
              <Input
                id="password_confirm"
                name="password_confirm"
                type={show2 ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => setShow2(!show2)}
                aria-label={show2 ? "Hide password" : "Show password"}
              >
                {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? <LoadingDots color="#fafafa" /> : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
