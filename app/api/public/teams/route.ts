import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface PublicTeamRef {
  id: string
  name: string | null
  slug: string | null
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
  season_bio: string | null
  jersey_number: number | null
  position: string | null
  grade: string | null
  awards: PublicAward[]
  teams: PublicTeamRef[]
}

interface PublicStaff {
  id: string
  slug: string | null
  first_name: string | null
  last_name: string | null
  name: string | null
  photo: string | null
}

interface PublicAward {
  title: string
  year?: number | null
}

interface PublicTeam {
  id: string
  name: string | null
  level: string
  icon: string | null
  slug: string | null
  awards: PublicAward[]
  staff: PublicStaff[]
  players: PublicPlayer[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("account_id")

    if (!accountId) {
      return NextResponse.json(
        { error: "account_id query parameter is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: teams, error } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        level,
        icon,
        slug,
        team_awards(
          title,
          year
        ),
        staff(
          id,
          photo,
          people(
            id,
            slug,
            first_name,
            last_name,
            name,
            photo
          )
        ),
        rosters(
          id,
          photo,
          jersey_number,
          position,
          grade,
          bio,
          height,
          roster_awards(
            title
          ),
          people(
            id,
            slug,
            first_name,
            last_name,
            name,
            photo,
            weight_lbs,
            grad_year,
            hometown,
            bio,
            is_public
          )
        )
      `)
      .eq("account_id", accountId)
      .eq("is_active", true)
      .eq("is_public", true)
      .eq("level", "varsity")
      .order("name")

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch teams" },
        { status: 500 }
      )
    }

    const personToTeams = new Map<string, PublicTeamRef[]>()
    for (const team of teams ?? []) {
      for (const r of team.rosters ?? []) {
        const person = Array.isArray(r.people) ? r.people[0] : r.people
        const personId = person?.id
        if (!personId || person?.is_public !== true) continue
        const ref = { id: team.id, name: team.name, slug: team.slug ?? null }
        const existing = personToTeams.get(personId) ?? []
        if (!existing.some((t) => t.id === team.id)) {
          personToTeams.set(personId, [...existing, ref])
        }
      }
    }

    const publicTeams: PublicTeam[] = (teams ?? []).map((team: any) => ({
      id: team.id,
      name: team.name,
      level: team.level,
      icon: team.icon,
      slug: team.slug,
      awards: (team.team_awards ?? []).map((a: any) => ({
        title: a.title,
        year: a.year ?? null,
      })),
      staff: (team.staff ?? []).map((s: any) => ({
        id: (Array.isArray(s.people) ? s.people[0] : s.people)?.id,
        slug: (Array.isArray(s.people) ? s.people[0] : s.people)?.slug ?? null,
        first_name: (Array.isArray(s.people) ? s.people[0] : s.people)?.first_name ?? null,
        last_name: (Array.isArray(s.people) ? s.people[0] : s.people)?.last_name ?? null,
        name: (Array.isArray(s.people) ? s.people[0] : s.people)?.name ?? null,
        photo: s.photo ?? (Array.isArray(s.people) ? s.people[0] : s.people)?.photo ?? null,
      })),
      players: (team.rosters ?? [])
        .filter((r: any) => {
          const p = Array.isArray(r.people) ? r.people[0] : r.people
          return p?.is_public === true
        })
        .map((r: any) => {
          const p = Array.isArray(r.people) ? r.people[0] : r.people
          return {
          id: p?.id,
          slug: p?.slug ?? null,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          name: p?.name ?? null,
          photo: r.photo ?? p?.photo ?? null,
          height: r.height ?? null,
          weight_lbs: p?.weight_lbs ?? null,
          grad_year: p?.grad_year ?? null,
          hometown: p?.hometown ?? null,
          bio: p?.bio ?? null,
          season_bio: r.bio ?? null,
          jersey_number: r.jersey_number ?? null,
          position: r.position ?? null,
          grade: r.grade ?? null,
          awards: (r.roster_awards ?? []).map((a: any) => ({
            title: a.title,
          })),
          teams: personToTeams.get(p?.id) ?? [],
        }
        }),
    }))

    return NextResponse.json(
      { teams: publicTeams },
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
