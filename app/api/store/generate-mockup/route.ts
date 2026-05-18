import { NextResponse } from "next/server"
import OpenAI from "openai"
import { toFile } from "openai/uploads"
import sharp from "sharp"
import { requireAccountAdminApi } from "@/lib/auth"
import { STORE_ARTWORK_BUCKET } from "@/lib/storage/store-artwork"
import {
  STORE_IMAGES_BUCKET,
  orgVariantImagePath,
} from "@/lib/storage/store-images"
import {
  DEFAULT_MOCKUP_OPTIONS,
  buildMockupPrompt,
  parseDesign,
  type ColorMode,
  type Embellishment,
  type MockupGenerationOptions,
} from "@/lib/store/design"

const VALID_EMBELLISHMENTS: Embellishment[] = [
  "screenprint",
  "embroidery",
  "dtg",
  "vinyl",
]
const VALID_COLOR_MODES: ColorMode[] = ["preserve", "single_ink"]

// Generated mockups are returned by the model as base64 PNGs. We persist
// them to the same store-images bucket the rest of the UI reads from.
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

function contentTypeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "webp") return "image/webp"
  if (ext === "svg") return "image/svg+xml"
  if (ext === "pdf") return "application/pdf"
  return "application/octet-stream"
}

export async function POST(request: Request) {
  const auth = await requireAccountAdminApi()
  if (!auth.ok) return auth.response
  const { supabase, activeAccountId } = auth

  let body: {
    product_id?: string
    variant_id?: string
    artwork_path?: string
    base_image_path?: string
    embellishment?: string
    color_mode?: string
    ink_color_hex?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { product_id, variant_id, artwork_path, base_image_path } = body
  if (!product_id || !variant_id || !artwork_path || !base_image_path) {
    return NextResponse.json(
      {
        error:
          "product_id, variant_id, artwork_path, and base_image_path are required",
      },
      { status: 400 },
    )
  }

  const embellishment: Embellishment =
    body.embellishment &&
    (VALID_EMBELLISHMENTS as string[]).includes(body.embellishment)
      ? (body.embellishment as Embellishment)
      : DEFAULT_MOCKUP_OPTIONS.embellishment
  const colorMode: ColorMode =
    body.color_mode &&
    (VALID_COLOR_MODES as string[]).includes(body.color_mode)
      ? (body.color_mode as ColorMode)
      : DEFAULT_MOCKUP_OPTIONS.colorMode
  const inkColorHex =
    colorMode === "single_ink" && body.ink_color_hex
      ? body.ink_color_hex
      : undefined
  const mockupOptions: MockupGenerationOptions = {
    embellishment,
    colorMode,
    inkColorHex,
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server" },
      { status: 500 },
    )
  }

  // Verify the variant belongs to a product owned by the user's active
  // account, and load the design config for prompt building.
  const { data: variant, error: variantErr } = await supabase
    .from("org_product_variants")
    .select("id, product_id, org_products!inner(account_id, design)")
    .eq("id", variant_id)
    .eq("product_id", product_id)
    .maybeSingle()

  if (variantErr) {
    return NextResponse.json({ error: variantErr.message }, { status: 500 })
  }
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 })
  }
  // @ts-expect-error — embedded join shape
  const productAccountId = variant.org_products?.account_id
  if (productAccountId !== activeAccountId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // @ts-expect-error — embedded join shape
  const design = parseDesign(variant.org_products?.design)
  const prompt = buildMockupPrompt({ design, mockup: mockupOptions })

  // --- pull artwork (private bucket) ---
  const { data: artworkBlob, error: artworkErr } = await supabase.storage
    .from(STORE_ARTWORK_BUCKET)
    .download(artwork_path)
  if (artworkErr || !artworkBlob) {
    return NextResponse.json(
      {
        error: `Failed to load artwork: ${artworkErr?.message ?? "not found"}`,
      },
      { status: 404 },
    )
  }
  let artworkBuffer: Buffer = Buffer.from(await artworkBlob.arrayBuffer())
  let artworkName = artwork_path.split("/").pop() || "artwork.png"
  let artworkContentType = artworkBlob.type || contentTypeForName(artworkName)

  // gpt-image-1 only accepts PNG / JPEG / WebP. Rasterize SVG via sharp.
  // PDF rasterization is heavier (needs a PDF runtime); reject for now with
  // a clear message — the org's PDF stays uploaded for partner handoff.
  if (
    artworkContentType === "image/svg+xml" ||
    artworkName.toLowerCase().endsWith(".svg")
  ) {
    try {
      artworkBuffer = await sharp(artworkBuffer, { density: 300 })
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer()
      artworkName = artworkName.replace(/\.svg$/i, ".png") || "artwork.png"
      artworkContentType = "image/png"
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
          "PDF artwork can't be used for AI mockups yet. Upload a PNG, JPEG, WebP, or SVG version. Your PDF stays saved for partner handoff.",
      },
      { status: 400 },
    )
  }

  // --- pull base image (may be a full URL pointing at partner CDN, or a
  //     path inside our public store-images bucket) ---
  let baseBuffer: Buffer
  let baseName: string
  if (/^https?:\/\//i.test(base_image_path)) {
    baseBuffer = await fetchAsBuffer(base_image_path)
    baseName = base_image_path.split("/").pop()?.split("?")[0] || "base.png"
  } else {
    const { data: baseBlob, error: baseErr } = await supabase.storage
      .from(STORE_IMAGES_BUCKET)
      .download(base_image_path)
    if (baseErr || !baseBlob) {
      return NextResponse.json(
        {
          error: `Failed to load base image: ${baseErr?.message ?? "not found"}`,
        },
        { status: 404 },
      )
    }
    baseBuffer = Buffer.from(await baseBlob.arrayBuffer())
    baseName = base_image_path.split("/").pop() || "base.png"
  }

  // --- composite the artwork into the base image so the AI receives the
  //     exact pixels we want, not a description ---
  //
  // gpt-image-1 with multiple input images treats the secondary image as
  // "inspiration" and re-renders something similar from scratch. Instead we
  // bake the artwork into the base via sharp at the configured x/y/scale/
  // rotation, then ask the model to *refine* the result (add fabric texture,
  // shadows, etc.) — preserving the artwork's actual content.

  let compositedBuffer: Buffer
  try {
    const baseMeta = await sharp(baseBuffer).metadata()
    const bw = baseMeta.width ?? 1024
    const bh = baseMeta.height ?? 1024

    // Recolor the artwork for single_ink mode. The 'in' blend mode keeps the
    // ink color only where the artwork is opaque, preserving its shape.
    let preparedArtwork = artworkBuffer
    if (
      mockupOptions.colorMode === "single_ink" &&
      mockupOptions.inkColorHex
    ) {
      const hex = mockupOptions.inkColorHex.replace(/^#/, "")
      const r = parseInt(hex.slice(0, 2), 16) || 0
      const g = parseInt(hex.slice(2, 4), 16) || 0
      const b = parseInt(hex.slice(4, 6), 16) || 0
      const artMeta = await sharp(artworkBuffer).metadata()
      const aw = artMeta.width ?? 1024
      const ah = artMeta.height ?? 1024
      const tintLayer = await sharp({
        create: {
          width: aw,
          height: ah,
          channels: 4,
          background: { r, g, b, alpha: 1 },
        },
      })
        .png()
        .toBuffer()
      preparedArtwork = await sharp(artworkBuffer)
        .ensureAlpha()
        .composite([{ input: tintLayer, blend: "in" }])
        .png()
        .toBuffer()
    }

    // Resize the artwork to design.scale × base width, then rotate (with a
    // transparent background so the rotated bounding box doesn't add a fill).
    const targetArtWidth = Math.max(16, Math.round(design.scale * bw))
    const resizedArt = await sharp(preparedArtwork)
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
    const clippedLeft = Math.min(left, bw - 1)
    const clippedTop = Math.min(top, bh - 1)

    compositedBuffer = await sharp(baseBuffer)
      .composite([{ input: rotatedArt, left: clippedLeft, top: clippedTop }])
      .png()
      .toBuffer()
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to composite artwork: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    )
  }

  // --- call OpenAI ---
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const compositeUpload = await toFile(compositedBuffer, "composited.png", {
    type: "image/png",
  })

  let b64: string | undefined
  try {
    const response = await client.images.edit({
      model: "gpt-image-1",
      image: compositeUpload,
      prompt,
      n: 1,
      size: "1024x1024",
    })
    b64 = response.data?.[0]?.b64_json
  } catch (err: any) {
    return NextResponse.json(
      {
        error: `OpenAI image generation failed: ${err?.message ?? String(err)}`,
      },
      { status: 502 },
    )
  }

  if (!b64) {
    return NextResponse.json(
      { error: "OpenAI returned no image data" },
      { status: 502 },
    )
  }

  // --- upload to our public bucket as the variant's new image_path ---
  const mockupBuffer = Buffer.from(b64, "base64")
  const filename = `mockup-${crypto.randomUUID()}.png`
  const newPath = orgVariantImagePath(
    activeAccountId,
    product_id,
    variant_id,
    filename,
  )

  const { error: uploadErr } = await supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .upload(newPath, mockupBuffer, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "3600",
    })
  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadErr.message}` },
      { status: 500 },
    )
  }

  // --- persist on the variant ---
  const { error: updateErr } = await supabase
    .from("org_product_variants")
    .update({ image_path: newPath })
    .eq("id", variant_id)
  if (updateErr) {
    return NextResponse.json(
      { error: `DB update failed: ${updateErr.message}` },
      { status: 500 },
    )
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORE_IMAGES_BUCKET)
    .getPublicUrl(newPath)

  return NextResponse.json({
    image_path: newPath,
    image_url: publicUrlData.publicUrl,
  })
}
