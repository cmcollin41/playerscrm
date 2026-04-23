import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

/**
 * Get the current tenant account from the subdomain header (set by proxy.ts).
 * Returns null when on the root domain (no subdomain).
 */
export async function getTenantAccount() {
  const headersList = await headers()
  const subdomain = headersList.get("x-subdomain")

  if (!subdomain) return null

  const supabase = await createClient()
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, subdomain, stripe_id, application_fee, organization_id, logo, sport")
    .eq("subdomain", subdomain)
    .single()

  return account
}

/**
 * Get just the subdomain string from the request headers.
 */
export async function getSubdomainFromHeaders() {
  const headersList = await headers()
  return headersList.get("x-subdomain")
}
