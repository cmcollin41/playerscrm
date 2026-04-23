import { NextResponse } from "next/server"
import { Webhook } from "svix"
import { createClient } from "@/lib/supabase/admin"

export async function POST(req: Request) {
  if (!process.env.RESEND_DOMAIN_WEBHOOK_SECRET) {
    console.error("RESEND_DOMAIN_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let event: { type: string; data: any }
  try {
    const wh = new Webhook(process.env.RESEND_DOMAIN_WEBHOOK_SECRET)
    event = wh.verify(payload, headers) as { type: string; data: any }
  } catch (err) {
    console.error("Resend domain webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const { type, data } = event
  const resendDomainId: string | undefined = data?.id
  if (!resendDomainId) {
    return NextResponse.json({ message: "No domain id in payload" }, { status: 200 })
  }

  const supabase = createClient()

  const { data: row } = await supabase
    .from("sender_domains")
    .select("id, verification_status")
    .eq("resend_domain_id", resendDomainId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ message: "Domain not tracked, skipping" }, { status: 200 })
  }

  if (type === "domain.deleted") {
    await supabase.from("sender_domains").delete().eq("id", row.id)
    return NextResponse.json({ message: "Domain row deleted" }, { status: 200 })
  }

  const rawStatus: string | undefined = data?.status
  const status =
    rawStatus === "verified"
      ? "verified"
      : rawStatus === "failed" || rawStatus === "temporary_failure"
        ? "failed"
        : "pending"

  await supabase
    .from("sender_domains")
    .update({
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      dns_records: data?.records ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)

  return NextResponse.json({ message: "ok", status }, { status: 200 })
}
