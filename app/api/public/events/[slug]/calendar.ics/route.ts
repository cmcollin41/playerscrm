import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildEventIcs, icsFilename } from "@/lib/events/ics"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get("account_id")

  if (!accountId) {
    return NextResponse.json(
      { error: "account_id query parameter is required" },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const supabase = await createClient()

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, name, description, location, starts_at, ends_at, account_id",
    )
    .eq("account_id", accountId)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (error || !event) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("id, title, description, location, starts_at, ends_at, ordering")
    .eq("event_id", event.id)
    .order("ordering", { ascending: true })
    .order("starts_at", { ascending: true })

  const ics = buildEventIcs({
    event,
    sessions: sessions || [],
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event.name)}"`,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  })
}
