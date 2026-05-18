import type { EventApp } from "./types"

// Hidden from the generic picker because practices have their own dedicated
// creation flow at /teams/[id]/schedule/new-practice. Still resolvable by slug
// so existing practice events render correctly.
export const practiceApp: EventApp = {
  slug: "practice",
  name: "Practice",
  description: "Team practice or training session",
  hidden: true,
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: false,
    is_paid: false,
  },
}
