import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { UserRole } from "@/types/schema.types"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", user.id)
      .single()

    if (!callerProfile?.account_id || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, created_at")
      .eq("account_id", callerProfile.account_id)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("account_id, role")
      .eq("id", user.id)
      .single()

    if (!callerProfile?.account_id || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      )
    }

    const { userId, role } = (await req.json()) as {
      userId: string
      role: UserRole
    }

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 }
      )
    }

    if (role !== "admin" && role !== "general") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'general'" },
        { status: 400 }
      )
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      )
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", userId)
      .single()

    if (targetProfile?.account_id !== callerProfile.account_id) {
      return NextResponse.json(
        { error: "User not found in your account" },
        { status: 404 }
      )
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, userId, role })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
