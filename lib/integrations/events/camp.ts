import type { Integration } from "../types"

export const campIntegration: Integration = {
  slug: "camp",
  name: "Camp / Clinic",
  description: "Paid registration with capacity and registration window",
  category: "events",
  placement: "event_type_picker",
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: true,
    is_paid: true,
  },
}
