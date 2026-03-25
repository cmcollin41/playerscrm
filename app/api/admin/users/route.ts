import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { requireAccountAdminApi } from "@/lib/auth"
import { isValidAccountRole, type AccountRole } from "@/lib/roles"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { activeAccountId } = auth
    const admin = createAdminClient()

    const { data: members, error: membersError } = await admin
      .from("account_members")
      .select("id, role, created_at, profile_id")
      .eq("account_id", activeAccountId)
      .order("created_at", { ascending: true })

    if (membersError) {
      console.error("account_members fetch:", membersError)
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    const profileIds = Array.from(
      new Set(
        (members || []).map((m) => m.profile_id).filter(Boolean) as string[],
      ),
    )

    const profileById = new Map<
      string,
      { id: string; email: string | null; first_name: string | null; last_name: string | null }
    >()

    if (profileIds.length > 0) {
      const { data: profilesRows, error: profilesError } = await admin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", profileIds)

      if (profilesError) {
        console.error("profiles fetch for members:", profilesError)
        return NextResponse.json({ error: profilesError.message }, { status: 500 })
      }

      for (const p of profilesRows || []) {
        profileById.set(p.id, p)
      }
    }

    const users = (members || []).map((m) => {
      const p = m.profile_id ? profileById.get(m.profile_id) : undefined
      return {
        id: m.profile_id,
        membership_id: m.id,
        email: p?.email || null,
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        role: m.role,
        created_at: m.created_at,
      }
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { user, activeAccountId } = auth

    const { userId, role } = (await req.json()) as {
      userId: string
      role: AccountRole
    }

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 },
      )
    }

    if (!isValidAccountRole(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be owner, admin, manager, or member" },
        { status: 400 },
      )
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 },
      )
    }

    // Use admin client to bypass RLS for the update
    const admin = createAdminClient()

    const { data: membership } = await admin
      .from("account_members")
      .select("id, role")
      .eq("account_id", activeAccountId)
      .eq("profile_id", userId)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: "User not found in this account" },
        { status: 404 },
      )
    }

    const { error: updateError } = await admin
      .from("account_members")
      .update({ role })
      .eq("id", membership.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, userId, role })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    )
  }
}
