import type { Integration } from "../types"

// Hidden from the generic picker because practices have their own dedicated
// creation flow at /teams/[id]/schedule/new-practice. Still resolvable by slug
// so existing practice events render correctly.
export const practiceIntegration: Integration = {
  slug: "practice",
  name: "Practice",
  description: "Team practice or training session",
  category: "events",
  placement: "event_type_picker",
  hidden: true,
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: false,
    is_paid: false,
  },
}
