import { NextResponse } from "next/server"
import sharp from "sharp"
import { requireAccountAdminApi } from "@/lib/auth"
import { STORE_ARTWORK_BUCKET } from "@/lib/storage/store-artwork"
import {
  STORE_IMAGES_BUCKET,
  orgVariantImagePath,
} from "@/lib/storage/store-images"
import { parseDesign } from "@/lib/store/design"

// Batch mockup generation: given an artwork file and a set of variant ids,
// composite the artwork onto each variant's pristine base image and save
// the result as that variant's image_path. Pure sharp composite — cheap and
// deterministic, no AI involved.

export const runtime = "nodejs"
export const maxDuration = 60

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}): ${url}`)
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

export async function POST(request: Request) {
  const auth = await requireAccountAdminApi()
  if (!auth.ok) return auth.response
  const { supabase, activeAccountId } = auth

  let body: {
    product_id?: string
    variant_ids?: string[]
    artwork_path?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { product_id, variant_ids, artwork_path: bodyArtworkPath } = body
  if (
    !product_id ||
    !Array.isArray(variant_ids) ||
    variant_ids.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "product_id and a non-empty variant_ids array are required",
      },
      { status: 400 },
    )
  }

  // --- load product (auth + design + fallback artwork) ---
  const { data: product, error: productErr } = await supabase
    .from("org_products")
    .select("id, account_id, design, artwork_path")
    .eq("id", product_id)
    .maybeSingle()
  if (productErr) {
    return NextResponse.json({ error: productErr.message }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }
  if (product.account_id !== activeAccountId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const design = parseDesign(product.design)
  const artworkPath = bodyArtworkPath ?? product.artwork_path ?? null
  if (!artworkPath) {
    return NextResponse.json(
      {
        error:
          "No artwork specified. Upload artwork at the product level or pass artwork_path in the request.",
      },
      { status: 400 },
    )
  }

  // --- pull artwork from the private bucket ---
  const { data: artworkBlob, error: artworkErr } = await supabase.storage
    .from(STORE_ARTWORK_BUCKET)
    .download(artworkPath)
  if (artworkErr || !artworkBlob) {
    return NextResponse.json(
      {
        error: `Failed to load artwork: ${artworkErr?.message ?? "not found"}`,
      },
      { status: 404 },
    )
  }
  let artworkBuffer: Buffer = Buffer.from(await artworkBlob.arrayBuffer())
  const artworkName = artworkPath.split("/").pop() || "artwork.png"
  const artworkContentType = artworkBlob.type || ""

  // SVG → PNG before composite (sharp can read SVG but the composite step
  // wants a raster). PDFs aren't supported for compositing.
  if (
    artworkContentType === "image/svg+xml" ||
    artworkName.toLowerCase().endsWith(".svg")
  ) {
    try {
      artworkBuffer = await sharp(artworkBuffer, { density: 300 })
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer()
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to rasterize SVG: ${err instanceof Error ? err.message : String(err)}`,
        },
        { status: 400 },
      )
    }
  } else if (
    artworkContentType === "application/pdf" ||
    artworkName.toLowerCase().endsWith(".pdf")
  ) {
    return NextResponse.json(
      {
        error:
          "PDF artwork can't be used for mockups yet. Upload a PNG, JPEG, WebP, or SVG version. Your PDF stays saved for partner handoff.",
      },
      { status: 400 },
    )
  }

  // --- load all variants in one query (with their template variant's pristine base image) ---
  const { data: variants, error: variantsErr } = await supabase
    .from("org_product_variants")
    .select(
      "id, product_id, template_variant_id, product_template_variants(image_path)",
    )
    .eq("product_id", product_id)
    .in("id", variant_ids)
  if (variantsErr) {
    return NextResponse.json({ error: variantsErr.message }, { status: 500 })
  }
  if (!variants || variants.length === 0) {
    return NextResponse.json(
      { error: "No matching variants found for this product" },
      { status: 404 },
    )
  }

  // --- loop: composite + upload + db update per variant ---
  const results: { variant_id: string; image_path: string }[] = []
  const errors: { variant_id: string; error: string }[] = []

  for (const variant of variants) {
    const tv = variant.product_template_variants as
      | { image_path: string | null }
      | { image_path: string | null }[]
      | null
    const basePath: string | null = Array.isArray(tv)
      ? (tv[0]?.image_path ?? null)
      : (tv?.image_path ?? null)
    if (!basePath) {
      errors.push({
        variant_id: variant.id,
        error: "No base image on this variant's template",
      })
      continue
    }

    try {
      // Template-variant images can be either a relative path inside the
      // store-images bucket or a full https URL (e.g. partner CDN like
      // Shopify, used by the Truwear seeds). Branch on protocol so we
      // don't try to treat a CDN URL as a storage key.
      let baseBuffer: Buffer
      if (/^https?:\/\//i.test(basePath)) {
        baseBuffer = await fetchAsBuffer(basePath)
      } else {
        const { data: baseBlob, error: baseErr } = await supabase.storage
          .from(STORE_IMAGES_BUCKET)
          .download(basePath)
        if (baseErr || !baseBlob) {
          errors.push({
            variant_id: variant.id,
            error: `Failed to load base image: ${baseErr?.message ?? "not found"}`,
          })
          continue
        }
        baseBuffer = Buffer.from(await baseBlob.arrayBuffer())
      }

      const baseMeta = await sharp(baseBuffer).metadata()
      const bw = baseMeta.width ?? 1024
      const bh = baseMeta.height ?? 1024

      const targetArtWidth = Math.max(16, Math.round(design.scale * bw))
      const resizedArt = await sharp(artworkBuffer)
        .ensureAlpha()
        .resize({
          width: targetArtWidth,
          fit: "inside",
          withoutEnlargement: false,
        })
        .png()
        .toBuffer()
      const rotatedArt =
        design.rotation === 0
          ? resizedArt
          : await sharp(resizedArt)
              .ensureAlpha()
              .rotate(design.rotation, {
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              })
              .png()
              .toBuffer()
      const finalArtMeta = await sharp(rotatedArt).metadata()
      const aw = finalArtMeta.width ?? targetArtWidth
      const ah = finalArtMeta.height ?? targetArtWidth

      const left = Math.max(0, Math.round(design.x * bw - aw / 2))
      const top = Math.max(0, Math.round(design.y * bh - ah / 2))
      const clippedLeft = Math.min(left, Math.max(0, bw - 1))
      const clippedTop = Math.min(top, Math.max(0, bh - 1))

      const compositedBuffer = await sharp(baseBuffer)
        .composite([{ input: rotatedArt, left: clippedLeft, top: clippedTop }])
        .png()
        .toBuffer()

      const filename = `mockup-${crypto.randomUUID()}.png`
      const newPath = orgVariantImagePath(
        activeAccountId,
        product_id,
        variant.id,
        filename,
      )

      const { error: uploadErr } = await supabase.storage
        .from(STORE_IMAGES_BUCKET)
        .upload(newPath, compositedBuffer, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "3600",
        })
      if (uploadErr) {
        errors.push({
          variant_id: variant.id,
          error: `Upload failed: ${uploadErr.message}`,
        })
        continue
      }

      const { error: updateErr } = await supabase
        .from("org_product_variants")
        .update({ image_path: newPath, artwork_path: artworkPath })
        .eq("id", variant.id)
      if (updateErr) {
        errors.push({
          variant_id: variant.id,
          error: `DB update failed: ${updateErr.message}`,
        })
        continue
      }

      results.push({ variant_id: variant.id, image_path: newPath })
    } catch (err) {
      errors.push({
        variant_id: variant.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    results,
    errors,
    artwork_path: artworkPath,
  })
}
