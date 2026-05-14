import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildEventIcs, buildSeriesIcs, icsFilename } from "@/lib/events/ics"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const includeSeries = searchParams.get("series") === "1"
  const supabase = await createClient()

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, name, description, location, starts_at, ends_at, is_published, account_id, series_id",
    )
    .eq("id", id)
    .single()

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  if (!event.is_published) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single()
    if (!profile || profile.account_id !== event.account_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
  }

  if (includeSeries && event.series_id) {
    const { data: seriesEvents } = await supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, is_published, account_id, series_index",
      )
      .eq("account_id", event.account_id)
      .eq("series_id", event.series_id)
      .eq("is_published", true)
      .order("series_index", { ascending: true })

    const seriesEventIds = (seriesEvents || []).map((e) => e.id)
    const { data: allSessions } = seriesEventIds.length
      ? await supabase
          .from("event_sessions")
          .select(
            "id, event_id, title, description, location, starts_at, ends_at, ordering",
          )
          .in("event_id", seriesEventIds)
          .order("ordering", { ascending: true })
          .order("starts_at", { ascending: true })
      : { data: [] as any[] }

    const sessionsByEvent = new Map<string, any[]>()
    for (const s of allSessions || []) {
      const arr = sessionsByEvent.get(s.event_id) || []
      arr.push(s)
      sessionsByEvent.set(s.event_id, arr)
    }

    const ics = buildSeriesIcs({
      calendarName: event.name,
      events: (seriesEvents || []).map((e) => ({
        event: e,
        sessions: sessionsByEvent.get(e.id) || [],
      })),
    })

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${icsFilename(event.name)}"`,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  }

  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("id, title, description, location, starts_at, ends_at, ordering")
    .eq("event_id", id)
    .order("ordering", { ascending: true })
    .order("starts_at", { ascending: true })

  const ics = buildEventIcs({
    event,
    sessions: sessions || [],
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event.name)}"`,
      "Cache-Control": event.is_published
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "private, no-store",
    },
  })
}
