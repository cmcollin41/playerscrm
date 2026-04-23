import { createClient } from "@/lib/supabase/server"
import {
  addDomainToVercel,
  removeDomainFromVercelProject,
  getDomainResponse,
  getConfigResponse,
  verifyDomain,
  validDomainRegex,
} from "@/lib/domains"
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

  // Must be admin
  const { data: isAdmin } = await supabase.rpc("has_account_role", {
    p_account_id: accountId,
    p_min_role: "admin",
  })

  return isAdmin ? accountId : null
}

// GET — check current domain status
export async function GET() {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("custom_domain, subdomain")
    .eq("id", accountId)
    .single()

  if (!account?.custom_domain) {
    return NextResponse.json({ domain: null, subdomain: account?.subdomain })
  }

  const [domainData, configData] = await Promise.all([
    getDomainResponse(account.custom_domain),
    getConfigResponse(account.custom_domain),
  ])

  const attached = domainData?.error?.code !== "not_found"

  return NextResponse.json({
    domain: account.custom_domain,
    subdomain: account.subdomain,
    attached,
    verified: attached ? domainData.verified : false,
    configured: !configData.misconfigured,
    configuredBy: configData.configuredBy,
    verification: attached ? domainData.verification : undefined,
  })
}

// POST — add a custom domain
export async function POST(req: Request) {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { domain } = await req.json()

  if (!domain || !validDomainRegex.test(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 })
  }

  // Don't allow setting a domain that's our root domain or a subdomain of it
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ""
  if (domain === rootDomain || domain.endsWith(`.${rootDomain}`)) {
    return NextResponse.json(
      { error: "Cannot use a subdomain of the platform" },
      { status: 400 },
    )
  }

  // Check if another account already uses this domain
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", accountId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "Domain is already in use by another account" },
      { status: 409 },
    )
  }

  // Remove old domain from Vercel if switching
  const { data: account } = await supabase
    .from("accounts")
    .select("custom_domain")
    .eq("id", accountId)
    .single()

  if (account?.custom_domain && account.custom_domain !== domain) {
    await removeDomainFromVercelProject(account.custom_domain)
  }

  // Add to Vercel
  const vercelResult = await addDomainToVercel(domain)
  if (vercelResult.error) {
    return NextResponse.json(
      { error: vercelResult.error.message || "Failed to add domain to Vercel" },
      { status: 400 },
    )
  }

  // Save to account
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ custom_domain: domain })
    .eq("id", accountId)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save domain" },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, domain })
}

// DELETE — remove custom domain
export async function DELETE() {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("custom_domain")
    .eq("id", accountId)
    .single()

  if (account?.custom_domain) {
    await removeDomainFromVercelProject(account.custom_domain)

    await supabase
      .from("accounts")
      .update({ custom_domain: null })
      .eq("id", accountId)
  }

  return NextResponse.json({ success: true })
}

// PATCH — verify/refresh domain status
export async function PATCH() {
  const supabase = await createClient()
  const accountId = await getAuthedAccountId(supabase)
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("custom_domain")
    .eq("id", accountId)
    .single()

  if (!account?.custom_domain) {
    return NextResponse.json({ error: "No domain configured" }, { status: 400 })
  }

  // Self-heal: if the domain was dropped from the Vercel project out-of-band,
  // re-attach it before verifying so the user doesn't get stuck on Pending.
  const existing = await getDomainResponse(account.custom_domain)
  if (existing?.error?.code === "not_found") {
    const reattached = await addDomainToVercel(account.custom_domain)
    if (reattached?.error) {
      return NextResponse.json(
        {
          error:
            reattached.error.message ||
            "Domain is not attached to this project and could not be re-attached.",
        },
        { status: 400 },
      )
    }
  }

  const result = await verifyDomain(account.custom_domain)

  return NextResponse.json({
    verified: result.verified,
    verification: result.verification,
  })
}
