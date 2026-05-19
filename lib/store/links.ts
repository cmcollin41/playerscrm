/**
 * Build absolute URLs to a tenant's public storefront. Used by the dashboard
 * "share product" / "share store" buttons. Custom domain wins over subdomain
 * so orgs with a CNAME share the cleaner URL.
 */

interface TenantHost {
  subdomain?: string | null
  custom_domain?: string | null
}

export function storefrontBaseUrl(tenant: TenantHost): string | null {
  if (tenant.custom_domain) {
    return `https://${tenant.custom_domain}`
  }
  if (!tenant.subdomain) return null
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "athletes.app"
  const protocol = root.includes("localhost") ? "http" : "https"
  return `${protocol}://${tenant.subdomain}.${root}`
}

export function storefrontUrl(tenant: TenantHost): string | null {
  const base = storefrontBaseUrl(tenant)
  return base ? `${base}/store` : null
}

export function productStorefrontUrl(
  tenant: TenantHost,
  slug: string,
): string | null {
  const base = storefrontBaseUrl(tenant)
  return base ? `${base}/store/${slug}` : null
}
