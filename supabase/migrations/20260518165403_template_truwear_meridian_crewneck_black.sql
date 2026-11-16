-- Truwear Meridian Black Crewneck — seeded as a partner blank.
--
-- source: https://www.truwear.com/products/meridian-black-crewneck
-- base_cost is set to MSRP ($83) as a stand-in until wholesale terms are
-- finalised. shipping at $9 matches the hoodie template (sweatshirts run
-- heavier than tees). all 8 sizes are in stock at the partner.

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-meridian-crewneck-black',
  'Meridian Black Crewneck',
  'Premium crewneck sweatshirt. Cotton-polyester-elastane blend offering softness, stretch, and wrinkle resistance.',
  'apparel',
  8300,
  500,
  900,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',
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
  ('S',    'TW-MRD-CN-B-S',    10),
  ('M',    'TW-MRD-CN-B-M',    20),
  ('L',    'TW-MRD-CN-B-L',    30),
  ('XL',   'TW-MRD-CN-B-XL',   40),
  ('2XL',  'TW-MRD-CN-B-2XL',  50),
  ('3XL',  'TW-MRD-CN-B-3XL',  60),
  ('4XL',  'TW-MRD-CN-B-4XL',  70),
  ('5XL',  'TW-MRD-CN-B-5XL',  80)
) as s(size, sku, ordering)
where t.slug = 'truwear-meridian-crewneck-black'
on conflict (template_id, sku) do nothing;
