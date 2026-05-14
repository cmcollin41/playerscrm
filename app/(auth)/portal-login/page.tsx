"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sendParentMagicLink } from "./actions"

export default function PortalLoginPage() {
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    try {
      const formData = new FormData(event.currentTarget)
      const result = await sendParentMagicLink(formData)
      if (result.error) {
        toast.error(result.error)
        setSending(false)
        return
      }
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/athletes-logo.png"
          width={48}
          height={48}
          alt="Athletes App"
        />
        <span className="font-display text-xl text-gray-900">Athletes App</span>
      </Link>

      <div className="mt-8 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
          Parent portal
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-gray-900">
          Sign in to your portal.
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ll email you a one-time sign-in link. No password required.
        </p>

        {sent ? (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">Check your inbox.</p>
            <p className="mt-1 text-xs">
              If your email matches an Athletes App account, a sign-in link is
              on its way. The link expires shortly for security.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <Label htmlFor="portal-email">Email</Label>
              <Input
                id="portal-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              className="w-full bg-gray-900 font-semibold hover:bg-gray-800"
            >
              {sending ? (
                "Sending..."
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Email me a sign-in link
                </>
              )}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        Staff or admin?{" "}
        <Link
          href="/login"
          className="text-gray-700 underline hover:text-gray-900"
        >
          Sign in with password
        </Link>
      </p>
    </div>
  )
}
