import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface PublicPlayerTeam {
  id: string
  name: string | null
  slug: string | null
  icon: string | null
  jersey_number: number | null
  position: string | null
  grade: string | null
  season_bio: string | null
  photo: string | null
  awards: { title: string; slug: string | null; category: string | null }[]
}

interface PublicPlayerStat {
  season_label: string
  class_label: string | null
  gp: number | null
  ppg: number | null
  rpg: number | null
  apg: number | null
  spg: number | null
  bpg: number | null
  fg_pct: number | null
  three_pct: number | null
  ft_pct: number | null
  is_career_total: boolean
}

interface PublicPlayer {
  id: string
  slug: string | null
  first_name: string | null
  last_name: string | null
  name: string | null
  photo: string | null
  height: string | null
  weight_lbs: number | null
  grad_year: number | null
  hometown: string | null
  bio: string | null
  instagram: string | null
  twitter: string | null
  hudl_url: string | null
  teams: PublicPlayerTeam[]
  stats: PublicPlayerStat[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("account_id")
    const slug = searchParams.get("slug")
    const awardFilter = searchParams.get("award")

    if (!accountId) {
      return NextResponse.json(
        { error: "account_id query parameter is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Query rosters joined through to people and teams,
    // filtering to only public/active/varsity teams
    let query = supabase
      .from("rosters")
      .select(`
        id,
        jersey_number,
        position,
        grade,
        bio,
        height,
        photo,
        roster_awards(
          title,
          award_type_id,
          award_types(slug, category)
        ),
        people!inner(
          id,
          slug,
          first_name,
          last_name,
          name,
          photo,
          height,
          weight_lbs,
          grad_year,
          hometown,
          bio,
          instagram,
          twitter,
          hudl_url,
          is_public
        ),
        teams!inner(
          id,
          name,
          slug,
          icon,
          account_id,
          is_active,
          is_public,
          level
        )
      `)
      .eq("teams.account_id", accountId)
      .eq("teams.is_active", true)
      .eq("teams.is_public", true)
      .eq("teams.level", "varsity")
      .eq("people.is_public", true)

    if (slug) {
      query = query.eq("people.slug", slug)
    }

    const { data: rosters, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch players" },
        { status: 500 }
      )
    }

    // Group roster entries by person
    const playerMap = new Map<string, PublicPlayer>()

    for (const r of rosters ?? []) {
      const person = Array.isArray(r.people) ? r.people[0] : r.people
      const team = Array.isArray(r.teams) ? r.teams[0] : r.teams
      if (!person?.id || !team?.id) continue

      const teamEntry: PublicPlayerTeam = {
        id: team.id,
        name: team.name,
        slug: team.slug ?? null,
        icon: team.icon ?? null,
        jersey_number: r.jersey_number ?? null,
        position: r.position ?? null,
        grade: r.grade ?? null,
        season_bio: r.bio ?? null,
        photo: r.photo ?? null,
        awards: (r.roster_awards ?? []).map((a: any) => {
          const awardType = Array.isArray(a.award_types) ? a.award_types[0] : a.award_types
          return {
            title: a.title,
            slug: awardType?.slug ?? null,
            category: awardType?.category ?? null,
          }
        }),
      }

      const existing = playerMap.get(person.id)
      if (existing) {
        existing.teams.push(teamEntry)
      } else {
        playerMap.set(person.id, {
          id: person.id,
          slug: person.slug ?? null,
          first_name: person.first_name ?? null,
          last_name: person.last_name ?? null,
          name: person.name ?? null,
          photo: person.photo ?? null,
          height: person.height ?? null,
          weight_lbs: person.weight_lbs ?? null,
          grad_year: person.grad_year ?? null,
          hometown: person.hometown ?? null,
          bio: person.bio ?? null,
          instagram: person.instagram ?? null,
          twitter: person.twitter ?? null,
          hudl_url: person.hudl_url ?? null,
          teams: [teamEntry],
          stats: [],
        })
      }
    }

    // Batch-fetch stats for all players
    const personIds = Array.from(playerMap.keys())
    if (personIds.length > 0) {
      const { data: statsData } = await supabase
        .from("player_season_stats")
        .select("person_id, season_label, class_label, gp, ppg, rpg, apg, spg, bpg, fg_pct, three_pct, ft_pct, is_career_total")
        .in("person_id", personIds)
        .order("is_career_total", { ascending: true })
        .order("season_year_start", { ascending: false })

      for (const stat of statsData ?? []) {
        const player = playerMap.get(stat.person_id)
        if (player) {
          player.stats.push({
            season_label: stat.season_label,
            class_label: stat.class_label,
            gp: stat.gp,
            ppg: stat.ppg,
            rpg: stat.rpg,
            apg: stat.apg,
            spg: stat.spg,
            bpg: stat.bpg,
            fg_pct: stat.fg_pct,
            three_pct: stat.three_pct,
            ft_pct: stat.ft_pct,
            is_career_total: stat.is_career_total,
          })
        }
      }
    }

    // Filter by award slug if requested
    if (awardFilter) {
      for (const [id, player] of playerMap) {
        const hasAward = player.teams.some((t) =>
          t.awards.some((a) => a.slug === awardFilter)
        )
        if (!hasAward) playerMap.delete(id)
      }
    }

    const players = Array.from(playerMap.values()).sort((a, b) => {
      const aName = a.last_name ?? a.name ?? ""
      const bName = b.last_name ?? b.name ?? ""
      return aName.localeCompare(bName)
    })

    if (slug && players.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      slug ? { player: players[0] } : { players },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
