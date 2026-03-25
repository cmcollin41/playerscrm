import { createClient } from "@/lib/supabase/server"
import { authCallbackRedirectUrl } from "@/lib/auth-site"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email") || "").trim()

  if (!email) {
    return NextResponse.json({ error: "Email is required", ok: false }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackRedirectUrl("/update-password"),
  })

  if (error) {
    console.error("resetPasswordForEmail:", error.message)
    return NextResponse.json(
      { error: "Could not send reset email. Try again later.", ok: false },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
