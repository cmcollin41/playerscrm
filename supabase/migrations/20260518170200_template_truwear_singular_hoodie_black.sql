-- Truwear Singular Black Hoodie — seeded as a partner blank.
--
-- source: https://www.truwear.com/products/singular-black-hoodie
-- base_cost is set to MSRP ($87) as a stand-in until wholesale terms are
-- finalised. shipping bumped to $9 vs. the tee templates' $6 since hoodies
-- weigh more. XS and XL are out of stock at the partner; skipping per the
-- standing rule. SKUs preserve Truwear's own product codes.

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-singular-hoodie-black',
  'Singular Black Hoodie',
  'Premium performance hoodie. Cotton-polyester-elastane blend, moisture-wicking and stain-resistant, built for fit and durability.',
  'apparel',
  8700,
  500,
  900,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',
  '[{"name":"Size","values":["S","M","L","2XL","3XL","4XL","5XL"]}]'::jsonb
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
  ('S',    'TW-SI-H-B-S',    10),
  ('M',    'TW-SI-H-B-M',    20),
  ('L',    'TW-SI-H-B-L',    30),
  ('2XL',  'TW-SI-H-B-2XL',  40),
  ('3XL',  'TW-SI-H-B-3XL',  50),
  ('4XL',  'TW-SI-H-B-4XL',  60),
  ('5XL',  'TW-SI-H-B-5XL',  70)
) as s(size, sku, ordering)
where t.slug = 'truwear-singular-hoodie-black'
on conflict (template_id, sku) do nothing;
