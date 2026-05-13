import { createClient } from "@/lib/supabase/server"
import { requirePortalContext } from "@/lib/portal-auth"

export const dynamic = "force-dynamic"

interface RosterRow {
  id: string
  jersey_number: number | null
  position: string | null
  grade: string | null
  person_id: string | null
  people: { id: string; first_name: string | null; last_name: string | null } | null
  teams: {
    id: string
    name: string | null
    level: string | null
    coach: string | null
    seasons: { id: string; display_name: string; year_start: number } | null
  } | null
}

export default async function PortalTeamsPage() {
  const ctx = await requirePortalContext()
  const supabase = await createClient()

  const { data: rosters } = await supabase
    .from("rosters")
    .select(
      `id, jersey_number, position, grade, person_id,
       people:person_id (id, first_name, last_name),
       teams:team_id (id, name, level, coach, seasons:season_id (id, display_name, year_start))`,
    )
    .in(
      "person_id",
      ctx.accessiblePersonIds.length ? ctx.accessiblePersonIds : [""],
    )
    .returns<RosterRow[]>()

  // Group by season (most recent first), then by team.
  type SeasonBucket = {
    seasonKey: string
    seasonName: string
    yearStart: number
    teams: Map<string, { teamName: string; coach: string | null; rows: RosterRow[] }>
  }
  const buckets = new Map<string, SeasonBucket>()

  for (const row of rosters ?? []) {
    const season = row.teams?.seasons
    const seasonKey = season?.id ?? "no-season"
    const seasonName = season?.display_name ?? "Unscheduled"
    const yearStart = season?.year_start ?? 0
    if (!buckets.has(seasonKey)) {
      buckets.set(seasonKey, { seasonKey, seasonName, yearStart, teams: new Map() })
    }
    const bucket = buckets.get(seasonKey)!
    const teamKey = row.teams?.id ?? "no-team"
    if (!bucket.teams.has(teamKey)) {
      bucket.teams.set(teamKey, {
        teamName: row.teams?.name ?? "Unnamed team",
        coach: row.teams?.coach ?? null,
        rows: [],
      })
    }
    bucket.teams.get(teamKey)!.rows.push(row)
  }

  const sortedBuckets = Array.from(buckets.values()).sort(
    (a, b) => b.yearStart - a.yearStart,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Teams</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every team your family is rostered on, organized by season.
        </p>
      </div>

      {sortedBuckets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {sortedBuckets.map((bucket) => (
            <section key={bucket.seasonKey}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {bucket.seasonName}
              </h2>
              <div className="space-y-3">
                {Array.from(bucket.teams.values()).map((team) => (
                  <div
                    key={team.teamName}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="font-medium text-gray-900">{team.teamName}</p>
                      {team.coach && (
                        <p className="text-xs text-gray-500">
                          Coach {team.coach}
                        </p>
                      )}
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {team.rows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between px-4 py-3 text-sm"
                        >
                          <span className="text-gray-900">
                            {[row.people?.first_name, row.people?.last_name]
                              .filter(Boolean)
                              .join(" ") || "Unnamed"}
                          </span>
                          <span className="flex items-center gap-3 text-xs text-gray-500">
                            {row.jersey_number != null && (
                              <span>#{row.jersey_number}</span>
                            )}
                            {row.position && <span>{row.position}</span>}
                            {row.grade && <span>Grade {row.grade}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
      No roster spots yet. Once you or a dependent is added to a team, it
      will show up here.
    </div>
  )
}
