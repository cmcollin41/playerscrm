import type { EventApp } from "./types"

export const otherApp: EventApp = {
  slug: "other",
  name: "Other",
  description: "Anything else — meetings, fundraisers, social events",
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: true,
    is_paid: false,
  },
}
