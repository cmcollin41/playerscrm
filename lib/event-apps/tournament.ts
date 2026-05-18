import type { EventApp } from "./types"

export const tournamentApp: EventApp = {
  slug: "tournament",
  name: "Tournament",
  description: "Multi-game event — add games as sub-events under this one",
  capabilities: {
    supportsChildren: true,
    childAppSlug: "game",
    hideRecurrence: true,
  },
  defaults: {
    is_published: false,
    is_registerable: false,
    is_paid: false,
  },
}
