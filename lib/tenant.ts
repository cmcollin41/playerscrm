import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

const ACCOUNT_SELECT =
  "id, name, subdomain, custom_domain, stripe_id, application_fee, organization_id, logo, sport"

/**
 * Pull the tenant subdomain from the request host using the same rules
 * proxy.ts applies. Used as a fallback when the proxy didn't set the
 * `x-subdomain` header — e.g. for /api/* routes, which the proxy matcher
 * explicitly excludes.
 */
function subdomainFromHost(host: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"
  if (host === rootDomain || host === `www.${rootDomain}`) return null
  const stripped = host.replace(`.${rootDomain}`, "")
  return stripped !== host ? stripped : null
}

/**
 * Get the current tenant account.
 *
 * Page routes: reads x-subdomain (set by proxy.ts).
 * API routes (proxy matcher excludes /api/*): falls back to deriving from
 *   the request host header — strips the root domain for *.athletes.app
 *   subdomains, or looks the host up by custom_domain for custom CNAMEs.
 *
 * Returns null on the root domain (no tenant).
 */
export async function getTenantAccount() {
  const headersList = await headers()
  const headerSub = headersList.get("x-subdomain")
  const supabase = await createClient()

  if (headerSub) {
    const { data } = await supabase
      .from("accounts")
      .select(ACCOUNT_SELECT)
      .eq("subdomain", headerSub)
      .maybeSingle()
    return data
  }

  const host = headersList.get("host")
  if (!host) return null

  const derivedSub = subdomainFromHost(host)
  if (derivedSub) {
    const { data } = await supabase
      .from("accounts")
      .select(ACCOUNT_SELECT)
      .eq("subdomain", derivedSub)
      .maybeSingle()
    return data
  }

  // Not the root domain and not our subdomain — try custom_domain.
  const { data } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("custom_domain", host)
    .maybeSingle()
  return data
}

/**
 * Get just the subdomain string from the request headers.
 */
export async function getSubdomainFromHeaders() {
  const headersList = await headers()
  const headerSub = headersList.get("x-subdomain")
  if (headerSub) return headerSub
  const host = headersList.get("host")
  return host ? subdomainFromHost(host) : null
}
