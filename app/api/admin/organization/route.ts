import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { requireAccountAdminApi } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET: fetch the user's organization + its accounts
export async function GET() {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { supabase, user, activeAccountId } = auth

    // Get the account's organization
    const { data: account } = await supabase
      .from("accounts")
      .select("organization_id")
      .eq("id", activeAccountId)
      .single()

    if (!account?.organization_id) {
      return NextResponse.json({
        organization: null,
        accounts: [],
        membership: null,
        canCreateAccount: false,
      })
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", account.organization_id)
      .eq("profile_id", user.id)
      .maybeSingle()

    // Fetch org details
    const { data: organization } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", account.organization_id)
      .single()

    // Fetch all accounts under this org
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, sport, created_at")
      .eq("organization_id", account.organization_id)
      .order("name")

    // Account admins can always view; org admin/owner can also create new accounts
    const canCreateAccount =
      membership?.role === "admin" ||
      membership?.role === "owner"

    return NextResponse.json(
      {
        organization,
        accounts: accounts || [],
        membership: membership ?? null,
        canCreateAccount,
      },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      },
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    )
  }
}

// POST: create a new account under the user's organization
export async function POST(request: Request) {
  try {
    const auth = await requireAccountAdminApi()
    if (!auth.ok) return auth.response

    const { supabase, user, activeAccountId } = auth

    const { data: currentAccount } = await supabase
      .from("accounts")
      .select("organization_id")
      .eq("id", activeAccountId)
      .single()

    if (!currentAccount?.organization_id) {
      return NextResponse.json(
        { error: "Current account is not part of an organization" },
        { status: 400 },
      )
    }

    const body = await request.json()
    const { name, sport } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 },
      )
    }

    // Use admin client to bypass RLS — auth is already validated above
    const admin = createAdminClient()

    // Create the new account under the same org
    const { data: newAccount, error: createError } = await admin
      .from("accounts")
      .insert({
        name: name.trim(),
        sport: sport?.trim() || null,
        organization_id: currentAccount.organization_id,
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 500 },
      )
    }

    // Add the current user as an owner of the new account
    await admin.from("account_members").insert({
      account_id: newAccount.id,
      profile_id: user.id,
      role: "owner",
    })

    return NextResponse.json({ account: newAccount }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    )
  }
}
