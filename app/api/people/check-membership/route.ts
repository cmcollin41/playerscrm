import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { requireAccountAdminApi } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { activeAccountId } = auth
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ hasProfile: false, isMember: false })
    }

    const { data: membership } = await admin
      .from("account_members")
      .select("id")
      .eq("account_id", activeAccountId)
      .eq("profile_id", profile.id)
      .maybeSingle()

    return NextResponse.json({
      hasProfile: true,
      isMember: !!membership,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    )
  }
}
