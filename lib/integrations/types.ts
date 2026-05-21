import type { ComponentType, ReactNode } from "react"
import type { FulfillmentAdapter } from "./products/types"

export type {
  FulfillmentAdapter,
  ConnectionContext,
  ConnectionCredentials,
  ValidationResult,
  PartnerSyncProduct,
  PartnerSyncVariant,
  ShippingAddress,
  ShippingQuote,
  FulfillmentLine,
  CreateOrderInput,
  CreateOrderResult,
  WebhookEvent,
  DispatchStatus,
  SyncStatus,
} from "./products/types"

export { NotSupportedError } from "./products/types"

export type IntegrationCategory = "events" | "products"

export type IntegrationPlacement =
  | "event_type_picker"
  | "event_edit_card"
  | "product_source"

export interface IntegrationFormContext {
  appData: Record<string, any>
  setAppField: (key: string, value: any) => void
}

export interface IntegrationValidateContext {
  eventId: string
  accountId: string
  personIds: string[]
  payload: Record<string, any>
  admin: any
}

export interface IntegrationValidateResult {
  ok: boolean
  error?: string
  extraCents?: number
  stripeLineItems?: any[]
  persist?: (
    registrationIdByPerson: Map<string, string>,
    admin: any,
  ) => Promise<void>
}

export interface IntegrationConfirmedContext {
  eventId: string
  registrationIds: string[]
  stripePaymentIntentId: string
  admin: any
}

export interface EventCapabilities {
  supportsChildren?: boolean
  childIntegrationSlug?: string
  hideCoverImage?: boolean
  hideRecurrence?: boolean
  hideNameInput?: boolean
  requiresTeam?: boolean
  showArrivalTime?: boolean
}

export interface EventDefaults {
  is_published?: boolean
  is_registerable?: boolean
  is_paid?: boolean
}

export interface Integration {
  slug: string
  name: string
  description: string
  logo?: string
  category: IntegrationCategory
  placement: IntegrationPlacement
  requiresCredentials?: boolean
  hidden?: boolean

  /** Always present so consumers can do `integration.capabilities.X` without optional chaining. Product integrations carry an empty object. */
  capabilities: EventCapabilities
  defaults?: EventDefaults
  FormFields?: (ctx: IntegrationFormContext) => ReactNode
  appDataToColumns?: (appData: Record<string, any>) => Record<string, any>
  columnsToAppData?: (row: Record<string, any>) => Record<string, any>
  generateNameAndSlug?: (
    appData: Record<string, any>,
    ctx: {
      startsAt: string | null
      team: { slug: string | null; name: string | null } | null
    },
  ) => { name: string; slug: string } | null
  AdminAttachmentCard?: ComponentType<{ eventId: string; accountId: string }>
  RegistrationStep?: ComponentType<any>

  adapterKey?: string
  adapter?: FulfillmentAdapter
}

// Back-compat aliases so consumers that still reference the old EventApp*
// names compile during the cut-over. Drop after every call site is migrated.
export type EventApp = Integration
export type EventAppFormContext = IntegrationFormContext
export type EventAppValidateContext = IntegrationValidateContext
export type EventAppValidateResult = IntegrationValidateResult
export type EventAppConfirmedContext = IntegrationConfirmedContext
export type EventAppCapabilities = EventCapabilities
export type EventAppDefaults = EventDefaults
