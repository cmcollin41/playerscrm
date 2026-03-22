import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  buildStatsUrl,
  scrapeMaxPrepsStats,
  parseSeasonYears,
} from "@/lib/maxpreps"

export async function POST(req: Request) {
  try {
    const profile = await requireAuth()

    const { person_id, sport, gender } = await req.json()

    if (!person_id) {
      return NextResponse.json(
        { error: "person_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch person and verify ownership
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id, account_id, maxpreps_url")
      .eq("id", person_id)
      .single()

    if (personError || !person) {
      return NextResponse.json(
        { error: "Person not found" },
        { status: 404 }
      )
    }

    if (person.account_id !== profile.account_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!person.maxpreps_url) {
      return NextResponse.json(
        { error: "No MaxPreps URL set for this person" },
        { status: 400 }
      )
    }

    // Build stats URL and scrape
    const statsUrl = buildStatsUrl(
      person.maxpreps_url,
      sport || "basketball",
      gender || "boys"
    )

    const result = await scrapeMaxPrepsStats(statsUrl)

    console.log("MaxPreps scrape result:", JSON.stringify(result, null, 2))
    console.log("Stats URL used:", statsUrl)

    // Upsert each season's stats
    const upsertRows = result.seasons.map((s) => {
      const years = parseSeasonYears(s.season_label)
      return {
        person_id: person.id,
        account_id: person.account_id,
        sport: result.sport,
        season_label: s.season_label,
        season_year_start: years.year_start,
        season_year_end: years.year_end,
        class_label: s.class_label,
        gp: s.gp != null ? Math.round(s.gp) : null,
        ppg: s.ppg,
        rpg: s.rpg,
        apg: s.apg,
        spg: s.spg,
        bpg: s.bpg,
        fg_pct: s.fg_pct,
        three_pct: s.three_pct,
        ft_pct: s.ft_pct,
        topg: s.topg,
        mpg: s.mpg,
        is_career_total: s.is_career_total,
        source: "maxpreps",
        raw_data: s.raw_data,
        updated_at: new Date().toISOString(),
      }
    })

    const { data: stats, error: upsertError } = await supabase
      .from("player_season_stats")
      .upsert(upsertRows, {
        onConflict: "person_id,season_label,sport,is_career_total",
      })
      .select()

    if (upsertError) {
      console.error("Upsert error:", upsertError)
      return NextResponse.json(
        { error: `Failed to save stats: ${upsertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, stats })
  } catch (error: any) {
    console.error("MaxPreps sync error:", error)

    if (
      error.message?.includes("Unauthorized") ||
      error.message?.includes("not authenticated")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(
      { error: error.message || "Failed to sync stats" },
      { status: 502 }
    )
  }
}
