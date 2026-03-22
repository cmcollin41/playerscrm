import * as cheerio from "cheerio"

export interface ParsedSeasonStats {
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
  topg: number | null
  mpg: number | null
  is_career_total: boolean
  raw_data: Record<string, string>
}

export interface ScrapeResult {
  seasons: ParsedSeasonStats[]
  sport: string
}

/**
 * Build the MaxPreps stats URL from a base athlete URL.
 */
export function buildStatsUrl(
  baseUrl: string,
  sport = "basketball",
  gender = "boys"
): string {
  const url = new URL(baseUrl)
  let pathname = url.pathname.replace(/\/+$/, "")
  pathname = pathname.replace(
    /\/(basketball|football|baseball|soccer|volleyball|track-and-field|wrestling|swimming)\/(boys|girls)\/(stats|schedule)\/?/,
    ""
  )
  pathname = `${pathname}/${sport}/${gender}/stats/`
  url.pathname = pathname
  return url.toString()
}

/**
 * Parse season label like "2025-26" or "25-26" into year_start and year_end.
 */
export function parseSeasonYears(label: string): {
  year_start: number | null
  year_end: number | null
} {
  const match = label.match(/(\d{2,4})-(\d{2,4})/)
  if (!match) return { year_start: null, year_end: null }

  let yearStart = parseInt(match[1])
  if (match[1].length === 2) yearStart = 2000 + yearStart

  let yearEnd: number
  if (match[2].length === 2) {
    const century = Math.floor(yearStart / 100) * 100
    yearEnd = century + parseInt(match[2])
  } else {
    yearEnd = parseInt(match[2])
  }
  return { year_start: yearStart, year_end: yearEnd }
}

const CLASS_MAP: Record<string, string> = {
  "sr.": "Senior",
  "jr.": "Junior",
  "so.": "Sophomore",
  "fr.": "Freshman",
  sr: "Senior",
  jr: "Junior",
  so: "Sophomore",
  fr: "Freshman",
}

function findStatValue(
  stats: { header: string; value: string }[],
  header: string
): number | null {
  const s = stats.find(
    (st) => st.header.toLowerCase() === header.toLowerCase()
  )
  if (!s || !s.value || s.value === "-" || s.value === "") return null
  const num = parseFloat(s.value.replace("%", "").replace(",", ""))
  return isNaN(num) ? null : num
}

function findStatValueInt(
  stats: { header: string; value: string }[],
  header: string
): number | null {
  const val = findStatValue(stats, header)
  return val != null ? Math.round(val) : null
}

/**
 * Convert MaxPreps short year "25-26" to full "2025-26".
 */
function normalizeYear(year: string): string {
  const match = year.match(/^(\d{2})-(\d{2})$/)
  if (match) return `20${match[1]}-${match[2]}`
  return year
}

/**
 * Scrape stats from a MaxPreps stats page using embedded __NEXT_DATA__ JSON.
 * Falls back to HTML table parsing if __NEXT_DATA__ is not available.
 */
export async function scrapeMaxPrepsStats(
  statsUrl: string
): Promise<ScrapeResult> {
  const response = await fetch(statsUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch MaxPreps page: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()

  // Strategy 1: Parse __NEXT_DATA__ (most reliable)
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  )

  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1])
      const rollup = data?.props?.pageProps?.statsCardProps?.careerRollup

      if (rollup?.groups) {
        return parseFromNextData(rollup)
      }
    } catch (e) {
      console.error("Failed to parse __NEXT_DATA__:", e)
    }
  }

  // Strategy 2: Fall back to HTML table parsing
  return parseFromHtml(html)
}

/**
 * Parse stats from the __NEXT_DATA__ careerRollup structure.
 */
function parseFromNextData(rollup: any): ScrapeResult {
  const gameGroup = rollup.groups.find(
    (g: any) => g.name === "Game Stats"
  )
  const shootingGroup = rollup.groups.find(
    (g: any) => g.name === "Shooting"
  )

  if (!gameGroup?.subgroups?.[0]?.stats) {
    throw new Error("No Game Stats found in MaxPreps data")
  }

  const gameSeasons = gameGroup.subgroups[0].stats
  const seasonMap = new Map<string, ParsedSeasonStats>()

  // Parse game stats per season
  for (const season of gameSeasons) {
    const year = season.year ? normalizeYear(season.year) : null
    const classYear = season.classYear?.toLowerCase() || ""
    const classLabel = CLASS_MAP[classYear] || season.classYear || null
    const seasonLabel = year || classLabel || "Unknown"
    const stats = season.stats || []

    const rawData: Record<string, string> = {}
    stats.forEach((s: any) => {
      rawData[s.header] = s.value
    })

    const entry: ParsedSeasonStats = {
      season_label: seasonLabel,
      class_label: classLabel,
      gp: findStatValueInt(stats, "GP"),
      ppg: findStatValue(stats, "PPG"),
      rpg: findStatValue(stats, "RPG"),
      apg: findStatValue(stats, "APG"),
      spg: findStatValue(stats, "SPG"),
      bpg: findStatValue(stats, "BPG"),
      fg_pct: null,
      three_pct: null,
      ft_pct: null,
      topg: findStatValue(stats, "TPG"),
      mpg: findStatValue(stats, "MPG"),
      is_career_total: false,
      raw_data: rawData,
    }

    seasonMap.set(seasonLabel, entry)
  }

  // Merge shooting stats
  if (shootingGroup?.subgroups) {
    for (const subgroup of shootingGroup.subgroups) {
      for (let i = 0; i < (subgroup.stats?.length || 0); i++) {
        const shootingSeason = subgroup.stats[i]
        const year = shootingSeason.year
          ? normalizeYear(shootingSeason.year)
          : null
        const classYear = shootingSeason.classYear?.toLowerCase() || ""
        const classLabel =
          CLASS_MAP[classYear] || shootingSeason.classYear || null
        const seasonLabel = year || classLabel || "Unknown"
        const stats = shootingSeason.stats || []

        const entry = seasonMap.get(seasonLabel)
        if (entry) {
          const fg = findStatValue(stats, "FG%")
          const three = findStatValue(stats, "3P%")
          const ft = findStatValue(stats, "FT%")
          if (fg != null) entry.fg_pct = fg
          if (three != null) entry.three_pct = three
          if (ft != null) entry.ft_pct = ft

          // Merge raw data
          stats.forEach((s: any) => {
            entry.raw_data[s.header] = s.value
          })
        }
      }
    }
  }

  const seasons = Array.from(seasonMap.values())

  // Calculate career totals if we have multiple seasons
  if (seasons.length > 1) {
    const totalGp = seasons.reduce((sum, s) => sum + (s.gp || 0), 0)
    if (totalGp > 0) {
      // Weighted averages by games played
      const weighted = (
        field: keyof ParsedSeasonStats
      ): number | null => {
        let totalWeighted = 0
        let totalGames = 0
        for (const s of seasons) {
          const gp = s.gp || 0
          const val = s[field] as number | null
          if (gp > 0 && val != null) {
            totalWeighted += val * gp
            totalGames += gp
          }
        }
        return totalGames > 0
          ? Math.round((totalWeighted / totalGames) * 10) / 10
          : null
      }

      seasons.push({
        season_label: "Career",
        class_label: null,
        gp: totalGp,
        ppg: weighted("ppg"),
        rpg: weighted("rpg"),
        apg: weighted("apg"),
        spg: weighted("spg"),
        bpg: weighted("bpg"),
        fg_pct: weighted("fg_pct"),
        three_pct: weighted("three_pct"),
        ft_pct: weighted("ft_pct"),
        topg: weighted("topg"),
        mpg: weighted("mpg"),
        is_career_total: true,
        raw_data: { calculated: "true" },
      })
    }
  }

  if (seasons.length === 0) {
    throw new Error("No stats found in MaxPreps data")
  }

  return { seasons, sport: "basketball" }
}

/**
 * Fallback: parse stats from HTML tables using cheerio.
 */
function parseFromHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html)
  const seasons: ParsedSeasonStats[] = []

  // Parse text content for season stats
  const textContent = $("body").text()

  const seasonPattern =
    /(\d{4}-\d{2,4})\s*\((\w+)\)[:\s]*(\d+)\s*GP\s*\|\s*([\d.]+)\s*PPG\s*\|\s*([\d.]+)\s*APG\s*\|\s*([\d.]+)\s*RPG/gi
  let match
  while ((match = seasonPattern.exec(textContent)) !== null) {
    seasons.push({
      season_label: match[1],
      class_label: match[2],
      gp: parseInt(match[3]),
      ppg: parseFloat(match[4]),
      rpg: parseFloat(match[6]),
      apg: parseFloat(match[5]),
      spg: null,
      bpg: null,
      fg_pct: null,
      three_pct: null,
      ft_pct: null,
      topg: null,
      mpg: null,
      is_career_total: false,
      raw_data: { raw: match[0] },
    })
  }

  if (seasons.length === 0) {
    throw new Error(
      "Could not find stats on the MaxPreps page. The page structure may have changed or the athlete may not have stats available."
    )
  }

  return { seasons, sport: "basketball" }
}
