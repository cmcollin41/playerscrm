import type { ComponentType, ReactNode } from "react"

export interface EventAppFormContext {
  /** Free-form bag of app-specific data the FormFields component reads + writes. */
  appData: Record<string, any>
  setAppField: (key: string, value: any) => void
}

/**
 * Server-side context passed to an app's validateRegistration hook.
 * The route handler runs each installed app's validator before creating
 * any event_registrations. Throw or return an `error` to reject.
 */
export interface EventAppValidateContext {
  eventId: string
  /** Account id of the event — already loaded by the API route. */
  accountId: string
  /** Person ids selected for this signup. */
  personIds: string[]
  /** Free-form payload from the registration client. Apps cherry-pick the keys they own (e.g. the products app reads `items`). */
  payload: Record<string, any>
  /** Service-role Supabase client; the API route already swapped out of RLS for this flow. */
  admin: any
}

export interface EventAppValidateResult {
  ok: boolean
  /** When !ok, a 400-safe human message. */
  error?: string
  /** Optional cents the app contributes to the Stripe total (e.g. products add per-registrant upcharges). */
  extraCents?: number
  /** Optional Stripe line items the app contributes. */
  stripeLineItems?: any[]
  /**
   * Optional callback run after event_registrations have been inserted,
   * before the Stripe session is created. Use this to persist app-specific
   * rows that reference registration_id (e.g. event_registration_items).
   * Receives a person_id → registration_id map.
   */
  persist?: (
    registrationIdByPerson: Map<string, string>,
    admin: any,
  ) => Promise<void>
}

/** Server-side context passed to onRegistrationConfirmed (post-payment). */
export interface EventAppConfirmedContext {
  eventId: string
  /** Newly-confirmed registration ids in this signup. */
  registrationIds: string[]
  /** Stripe payment intent id that just succeeded. */
  stripePaymentIntentId: string
  /** Service-role Supabase client. */
  admin: any
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

  /**
   * Optional: a self-managing admin card rendered in the event edit page.
   * Use this when the app has its own state + persistence (e.g. the
   * bundled-products manager). Either or both of FormFields and
   * AdminAttachmentCard can be present.
   */
  AdminAttachmentCard?: ComponentType<{ eventId: string; accountId: string }>

  /**
   * Optional: a registration-flow step rendered on /register/[slug].
   * Apps contribute steps to the public signup flow. The host runs steps
   * in `ordering` order from event_apps_installed.
   *
   * Kept loose (`any`) because the bundled-products step manages selection
   * state via parent-owned props. v1 hosts the existing product-selection
   * step directly; future apps can adopt this slot.
   */
  RegistrationStep?: ComponentType<any>

  /**
   * Optional: server-side gate run from /api/register before any
   * event_registrations get inserted. Return `{ ok: false, error }` to
   * 400 the request. Optionally contribute Stripe line items + extra cents
   * to the checkout total.
   */
  validateRegistration?: (
    ctx: EventAppValidateContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<EventAppValidateResult>

  /**
   * Optional: server-side hook run from the Stripe webhook after the
   * payment intent succeeds and registrations are flipped to confirmed.
   */
  onRegistrationConfirmed?: (
    ctx: EventAppConfirmedContext,
    installedConfig: Record<string, unknown>,
  ) => Promise<void>
}
