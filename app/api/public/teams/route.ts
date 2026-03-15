import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface PublicPlayer {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  photo: string | null
  height: string | null
  weight_lbs: number | null
  grad_year: number | null
  hometown: string | null
  bio: string | null
  jersey_number: number | null
  position: string | null
  grade: string | null
}

interface PublicStaff {
  id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  photo: string | null
}

interface PublicTeam {
  id: string
  name: string | null
  level: string
  icon: string | null
  slug: string | null
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
        staff(
          id,
          people(
            id,
            first_name,
            last_name,
            name,
            photo
          )
        ),
        rosters(
          jersey_number,
          position,
          grade,
          people(
            id,
            first_name,
            last_name,
            name,
            photo,
            height,
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

    const publicTeams: PublicTeam[] = (teams ?? []).map((team: any) => ({
      id: team.id,
      name: team.name,
      level: team.level,
      icon: team.icon,
      slug: team.slug,
      staff: (team.staff ?? []).map((s: any) => ({
        id: s.people?.id,
        first_name: s.people?.first_name ?? null,
        last_name: s.people?.last_name ?? null,
        name: s.people?.name ?? null,
        photo: s.people?.photo ?? null,
      })),
      players: (team.rosters ?? [])
        .filter((r: any) => r.people?.is_public === true)
        .map((r: any) => ({
          id: r.people?.id,
          first_name: r.people?.first_name ?? null,
          last_name: r.people?.last_name ?? null,
          name: r.people?.name ?? null,
          photo: r.people?.photo ?? null,
          height: r.people?.height ?? null,
          weight_lbs: r.people?.weight_lbs ?? null,
          grad_year: r.people?.grad_year ?? null,
          hometown: r.people?.hometown ?? null,
          bio: r.people?.bio ?? null,
          jersey_number: r.jersey_number ?? null,
          position: r.position ?? null,
          grade: r.grade ?? null,
        })),
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
