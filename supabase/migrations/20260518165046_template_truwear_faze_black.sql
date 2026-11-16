-- Truwear Faze Heavyweight Tee (Black) — seeded as a partner blank.
--
-- source: https://www.truwear.com/products/faze-t-shirt-black
-- base_cost is set to MSRP ($43) as a stand-in until wholesale terms are
-- finalised. lower it later via the Catalog admin UI.
-- all 8 sizes are in stock at the partner. SKUs preserve Truwear's own
-- product codes for clean order mapping at fulfilment time.

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-faze-tee-black',
  'Faze Heavyweight Tee Black',
  'Premium heavyweight cotton tee. Box fit, relaxed oversized silhouette with drop-shoulder design. Clean minimalist aesthetic that holds shape through multiple washes.',
  'apparel',
  4300,
  500,
  600,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424',
  '[{"name":"Size","values":["S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
from public.fulfillment_partners fp
where fp.slug = 'truwear'
on conflict (slug) do nothing;

insert into public.product_template_variants
  (template_id, sku, options, delta_cost_cents, ordering)
select
  t.id,
  s.sku,
  jsonb_build_object('Size', s.size) as options,
  0 as delta_cost_cents,
  s.ordering
from public.product_templates t
cross join (values
  ('S',    'TW-FZ-T-BLK-S',    10),
  ('M',    'TW-FZ-T-BLK-M',    20),
  ('L',    'TW-FZ-T-BLK-L',    30),
  ('XL',   'TW-FZ-T-BLK-XL',   40),
  ('2XL',  'TW-FZ-T-BLK-2XL',  50),
  ('3XL',  'TW-FZ-T-BLK-3XL',  60),
  ('4XL',  'TW-FZ-T-BLK-4XL',  70),
  ('5XL',  'TW-FZ-T-BLK-5XL',  80)
) as s(size, sku, ordering)
where t.slug = 'truwear-faze-tee-black'
on conflict (template_id, sku) do nothing;
