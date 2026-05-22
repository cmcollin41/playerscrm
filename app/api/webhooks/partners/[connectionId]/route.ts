/**
 * POST /api/webhooks/partners/[connectionId]
 *
 * Inbound webhooks from fulfillment partners (Printify, ...). Per-connection
 * URLs keep webhook secrets isolated per merchant integration:
 *   https://{tenant}.athletes.app/api/webhooks/partners/{connectionId}
 *
 * Routes two event families based on the adapter-normalized WebhookEvent.kind:
 *   - "order"                    → update store_order_dispatches
 *   - "product_publish_started"  → ack publishing_succeeded so the partner
 *                                  unlocks the product (Printify locks them
 *                                  in "Publishing..." otherwise)
 *
 * Each delivery is acked with 200 even when our internal matching fails —
 * otherwise the partner retries indefinitely for events we can't act on.
 */

import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@/lib/supabase/admin"
import { loadConnection } from "@/lib/integrations/products/connections"
import { productStorefrontUrl } from "@/lib/store/links"
import type { DispatchStatus } from "@/lib/integrations/products/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ connectionId: string }>
}

function fulfilledAtFor(status: DispatchStatus): string | null {
  return status === "fulfilled" ? new Date().toISOString() : null
}

export async function POST(req: Request, { params }: RouteContext) {
  const { connectionId } = await params

  const supabase = createAdminClient()

  // We need the connection's account_id to scope-bind. Pre-fetch a thin row
  // so loadConnection (which double-binds on account_id) has it.
  const { data: connRow, error: connErr } = await supabase
    .from("account_partner_connections")
    .select("account_id, is_active")
    .eq("id", connectionId)
    .maybeSingle()

  if (connErr || !connRow) {
    console.warn("[partner-webhook] unknown connection", connectionId)
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  if (!connRow.is_active) {
    return NextResponse.json({ ok: false, reason: "disabled" }, { status: 200 })
  }

  let conn
  try {
    conn = await loadConnection(
      connectionId,
      connRow.account_id as string,
      supabase,
    )
  } catch (err) {
    console.error("[partner-webhook] loadConnection failed", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  // Verify before reading the body as JSON — the adapter clones the request
  // to compute HMAC over the raw bytes.
  if (!conn.adapter.verifyWebhook) {
    return NextResponse.json(
      { ok: false, reason: "adapter does not implement verifyWebhook" },
      { status: 501 },
    )
  }
  const valid = await conn.adapter.verifyWebhook(req, conn.ctx)
  if (!valid) {
    console.warn("[partner-webhook] signature verification failed", {
      connectionId,
      partner: conn.partnerSlug,
    })
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 })
  }

  if (!conn.adapter.handleWebhook) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }
  const event = await conn.adapter.handleWebhook(bodyJson, conn.ctx)
  if (!event) {
    // Adapter chose to ignore this event type — ack so the partner stops retrying.
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  if (event.kind === "product_publish_started") {
    // Partner started a publish from their dashboard. Look up the mirror
    // product (if any) on our side and ack the publish so the partner unlocks
    // the product. If we don't know about the product yet, ack-fail so the
    // merchant can keep editing.
    if (!conn.adapter.markPublishSucceeded || !conn.adapter.markPublishFailed) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    const { data: productRow } = await supabase
      .from("org_products")
      .select("id, slug")
      .eq("connection_id", connectionId)
      .eq("external_product_id", event.externalProductId)
      .maybeSingle()

    if (!productRow) {
      try {
        await conn.adapter.markPublishFailed(
          conn.ctx,
          event.externalProductId,
          "Product not imported to storefront yet.",
        )
      } catch (err) {
        console.error("[partner-webhook] markPublishFailed error", err)
      }
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("subdomain, custom_domain")
      .eq("id", connRow.account_id as string)
      .maybeSingle()
    const handle = account
      ? productStorefrontUrl(account, (productRow as { slug: string }).slug)
      : null
    if (!handle) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    try {
      await conn.adapter.markPublishSucceeded(
        conn.ctx,
        event.externalProductId,
        { externalId: (productRow as { id: string }).id, handle },
      )
    } catch (err) {
      console.error("[partner-webhook] markPublishSucceeded error", err)
      // Still 200 — the partner will retry on its own schedule.
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // Order event from here on.
  // Find the dispatch row this event refers to. Scope by connection so
  // collisions across merchants are impossible.
  const { data: dispatchRow, error: dispatchErr } = await supabase
    .from("store_order_dispatches")
    .select("id, status")
    .eq("connection_id", connectionId)
    .eq("external_order_id", event.externalOrderId)
    .maybeSingle()

  if (dispatchErr) {
    console.error("[partner-webhook] dispatch lookup failed", dispatchErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if (!dispatchRow) {
    // Likely a stale order we don't own — still 200 so the partner stops retrying.
    console.warn("[partner-webhook] no matching dispatch", {
      connectionId,
      externalOrderId: event.externalOrderId,
    })
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  const patch: Record<string, unknown> = {
    status: event.status,
  }
  const fulfilledAt = fulfilledAtFor(event.status)
  if (fulfilledAt) patch.fulfilled_at = fulfilledAt
  if (event.tracking) patch.tracking = event.tracking

  const { error: updateErr } = await supabase
    .from("store_order_dispatches")
    .update(patch)
    .eq("id", dispatchRow.id as string)

  if (updateErr) {
    console.error("[partner-webhook] dispatch update failed", updateErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
