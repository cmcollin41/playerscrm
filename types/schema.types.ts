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
  /** Soft pointer to an entry in the code-defined event-apps registry (lib/event-apps). Built-ins: camp, practice, game, other, tournament. Free text so partners/integrations can add their own apps without a schema change. */
  event_type: string;
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
  metadata?: any;
  accounts?: Accounts;
  teams?: Teams;
  event_registrations?: EventRegistrations[];
  event_sessions?: EventSessions[];
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

export type ProductCategory = 'uniform' | 'apparel' | 'accessory'

/** Map of option name → value, e.g. {"Size": "M", "Color": "Red"}. */
export type VariantOptionMap = Record<string, string>

/** Option definition shared by templates and org_products. */
export interface ProductOption {
  name: string
  values: string[]
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

export interface ProductTemplates {
  id: string /* primary key */;
  partner_id: string /* foreign key to fulfillment_partners.id */;
  slug: string;
  name: string;
  description?: string;
  category: ProductCategory;
  base_cost_cents: number;
  min_markup_cents: number;
  shipping_flat_cents: number;
  lead_time_days?: number;
  image_path?: string;
  options: ProductOption[];
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fulfillment_partners?: FulfillmentPartners;
  product_template_variants?: ProductTemplateVariants[];
}

export interface ProductTemplateVariants {
  id: string /* primary key */;
  template_id: string /* foreign key to product_templates.id */;
  sku: string;
  options: VariantOptionMap;
  delta_cost_cents: number;
  image_path?: string;
  ordering: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrgProductStatus = 'draft' | 'active' | 'archived'

export interface OrgProducts {
  id: string /* primary key */;
  account_id: string /* foreign key to accounts.id */;
  template_id: string /* foreign key to product_templates.id */;
  slug: string;
  name: string;
  description?: string;
  customization: Record<string, any>;
  image_path?: string;
  artwork_path?: string;
  options: ProductOption[];
  design: Record<string, any>;
  status: OrgProductStatus;
  published_at?: string;
  created_at: string;
  updated_at: string;
  product_templates?: ProductTemplates;
  accounts?: Accounts;
  org_product_variants?: OrgProductVariants[];
}

export interface OrgProductVariants {
  id: string /* primary key */;
  product_id: string /* foreign key to org_products.id */;
  template_variant_id?: string /* foreign key to product_template_variants.id */;
  sku: string;
  options: VariantOptionMap;
  price_cents: number;
  image_path?: string;
  artwork_path?: string;
  inventory_qty?: number;
  design_color_hex?: string;
  is_active: boolean;
  ordering: number;
  created_at: string;
  updated_at: string;
}
