// This file is auto-generated. Do not edit manually.

export interface Accounts {
  id: string /* primary key */;
  created_at?: string;
  name?: string;
  logo?: string;
  stripe_id?: string;
  application_fee?: number;
  application_fee_flat?: number;
  sport?: string;
  subdomain?: string;
  custom_domain?: string;
}

export interface People {
  id: string /* primary key */;
  account_id?: string /* foreign key to accounts.id */;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  address?: any; // type unknown;
  birthdate?: string;
  grade?: string;
  tags?: string[];
  gender?: string;
  name?: string;
  dependent?: boolean;
  aau_number?: string;
  stripe_customer_id?: string;
  photo?: string;
  is_public?: boolean;
  slug?: string;
  height?: string;
  weight_lbs?: number;
  grad_year?: number;
  hometown?: string;
  bio?: string;
  maxpreps_url?: string;
  instagram?: string;
  twitter?: string;
  hudl_url?: string;
  accounts?: Accounts;
}

export interface PlayerSeasonStats {
  id: string /* primary key */;
  created_at?: string;
  updated_at?: string;
  person_id: string /* foreign key to people.id */;
  account_id: string /* foreign key to accounts.id */;
  sport: string;
  season_label: string;
  season_year_start?: number;
  season_year_end?: number;
  class_label?: string;
  gp?: number;
  ppg?: number;
  rpg?: number;
  apg?: number;
  spg?: number;
  bpg?: number;
  fg_pct?: number;
  three_pct?: number;
  ft_pct?: number;
  topg?: number;
  mpg?: number;
  is_career_total: boolean;
  source: string;
  raw_data?: any;
  people?: People;
}

export interface AwardTypes {
  id: string /* primary key */;
  created_at?: string;
  account_id?: string /* foreign key to accounts.id, null for global defaults */;
  slug: string;
  name: string;
  category: string;
  sport: string;
  sort_order: number;
  accounts?: Accounts;
}

export interface RosterAwards {
  id: string /* primary key */;
  roster_id: string /* foreign key to rosters.id */;
  title: string;
  award_type_id?: string /* foreign key to award_types.id */;
  created_at?: string;
  award_types?: AwardTypes;
}

export interface Rosters {
  id: string /* primary key */;
  created_at?: string;
  team_id?: string /* foreign key to teams.id */;
  person_id?: string /* foreign key to people.id */;
  fee_id?: string /* foreign key to fees.id */;
  /** dollars; when set, overrides fees.amount for billing */
  custom_amount?: number | null;
  /** manual payment status: 'paid', 'waived', or null (derive from invoices) */
  payment_status?: string | null;
  /** admin note explaining the manual payment status */
  payment_status_note?: string | null;
  jersey_number?: number;
  position?: string;
  grade?: string;
  bio?: string;
  height?: string;
  photo?: string;
  teams?: Teams;
  roster_awards?: RosterAwards[];
  people?: People;
}

export interface Teams {
  id: string /* primary key */;
  created_at?: string;
  account_id?: string /* foreign key to accounts.id */;
  season_id?: string /* foreign key to seasons.id */;
  name?: string;
  coach?: string;
  icon?: string;
  level: 'bantam' | 'club' | 'freshman' | 'sophomore' | 'jv' | 'varsity';
  is_public?: boolean;
  is_active?: boolean;
  slug?: string;
  /** default catalog fee when adding roster members */
  fee_id?: string | null;
  accounts?: Accounts;
  team_awards?: TeamAwards[];
}

export interface TeamAwards {
  id: string /* primary key */;
  team_id: string /* foreign key to teams.id */;
  title: string;
  created_at?: string;
}

export interface RosterAwards {
  id: string /* primary key */;
  roster_id: string /* foreign key to rosters.id */;
  title: string;
  created_at?: string;
}

export interface Seasons {
  id: string /* primary key */;
  created_at?: string;
  account_id?: string /* foreign key to accounts.id */;
  year_start: number;
  year_end: number;
  slug: string;
  display_name: string;
  is_current?: boolean;
  accounts?: Accounts;
}

export interface Events {
  id: string /* primary key */;
  account_id: string /* foreign key to accounts.id */;
  team_id?: string | null /* foreign key to teams.id; null for account-level events */;
  created_at?: string;
  updated_at?: string;
  name: string;
  slug: string;
  /** Legacy column kept for one release. New code reads event_primary_integration. */
  event_type: string;
  /** Slug of the type-picker integration this event was created with (camp/game/practice/tournament/other/...). Soft pointer into lib/integrations/. Replaces event_type. */
  event_primary_integration?: string | null;
  description?: string | null;
  location?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  arrival_time?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  capacity?: number | null;
  /** smallest currency unit (cents); 0 when free */
  fee_amount: number;
  fee_description?: string | null;
  is_published: boolean;
  is_registerable: boolean;
  is_paid: boolean;
  image_url?: string | null;
  opponent_name?: string | null;
  is_home?: boolean | null;
  series_id?: string | null /* groups occurrences of a recurring event; null for one-off events */;
  series_index?: number | null /* 1-based position within the series */;
  parent_event_id?: string | null /* foreign key to events.id; lets events nest under a parent (tournament -> games) */;
  /** How bundled products are delivered to registrants. NULL when the event has no products. */
  product_delivery_mode?: 'pickup_at_event' | 'shipped_to_registrant' | null;
  metadata?: any;
  accounts?: Accounts;
  teams?: Teams;
  event_registrations?: EventRegistrations[];
  event_sessions?: EventSessions[];
  event_products?: EventProducts[];
  event_integrations?: EventIntegrations[];
}

export interface EventIntegrations {
  id: string /* primary key */;
  event_id: string /* foreign key to events.id */;
  /** Soft pointer into lib/integrations/ registry. */
  integration_slug: string;
  config: Record<string, any>;
  ordering: number;
  installed_at: string;
}

export interface AccountIntegrations {
  account_id: string /* foreign key to accounts.id (composite primary key with integration_slug) */;
  /** Soft pointer into lib/integrations/ registry. */
  integration_slug: string;
  is_enabled: boolean;
  /** AES-256-GCM ciphertext from lib/integrations/products/crypto. Only set for integrations whose registry entry has requiresCredentials=true. */
  credentials_encrypted?: Buffer | null;
  /** Typed sidecar fields like external_shop_id, external_account_label, last_synced_at, auth_type. */
  connection_state: Record<string, any>;
  enabled_at: string;
  updated_at: string;
}

export interface EventSessions {
  id: string /* primary key */;
  event_id: string /* foreign key to events.id */;
  created_at?: string;
  updated_at?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  ordering: number;
}

export interface EventRegistrations {
  id: string /* primary key */;
  event_id: string /* foreign key to events.id */;
  person_id: string /* foreign key to people.id */;
  registered_by?: string /* foreign key to profiles.id */;
  created_at?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  payment_id?: string;
  payment_status?: 'paid' | 'waived' | null;
  payment_status_note?: string | null;
  metadata?: any;
  events?: Events;
  people?: People;
  event_registration_items?: EventRegistrationItems[];
}

export interface EventProducts {
  id: string /* primary key */;
  event_id: string /* foreign key to events.id */;
  product_id: string /* foreign key to org_products.id */;
  is_required: boolean;
  /** Per-registrant upcharge in cents. 0 means comp (cost baked into events.fee_amount). */
  price_cents: number;
  description_override?: string | null;
  ordering: number;
  created_at: string;
  updated_at: string;
  events?: Events;
  org_products?: OrgProducts;
}

export interface EventRegistrationItems {
  id: string /* primary key */;
  registration_id: string /* foreign key to event_registrations.id */;
  event_product_id: string /* foreign key to event_products.id */;
  variant_id: string /* foreign key to org_product_variants.id */;
  /** Snapshot of event_products.price_cents at registration time. */
  unit_price_cents: number;
  options_snapshot: Record<string, string>;
  product_name_snapshot?: string | null;
  variant_sku_snapshot?: string | null;
  image_url_snapshot?: string | null;
  /** Per-registrant shipping address; populated when events.product_delivery_mode = shipped_to_registrant. */
  shipping_address?: Record<string, any> | null;
  /** Backfilled by the Stripe webhook after the store_order is created. */
  store_order_item_id?: string | null;
  created_at: string;
  event_registrations?: EventRegistrations;
  event_products?: EventProducts;
  org_product_variants?: OrgProductVariants;
}

export interface Lists {
  id: string /* primary key */;
  created_at: string;
  account_id?: string /* foreign key to accounts.id */;
  name: string;
  description?: string;
  resend_segment_id?: string;
  accounts?: Accounts;
}

export interface ListPeople {
  id: string /* primary key */;
  created_at: string;
  list_id: string /* foreign key to lists.id */;
  person_id: string /* foreign key to people.id */;
  resend_contact_id?: string;
  lists?: Lists;
  people?: People;
}

export interface Broadcasts {
  id: string /* primary key */;
  created_at: string;
  updated_at: string;
  account_id?: string /* foreign key to accounts.id */;
  list_id?: string /* foreign key to lists.id */;
  resend_broadcast_id?: string;
  resend_segment_id?: string;
  name: string;
  subject: string;
  content: string;
  sender: string;
  status: string;
  scheduled_at?: string;
  sent_at?: string;
  total_recipients?: number;
  total_sent?: number;
  total_delivered?: number;
  total_opened?: number;
  total_clicked?: number;
  metadata?: any; // type unknown;
  accounts?: Accounts;
  list?: Lists;
}

export interface Emails {
  id: string /* primary key */;
  created_at: string;
  account_id?: string /* foreign key to accounts.id */;
  sender?: string;
  recipient_id?: string /* foreign key to people.id */;
  subject?: string;
  content?: string;
  status?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  complained_at?: string;
  click_count?: number;
  resend_id?: string;
  broadcast_id?: string /* foreign key to broadcasts.id */;
  email_type?: string; // 'one-off' | 'batch' | 'broadcast' | 'transactional'
  template_name?: string;
  batch_id?: string;
  updated_at?: string;
  metadata?: any; // type unknown;
  accounts?: Accounts;
  recipient?: People;
  broadcast?: Broadcasts;
}

export interface SenderDomains {
  id: string /* primary key */;
  created_at: string;
  updated_at: string;
  account_id: string /* foreign key to accounts.id */;
  domain: string;
  verified_at?: string;
  verification_status: string; // 'pending' | 'verified' | 'failed'
  dns_records?: any; // type unknown;
  resend_domain_id?: string;
  accounts?: Accounts;
}

export interface Senders {
  id: string /* primary key */;
  created_at?: string;
  account_id?: string /* foreign key to accounts.id */;
  name?: string;
  email?: string;
  verified?: boolean;
  resend_domain_id?: string;
  accounts?: Accounts;
}

export type UserRole = 'admin' | 'general'

export interface Profiles {
  id: string /* primary key, matches auth.users.id */;
  created_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  account_id?: string /* foreign key to accounts.id */;
  role: UserRole;
  people_id?: string /* foreign key to people.id */;
  stripe_customer_id?: string;
  current_account_id?: string /* foreign key to accounts.id */;
  accounts?: Accounts;
  people?: People;
}

export interface FulfillmentPartners {
  id: string /* primary key */;
  slug: string;
  name: string;
  adapter_key: string;
  contact_email?: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountPartnerAuthType = 'personal_token' | 'oauth'

export interface AccountPartnerConnections {
  id: string /* primary key */;
  account_id: string /* foreign key to accounts.id */;
  partner_id: string /* foreign key to fulfillment_partners.id */;
  /** AES-256-GCM ciphertext blob from lib/fulfillment/crypto. Never read raw. */
  credentials_encrypted: Buffer;
  external_shop_id?: string;
  external_account_label?: string;
  auth_type: AccountPartnerAuthType;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  fulfillment_partners?: FulfillmentPartners;
}

export type OrgProductStatus = 'draft' | 'active' | 'archived'
export type OrgProductSyncStatus = 'synced' | 'stale' | 'error' | 'deleted'

export interface OrgProducts {
  id: string /* primary key */;
  account_id: string /* foreign key to accounts.id */;
  connection_id: string /* foreign key to account_partner_connections.id */;
  external_product_id: string;
  slug: string;
  name: string;
  description?: string;
  image_path?: string;
  status: OrgProductStatus;
  sync_status: OrgProductSyncStatus;
  last_synced_at?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  accounts?: Accounts;
  org_product_variants?: OrgProductVariants[];
}

export interface OrgProductVariants {
  id: string /* primary key */;
  product_id: string /* foreign key to org_products.id */;
  sku: string;
  /** Legacy: option name → value map read by the storefront buy panel. */
  options: Record<string, string>;
  external_variant_id: string;
  /** Partner-defined option map, e.g. {"size":"M","color":"Red"}. */
  external_options: Record<string, string>;
  price_cents: number;
  partner_cost_cents?: number;
  image_path?: string;
  inventory_qty?: number;
  is_active: boolean;
  ordering: number;
  created_at: string;
  updated_at: string;
}
