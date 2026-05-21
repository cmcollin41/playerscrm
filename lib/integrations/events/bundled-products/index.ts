/**
 * Bundled-products app. Lets an event attach products (e.g. a camp
 * t-shirt) so each registrant picks a variant at signup, with optional
 * per-registrant upcharge. Auto-installed by the event-products manager
 * when an admin attaches the first product; auto-uninstalled when the
 * last attachment is removed.
 */

import { EventProductsManager } from "@/components/events/event-products-manager"
import type { Integration } from "../../types"

// Server hooks (validateRegistration, onRegistrationConfirmed) live in
// ./server and are attached to the registry by `lib/integrations/server.ts`.
// Keeping them out of this file prevents Turbopack from pulling
// `server-only` modules (Stripe webhook utils, Supabase admin client)
// into client bundles via the integrations registry.
//
// EventProductsManager is already a `"use client"` component, so the
// server can hold the reference without invoking it — only the edit page
// actually renders it.
export const bundledProductsIntegration: Integration = {
  slug: "products",
  name: "Bundled Products",
  description:
    "Attach products (e.g. a camp t-shirt) so each registrant picks a variant during signup.",
  category: "events",
  placement: "event_edit_card",
  capabilities: {},
  AdminAttachmentCard: EventProductsManager as any,
}
