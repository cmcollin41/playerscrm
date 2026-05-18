import type { EventApp } from "./types"
import { GameFormFields } from "./game-form-fields"
import { slugify } from "@/lib/slug"

export const gameApp: EventApp = {
  slug: "game",
  name: "Game",
  description: "Team game with opponent and home/away",
  capabilities: {
    hideCoverImage: true,
    hideRecurrence: true,
    hideNameInput: true,
    requiresTeam: true,
    showArrivalTime: true,
  },
  defaults: {
    is_published: true,
    is_registerable: false,
    is_paid: false,
  },
  FormFields: GameFormFields,
  appDataToColumns: (appData) => ({
    opponent_name: appData.opponent?.trim() || null,
    is_home: appData.is_home ?? true,
  }),
  columnsToAppData: (row) => ({
    opponent: row.opponent_name ?? "",
    is_home: row.is_home ?? true,
  }),
  generateNameAndSlug: (appData, { startsAt, team }) => {
    const opponent = (appData.opponent ?? "").trim()
    if (!opponent || !startsAt) return null
    const isHome = appData.is_home ?? true
    const teamSlug = team?.slug || slugify(team?.name || "team")
    const opponentSlug = slugify(opponent)
    const d = new Date(startsAt)
    if (isNaN(d.getTime())) return null
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
    return {
      name: isHome ? `vs ${opponent}` : `@ ${opponent}`,
      slug: `game-${teamSlug}-vs-${opponentSlug}-${dateStr}`,
    }
  },
}
