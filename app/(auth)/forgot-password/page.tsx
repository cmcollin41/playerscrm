"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import LoadingDots from "@/components/icons/loading-dots"

export default function ForgotPasswordPage() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Something went wrong")
        return
      }
      setSent(true)
      toast.success("Check your email for a reset link")
    } catch {
      toast.error("Could not send reset email")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Image src="/logo.svg" width={75} height={75} alt="" className="mb-6" />
      <div className="w-full max-w-[400px] rounded border border-gray-100 bg-gray-50 p-6 shadow">
        <h1 className="text-center text-lg font-semibold text-foreground">
          Reset password
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We’ll email you a link to choose a new password.
        </p>
        {sent ? (
          <p className="mt-6 text-center text-sm text-foreground">
            If an account exists for that address, you’ll get an email shortly.
          </p>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-md border bg-inherit px-4 py-2"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={sending}
              className="mt-2 w-full rounded bg-[#77dd77] px-4 py-2 text-black shadow disabled:opacity-60"
            >
              {sending ? <LoadingDots color="#808080" /> : "Send reset link"}
            </button>
          </form>
        )}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-zinc-700 underline hover:text-zinc-900"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
