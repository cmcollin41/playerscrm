import type { EventApp } from "./types"

export const campApp: EventApp = {
  slug: "camp",
  name: "Camp / Clinic",
  description: "Paid registration with capacity and registration window",
  capabilities: {},
  defaults: {
    is_published: false,
    is_registerable: true,
    is_paid: true,
  },
}
