import type { SupabaseClient } from "@supabase/supabase-js"

export const ORGANIZATION_LOGOS_BUCKET = "organization-logos"

/** Object key used by the app: `{organization_id}/logo` */
export function organizationLogoStoragePath(organizationId: string): string {
  return `${organizationId}/logo`
}

/**
 * Build public URL for organizations.logo.
 * - If `logo` is set: storage path, full URL, or path with bucket prefix.
 * - If `logo` is empty but `organizationId` is set: same path the uploader uses (`{id}/logo`) so a file in the bucket still displays.
 */
export function getOrganizationLogoPublicUrl(
  supabase: SupabaseClient,
  logo: string | null | undefined,
  organizationId?: string | null,
): string | undefined {
  const trimmedLogo =
    logo != null && String(logo).trim() !== "" ? String(logo).trim() : null
  const pathOrUrl =
    trimmedLogo ??
    (organizationId != null && String(organizationId).trim() !== ""
      ? organizationLogoStoragePath(String(organizationId).trim())
      : null)

  if (pathOrUrl == null) return undefined

  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl

  let path = pathOrUrl.replace(/^\//, "")
  const bucketPrefix = `${ORGANIZATION_LOGOS_BUCKET}/`
  if (path.startsWith(bucketPrefix)) path = path.slice(bucketPrefix.length)

  const { data } = supabase.storage.from(ORGANIZATION_LOGOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
