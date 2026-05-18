import type { SupabaseClient } from "@supabase/supabase-js"

export const STORE_IMAGES_BUCKET = "store-images"

// ---------------------------------------------------------------------------
// path builders — mirror the storage RLS policies. callers must respect these
// or uploads will fail with policy violations.
// ---------------------------------------------------------------------------

export function templateImagePath(templateId: string, filename: string): string {
  return `templates/${templateId}/${filename}`
}

export function templateVariantImagePath(
  variantId: string,
  filename: string,
): string {
  return `template-variants/${variantId}/${filename}`
}

export function orgProductImagePath(
  accountId: string,
  productId: string,
  filename: string,
): string {
  return `org-products/${accountId}/${productId}/${filename}`
}

export function orgVariantImagePath(
  accountId: string,
  productId: string,
  variantId: string,
  filename: string,
): string {
  return `org-product-variants/${accountId}/${productId}/${variantId}/${filename}`
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Build a public URL for an image stored at the given path inside the
 * store-images bucket. Accepts a stored path, a full https URL (returned
 * as-is), or null/empty (returns undefined).
 */
export function getStoreImagePublicUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): string | undefined {
  if (path == null) return undefined
  const trimmed = String(path).trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  let clean = trimmed.replace(/^\//, "")
  const bucketPrefix = `${STORE_IMAGES_BUCKET}/`
  if (clean.startsWith(bucketPrefix)) clean = clean.slice(bucketPrefix.length)

  const { data } = supabase.storage.from(STORE_IMAGES_BUCKET).getPublicUrl(clean)
  return data.publicUrl
}

/** Derive a safe storage filename. Uses crypto.randomUUID + the file extension. */
export function makeImageFilename(originalName: string): string {
  const dot = originalName.lastIndexOf(".")
  const rawExt = dot >= 0 ? originalName.slice(dot + 1) : ""
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  return `${crypto.randomUUID()}.${ext}`
}

/**
 * Upload a file into the store-images bucket at the given path. Throws on
 * error so callers can surface it via toast. Returns the stored path so it
 * can be persisted on the related row.
 */
export async function uploadStoreImage(
  supabase: SupabaseClient,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: "3600",
    })
  if (error) throw new Error(error.message)
  return path
}
