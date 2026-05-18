-- Remove the two placeholder templates added during slice 1 seeding.
-- They were stand-ins until real partner SKUs were added (Truwear catalog,
-- migrations 20260518170000–20260518170300).
--
-- Variants cascade via product_template_variants.template_id FK.
-- Org products would block this delete (FK is on delete restrict), but a
-- query confirmed 0 org_products reference these slugs at write time.

delete from public.product_templates
where slug in ('prolook-home-jersey', 'truwear-team-hoodie');
