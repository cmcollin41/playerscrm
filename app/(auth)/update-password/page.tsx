"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import LoadingDots from "@/components/icons/loading-dots"
import { Eye, EyeOff } from "lucide-react"

export default function UpdatePasswordPage() {
  const router = useRouter()
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
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Image src="/logo.svg" width={75} height={75} alt="" className="mb-6" />
      <div className="w-full max-w-[400px] rounded border border-gray-100 bg-gray-50 p-6 shadow">
        <h1 className="text-center text-lg font-semibold text-foreground">
          Choose a new password
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Open this page from the link in your email so we know it’s you.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium" htmlFor="password">
              New password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={show1 ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-md border bg-inherit px-4 py-2 pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 flex items-center text-zinc-500"
                onClick={() => setShow1(!show1)}
                aria-label={show1 ? "Hide password" : "Show password"}
              >
                {show1 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password_confirm">
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id="password_confirm"
                name="password_confirm"
                type={show2 ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-md border bg-inherit px-4 py-2 pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 flex items-center text-zinc-500"
                onClick={() => setShow2(!show2)}
                aria-label={show2 ? "Hide password" : "Show password"}
              >
                {show2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded bg-[#77dd77] px-4 py-2 text-black shadow disabled:opacity-60"
          >
            {loading ? <LoadingDots color="#808080" /> : "Update password"}
          </button>
        </form>
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
