-- Truwear Spectacle 2.0 Heather White T-Shirt — seeded as a partner blank.
--
-- source: https://www.truwear.com/products/spectacle-2-0-heather-white-t-shirt
-- base_cost is set to MSRP ($37) as a stand-in until wholesale terms are
-- finalised. lower it later via the Catalog admin UI.
-- size L is out of stock at the partner; skipping it per request. orgs can
-- still toggle individual variants off via their product editor.
-- SKUs preserve Truwear's own product codes so orders map cleanly to their
-- system at fulfilment time.

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-spectacle-2-heather-white-tee',
  'Spectacle 2.0 Heather White T-Shirt',
  'Premium pima-cotton lifestyle performance tee. 360° stretch, anti-odor, moisture-wicking, double-needle stitching, split hemline. Tapered athletic fit.',
  'apparel',
  3700,
  500,
  600,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',
  '[{"name":"Size","values":["S","M","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
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
  ('S',    'TW-S2-T-HW-S',    10),
  ('M',    'TW-S2-T-HW-M',    20),
  ('XL',   'TW-S2-T-HW-XL',   30),
  ('2XL',  'TW-S2-T-HW-2XL',  40),
  ('3XL',  'TW-S2-T-HW-3XL',  50),
  ('4XL',  'TW-S2-T-HW-4XL',  60),
  ('5XL',  'TW-S2-T-HW-5XL',  70)
) as s(size, sku, ordering)
where t.slug = 'truwear-spectacle-2-heather-white-tee'
on conflict (template_id, sku) do nothing;
