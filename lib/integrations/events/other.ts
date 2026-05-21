import type { Integration } from "../types"

export const otherIntegration: Integration = {
  slug: "other",
  name: "Other",
  description: "Anything else — meetings, fundraisers, social events",
  category: "events",
  placement: "event_type_picker",
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: true,
    is_paid: false,
  },
}
