import { createClient } from "@/lib/supabase/server"
import resend from "@/lib/resend"
import { NextResponse } from "next/server"

async function getAuthedAccountId(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_account_id, account_id")
    .eq("id", user.id)
    .single()

  const accountId = profile?.current_account_id ?? profile?.account_id
  if (!accountId) return null

  const { data: isAdmin } = await supabase.rpc("has_account_role", {
    p_account_id: accountId,
    p_min_role: "admin",
  })

  return isAdmin ? accountId : null
}

// GET — list sender domains and senders for the account
export async function GET() {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [{ data: domains }, { data: senders }] = await Promise.all([
    supabase
      .from("sender_domains")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
    supabase
      .from("senders")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
  ])

  return NextResponse.json({ domains: domains || [], senders: senders || [] })
}

// POST — add a sender domain or sender email
export async function POST(req: Request) {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  if (action === "add_domain") {
    const { domain } = body
    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    // Check if domain already exists for this account
    const { data: existing } = await supabase
      .from("sender_domains")
      .select("id")
      .eq("account_id", accountId)
      .eq("domain", domain.toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "Domain already added" },
        { status: 409 },
      )
    }

    try {
      // Add domain to Resend
      const resendDomain = await resend.domains.create({
        name: domain.toLowerCase(),
      })

      if (resendDomain.error) {
        return NextResponse.json(
          { error: resendDomain.error.message || "Failed to add domain to Resend" },
          { status: 400 },
        )
      }

      // Save to database
      const { data: senderDomain, error: dbError } = await supabase
        .from("sender_domains")
        .insert({
          account_id: accountId,
          domain: domain.toLowerCase(),
          resend_domain_id: resendDomain.data?.id,
          verification_status: "pending",
          dns_records: resendDomain.data?.records || [],
        })
        .select()
        .single()

      if (dbError) {
        return NextResponse.json(
          { error: "Failed to save domain" },
          { status: 500 },
        )
      }

      return NextResponse.json({
        domain: senderDomain,
        dns_records: resendDomain.data?.records || [],
      })
    } catch (err: any) {
      console.error("Error adding domain to Resend:", err)
      return NextResponse.json(
        { error: err.message || "Failed to add domain" },
        { status: 500 },
      )
    }
  }

  if (action === "add_sender") {
    const { name, email } = body
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 },
      )
    }

    // Check if the email domain is verified
    const emailDomain = email.split("@")[1]
    const { data: verifiedDomain } = await supabase
      .from("sender_domains")
      .select("id")
      .eq("account_id", accountId)
      .eq("domain", emailDomain)
      .eq("verification_status", "verified")
      .maybeSingle()

    if (!verifiedDomain) {
      return NextResponse.json(
        { error: `Domain "${emailDomain}" must be verified before adding senders` },
        { status: 400 },
      )
    }

    // Check for duplicate
    const { data: existingSender } = await supabase
      .from("senders")
      .select("id")
      .eq("account_id", accountId)
      .eq("email", email.toLowerCase())
      .maybeSingle()

    if (existingSender) {
      return NextResponse.json(
        { error: "Sender already exists" },
        { status: 409 },
      )
    }

    const { data: sender, error: dbError } = await supabase
      .from("senders")
      .insert({
        account_id: accountId,
        name,
        email: email.toLowerCase(),
        verified: true,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to save sender" },
        { status: 500 },
      )
    }

    return NextResponse.json({ sender })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

// PATCH — verify a domain
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { domain_id } = await req.json()

  const { data: domain } = await supabase
    .from("sender_domains")
    .select("*")
    .eq("id", domain_id)
    .eq("account_id", accountId)
    .single()

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 })
  }

  if (!domain.resend_domain_id) {
    return NextResponse.json(
      { error: "No Resend domain ID" },
      { status: 400 },
    )
  }

  try {
    const result = await resend.domains.verify(domain.resend_domain_id)

    // Fetch updated domain status from Resend
    const domainInfo = await resend.domains.get(domain.resend_domain_id)
    const status = domainInfo.data?.status === "verified" ? "verified" : "pending"

    await supabase
      .from("sender_domains")
      .update({
        verification_status: status,
        verified_at: status === "verified" ? new Date().toISOString() : null,
        dns_records: domainInfo.data?.records || domain.dns_records,
        updated_at: new Date().toISOString(),
      })
      .eq("id", domain_id)

    return NextResponse.json({
      status,
      dns_records: domainInfo.data?.records || domain.dns_records,
    })
  } catch (err: any) {
    console.error("Error verifying domain:", err)
    return NextResponse.json(
      { error: err.message || "Verification failed" },
      { status: 500 },
    )
  }
}

// DELETE — remove a domain or sender
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = await req.json()

  if (type === "domain") {
    const { data: domain } = await supabase
      .from("sender_domains")
      .select("resend_domain_id, domain")
      .eq("id", id)
      .eq("account_id", accountId)
      .single()

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 })
    }

    // Remove from Resend
    if (domain.resend_domain_id) {
      try {
        await resend.domains.remove(domain.resend_domain_id)
      } catch (err) {
        console.error("Error removing domain from Resend:", err)
      }
    }

    // Remove associated senders
    await supabase
      .from("senders")
      .delete()
      .eq("account_id", accountId)
      .like("email", `%@${domain.domain}`)

    // Remove from database
    await supabase.from("sender_domains").delete().eq("id", id)

    return NextResponse.json({ success: true })
  }

  if (type === "sender") {
    await supabase
      .from("senders")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 })
}
