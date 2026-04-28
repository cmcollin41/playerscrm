import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface PublicEvent {
  id: string
  slug: string
  name: string
  description: string | null
  location: string | null
  starts_at: string | null
  ends_at: string | null
  registration_opens_at: string | null
  registration_closes_at: string | null
  capacity: number | null
  fee_amount: number
  fee_description: string | null
  registration_open: boolean
  register_url: string
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("account_id")
    const slug = searchParams.get("slug")
    const includePast = searchParams.get("include_past") === "true"

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

    let query = supabase
      .from("events")
      .select(
        "id, slug, name, description, location, starts_at, ends_at, registration_opens_at, registration_closes_at, capacity, fee_amount, fee_description",
      )
      .eq("account_id", accountId)
      .eq("is_published", true)

    if (slug) {
      query = query.eq("slug", slug)
    }

    if (!includePast && !slug) {
      query = query.or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    }

    query = query.order("starts_at", { ascending: true, nullsFirst: false })

    const { data: events, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500, headers: CORS_HEADERS },
      )
    }

    const now = new Date()
    const publicEvents: PublicEvent[] = (events ?? []).map((e) => {
      const opensAt = e.registration_opens_at ? new Date(e.registration_opens_at) : null
      const closesAt = e.registration_closes_at ? new Date(e.registration_closes_at) : null
      const registrationOpen =
        (!opensAt || opensAt <= now) && (!closesAt || closesAt > now)

      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        description: e.description,
        location: e.location,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        registration_opens_at: e.registration_opens_at,
        registration_closes_at: e.registration_closes_at,
        capacity: e.capacity,
        fee_amount: e.fee_amount,
        fee_description: e.fee_description,
        registration_open: registrationOpen,
        register_url: buildRegisterUrl(account, e.slug),
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
