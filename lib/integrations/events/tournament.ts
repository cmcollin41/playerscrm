import type { Integration } from "../types"

export const tournamentIntegration: Integration = {
  slug: "tournament",
  name: "Tournament",
  description: "Multi-game event — add games as sub-events under this one",
  category: "events",
  placement: "event_type_picker",
  capabilities: {
    supportsChildren: true,
    childIntegrationSlug: "game",
    hideRecurrence: true,
  },
  defaults: {
    is_published: false,
    is_registerable: false,
    is_paid: false,
  },
}
