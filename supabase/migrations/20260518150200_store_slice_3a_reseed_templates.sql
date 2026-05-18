-- store slice 3a: backfill the seed templates with Shopify-style options and
-- generate one product_template_variant per size. idempotent.

-- Prolook Home Jersey: Size option
update public.product_templates
set options = '[{"name":"Size","values":["YS","YM","YL","S","M","L","XL","XXL"]}]'::jsonb
where slug = 'prolook-home-jersey';

-- Truwear Team Hoodie: Size option
update public.product_templates
set options = '[{"name":"Size","values":["YS","YM","YL","S","M","L","XL","XXL"]}]'::jsonb
where slug = 'truwear-team-hoodie';

-- Seed template variants for each size, ordered Y* first then adult.
-- delta_cost_cents = 0 for all sizes in MVP (XXL pricing tweak deferred).
insert into public.product_template_variants
  (template_id, sku, options, delta_cost_cents, ordering)
select
  t.id,
  t.slug || '-' || lower(s.size) as sku,
  jsonb_build_object('Size', s.size) as options,
  0 as delta_cost_cents,
  s.ordering
from public.product_templates t
cross join (values
  ('YS', 10),
  ('YM', 20),
  ('YL', 30),
  ('S', 40),
  ('M', 50),
  ('L', 60),
  ('XL', 70),
  ('XXL', 80)
) as s(size, ordering)
where t.slug in ('prolook-home-jersey', 'truwear-team-hoodie')
on conflict (template_id, sku) do nothing;
