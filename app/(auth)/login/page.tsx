'use client'

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import LoadingDots from "@/components/icons/loading-dots"
import Messages from "./messages"

import { createClient } from "@/lib/supabase/client"
import { decryptId } from "@/app/utils/ecryption"
import { signup, login } from "./actions"

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const from_events = searchParams.get("from_events")
  const account_id = searchParams.get("account_id")
  const people_id = searchParams.get("people_id")
  const invite_role = searchParams.get("invite_role") || "member"
  const email =
    from_events === "true"
      ? (searchParams.get("email") as string) || ""
      : decryptId(searchParams.get("email") as string)
  const sign_up = searchParams.get("sign_up")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [account, setAccount] = useState<{ name?: string } | null>(null)

  const emailLocked = email !== ""
  const signUp = sign_up === "true"

  useEffect(() => {
    if (!people_id) return
    const fetchPerson = async () => {
      const { data, error } = await supabase
        .from("people")
        .select("first_name, last_name")
        .eq("id", people_id)
        .single()
      if (!error && data) {
        setFirstName(data.first_name || "")
        setLastName(data.last_name || "")
      }
    }
    fetchPerson()
  }, [people_id, supabase])

  useEffect(() => {
    if (!account_id) return
    const fetchAccount = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", account_id)
        .single()
      if (!error && data) setAccount(data)
    }
    fetchAccount()
  }, [account_id, supabase])

  const isRedirect = (err: unknown) =>
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    try {
      const result = await login(formData)
      if (result && result.error) {
        setSubmitting(false)
        toast.error(result.error)
      }
    } catch (error) {
      if (isRedirect(error)) throw error
      setSubmitting(false)
      toast.error("Login failed")
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    formData.append("from_events", from_events || "")
    formData.append("account_id", account_id || "")
    formData.append("invite_role", invite_role || "member")
    try {
      const result = await signup(formData)
      if (result?.error) {
        setSubmitting(false)
        toast.error(result.error)
      }
    } catch (error) {
      if (isRedirect(error)) throw error
      setSubmitting(false)
      toast.error("Sign up failed")
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
        {account?.name ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
              You&apos;re invited
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-gray-900">
              Join <span className="text-orange-600">{account.name}</span>
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {signUp
                ? "Create your account to get started."
                : "Sign in below, or create your account."}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">
              {signUp ? "Get started" : "Welcome back"}
            </p>
            <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-gray-900">
              {signUp ? "Create your account." : "Sign in to Athletes App."}
            </h1>
          </>
        )}

        <div className="mt-4">
          <Messages />
        </div>

        <Tabs
          defaultValue={signUp ? "signUp" : "signIn"}
          className="mt-6 w-full"
        >
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign In</TabsTrigger>
            <TabsTrigger value="signUp">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signIn">
            <form className="space-y-5" onSubmit={handleSignIn}>
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="signin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 font-semibold hover:bg-gray-800"
              >
                {submitting ? <LoadingDots color="#fff" /> : "Sign In"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="signUp">
            <form className="space-y-5" onSubmit={handleSignUp}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="signup-first-name">First name</Label>
                  <Input
                    id="signup-first-name"
                    name="first_name"
                    required
                    autoComplete="given-name"
                    defaultValue={firstName}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-last-name">Last name</Label>
                  <Input
                    id="signup-last-name"
                    name="last_name"
                    required
                    autoComplete="family-name"
                    defaultValue={lastName}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  defaultValue={email}
                  readOnly={emailLocked}
                  className="mt-1 read-only:cursor-not-allowed read-only:opacity-75"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <input type="hidden" name="people_id" value={people_id || ""} />
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-900 font-semibold hover:bg-gray-800"
              >
                {submitting ? <LoadingDots color="#fff" /> : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        Parent or family member?{" "}
        <Link
          href="/portal-login"
          className="text-gray-700 underline hover:text-gray-900"
        >
          Use the parent portal
        </Link>
      </p>
    </div>
  )
}
