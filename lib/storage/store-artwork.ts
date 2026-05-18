import type { SupabaseClient } from "@supabase/supabase-js"

export const STORE_ARTWORK_BUCKET = "store-artwork"

/**
 * Path inside the private store-artwork bucket. The first segment must be
 * "org-products" and the second the account id — storage policies use these
 * to gate auth. See supabase/migrations/20260518160000_store_artwork.sql.
 */
export function orgProductArtworkPath(
  accountId: string,
  productId: string,
  filename: string,
): string {
  return `org-products/${accountId}/${productId}/${filename}`
}

/** Default filename for an uploaded artwork file. */
export function makeArtworkFilename(originalName: string): string {
  const dot = originalName.lastIndexOf(".")
  const rawExt = dot >= 0 ? originalName.slice(dot + 1) : ""
  // pdfs and svgs are valid artwork formats too; preserve their extension.
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "png"
  return `${crypto.randomUUID()}.${ext}`
}

/**
 * Upload an artwork file to the private bucket. Returns the stored path.
 * Use createArtworkSignedUrl() to render a preview.
 */
export async function uploadArtwork(
  supabase: SupabaseClient,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage
    .from(STORE_ARTWORK_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: "3600",
    })
  if (error) throw new Error(error.message)
  return path
}

/**
 * Create a time-limited signed URL for previewing or downloading an artwork
 * file. The bucket is private, so the storage policies still apply: callers
 * without account-member access will get a 4xx instead of a usable URL.
 *
 * `expiresIn` is seconds; defaults to 1h which is plenty for dashboard
 * previews. Use a shorter TTL for partner-bound handoff emails.
 */
export async function createArtworkSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORE_ARTWORK_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
