import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type EventType = "camp" | "practice" | "game" | "other"
const VALID_EVENT_TYPES: EventType[] = ["camp", "practice", "game", "other"]

interface PublicTeamRef {
  id: string
  slug: string | null
  name: string | null
}

interface PublicEvent {
  id: string
  slug: string
  name: string
  event_type: EventType
  description: string | null
  location: string | null
  starts_at: string | null
  ends_at: string | null
  arrival_time: string | null
  image_url: string | null
  team: PublicTeamRef | null
  opponent_name: string | null
  is_home: boolean | null
  // camp/registration-only fields — null for practices/games
  registration_opens_at: string | null
  registration_closes_at: string | null
  capacity: number | null
  fee_amount: number | null
  fee_description: string | null
  registration_open: boolean | null
  register_url: string | null
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
}

function buildRegisterUrl(
  account: { subdomain: string | null; custom_domain: string | null },
  slug: string,
) {
  const host =
    account.custom_domain ||
    `${account.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
  return `https://${host}/register/${slug}`
}

function parseEventTypes(raw: string | null): EventType[] | null {
  if (!raw) return null
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length === 0) return null
  const valid = parts.filter((p): p is EventType =>
    (VALID_EVENT_TYPES as string[]).includes(p),
  )
  return valid.length ? valid : null
}

function parseLimit(raw: string | null): number {
  const DEFAULT = 50
  const MAX = 200
  if (!raw) return DEFAULT
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT
  return Math.min(n, MAX)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("account_id")
    const slug = searchParams.get("slug")
    const includePast = searchParams.get("include_past") === "true"
    const teamIdParam = searchParams.get("team_id")
    const teamSlugParam = searchParams.get("team_slug")
    const eventTypes = parseEventTypes(searchParams.get("event_type"))
    const startsAfter = searchParams.get("starts_after")
    const startsBefore = searchParams.get("starts_before")
    const limit = parseLimit(searchParams.get("limit"))

    if (!accountId) {
      return NextResponse.json(
        { error: "account_id query parameter is required" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const supabase = await createClient()

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, subdomain, custom_domain")
      .eq("id", accountId)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    let resolvedTeamId: string | null = teamIdParam
    if (!resolvedTeamId && teamSlugParam) {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("account_id", accountId)
        .eq("slug", teamSlugParam)
        .maybeSingle()

      if (!team) {
        return NextResponse.json(
          { events: [] },
          { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
        )
      }
      resolvedTeamId = team.id
    }

    let query = supabase
      .from("events")
      .select(
        "id, slug, name, event_type, description, location, starts_at, ends_at, arrival_time, registration_opens_at, registration_closes_at, capacity, fee_amount, fee_description, image_url, team_id, opponent_name, is_home, teams(id, slug, name, is_public)",
      )
      .eq("account_id", accountId)
      .eq("is_published", true)

    if (slug) {
      query = query.eq("slug", slug)
    }

    if (resolvedTeamId) {
      query = query.eq("team_id", resolvedTeamId)
    }

    if (eventTypes) {
      query = query.in("event_type", eventTypes)
    }

    if (startsAfter) {
      query = query.gte("starts_at", startsAfter)
    }
    if (startsBefore) {
      query = query.lte("starts_at", startsBefore)
    }

    if (!includePast && !slug) {
      query = query.or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    }

    query = query
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(slug ? 1 : limit)

    const { data: events, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500, headers: CORS_HEADERS },
      )
    }

    const now = new Date()
    const publicEvents: PublicEvent[] = (events ?? [])
      .filter((e: any) => {
        // Hide events tied to non-public teams even for authenticated callers
        if (!e.team_id) return true
        return e.teams?.is_public === true
      })
      .map((e: any) => {
        const eventType = (e.event_type as EventType) ?? "camp"
        // Games and practices are calendar items; camps and "other" can take
        // registrations (free or paid).
        const isRegisterable = eventType === "camp" || eventType === "other"

        const opensAt = e.registration_opens_at
          ? new Date(e.registration_opens_at)
          : null
        const closesAt = e.registration_closes_at
          ? new Date(e.registration_closes_at)
          : null
        const registrationOpen = isRegisterable
          ? (!opensAt || opensAt <= now) && (!closesAt || closesAt > now)
          : null

        const team: PublicTeamRef | null = e.teams
          ? { id: e.teams.id, slug: e.teams.slug, name: e.teams.name }
          : null

        return {
          id: e.id,
          slug: e.slug,
          name: e.name,
          event_type: eventType,
          description: e.description,
          location: e.location,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          arrival_time: e.arrival_time,
          image_url: e.image_url,
          team,
          opponent_name: eventType === "game" ? e.opponent_name : null,
          is_home: eventType === "game" ? e.is_home : null,
          registration_opens_at: isRegisterable ? e.registration_opens_at : null,
          registration_closes_at: isRegisterable ? e.registration_closes_at : null,
          capacity: isRegisterable ? e.capacity : null,
          fee_amount: isRegisterable ? e.fee_amount : null,
          fee_description: isRegisterable ? e.fee_description : null,
          registration_open: registrationOpen,
          register_url: isRegisterable ? buildRegisterUrl(account, e.slug) : null,
        }
      })

    if (slug) {
      if (publicEvents.length === 0) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404, headers: CORS_HEADERS },
        )
      }
      return NextResponse.json(
        { event: publicEvents[0] },
        { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
      )
    }

    return NextResponse.json(
      { events: publicEvents },
      { headers: { ...CORS_HEADERS, ...CACHE_HEADERS } },
    )
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
