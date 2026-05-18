import type { ReactNode } from "react"

export interface EventAppFormContext {
  /** Free-form bag of app-specific data the FormFields component reads + writes. */
  appData: Record<string, any>
  setAppField: (key: string, value: any) => void
}

export interface EventAppCapabilities {
  /** When true, this app is a parent and gets a "Sub-events" panel + "Add sub-event" affordance. */
  supportsChildren?: boolean
  /** App slug to default the picker to when creating a sub-event of this app. */
  childAppSlug?: string
  /** Hide the cover-image uploader (games typically don't need one). */
  hideCoverImage?: boolean
  /** Hide the recurrence card (e.g. for tournaments / one-shot games). */
  hideRecurrence?: boolean
  /** Hide the name input — app derives the name itself via generateNameAndSlug. */
  hideNameInput?: boolean
  /** Force a team selection at create time. */
  requiresTeam?: boolean
  /** Show the arrival-time input in the Schedule card (games use it). */
  showArrivalTime?: boolean
}

export interface EventAppDefaults {
  is_published?: boolean
  is_registerable?: boolean
  is_paid?: boolean
}

export interface EventApp {
  /** Stable identifier persisted to events.event_type. */
  slug: string
  /** Human-readable name shown in the picker and the detail page. */
  name: string
  /** Short description shown under the name in the picker. */
  description: string
  /** When true, the app is resolvable by slug but not shown in the generic picker (e.g. practice has its own entry point). */
  hidden?: boolean
  capabilities: EventAppCapabilities
  defaults?: EventAppDefaults
  /** Renders app-specific inline fields inside the Details card. May be omitted. */
  FormFields?: (ctx: EventAppFormContext) => ReactNode
  /** Returns the keys of appData that should be persisted as top-level columns on the events row. Used by the new-event submit handler. */
  appDataToColumns?: (appData: Record<string, any>) => Record<string, any>
  /** Inverse of appDataToColumns — used when loading an event into the edit form. */
  columnsToAppData?: (row: Record<string, any>) => Record<string, any>
  /** Derive name + slug from appData when hideNameInput is true. Return null when inputs are insufficient (form treats as validation failure). */
  generateNameAndSlug?: (
    appData: Record<string, any>,
    ctx: {
      startsAt: string | null
      team: { slug: string | null; name: string | null } | null
    },
  ) => { name: string; slug: string } | null
}
