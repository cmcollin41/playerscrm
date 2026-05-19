-- model b teardown: deprecate platform-curated catalog + in-platform designer
--
-- athletes.app is becoming a sales channel for partner-owned catalogs
-- (printify/printful/etc). the merchant designs products on the partner
-- side; we sync mirrors. the in-platform designer is the wrong direction.
--
-- this migration:
--   - drops product_template_variants (pre-launch seed data, ok to lose)
--   - drops product_templates (pre-launch seed data, ok to lose)
--   - drops design/template/customization columns from org_products
--   - drops design/artwork columns from org_product_variants
--
-- fulfillment_partners table is preserved; its role shifts to "integration
-- registry" (printify/printful/manual) in slice 2.

-- drop the FK column on org_products before dropping product_templates,
-- so the dependency is explicit.
alter table public.org_products drop column if exists template_id;

drop table if exists public.product_template_variants cascade;
drop table if exists public.product_templates cascade;

-- drop now-irrelevant columns from org_products. the designer is gone, so
-- artwork_path, design (jsonb), customization (jsonb), and options (jsonb)
-- have no surface to populate them. they will be re-added in slice 2 as
-- external_product_id + last_synced_at + sync_status, pointing at the
-- partner's product instead of platform-curated data.
alter table public.org_products
  drop column if exists design,
  drop column if exists artwork_path,
  drop column if exists customization,
  drop column if exists options;

-- drop variant-level designer columns. options jsonb stays for now (the
-- storefront variant selector reads it); it will be renamed/repurposed to
-- external_options in slice 2.
alter table public.org_product_variants
  drop column if exists design_color_hex,
  drop column if exists artwork_path;

comment on table public.org_products is
  'Org-owned product. Slice 1 (teardown): platform-curated template ref removed. Slice 2 will add partner connection + external_product_id, making this a synced mirror of a partner product.';

comment on table public.org_product_variants is
  'Sellable unit. Slice 1 (teardown): designer columns removed. Slice 2 will add external_variant_id + external_options + partner_cost_cents.';

comment on table public.fulfillment_partners is
  'Registry of supported integrations (printify, printful, manual, ...). Per-account credentials live in account_partner_connections (slice 2), not here.';
