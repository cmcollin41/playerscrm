-- Consolidate the Faze Heavyweight Tee single-color "Black" template into a
-- multi-color blank with Color: [Black, Charcoal, White].
--
-- The Memphis Slam Dunk and BYU Slam Dunk variants on Truwear's swatch row
-- are excluded — those are finished products with someone else's design
-- pre-printed, not blanks for orgs to add their own design to.
--
-- Sources:
--   Black:    https://www.truwear.com/products/faze-t-shirt-black            (SKU prefix BLK)
--   Charcoal: https://www.truwear.com/products/faze-heavyweight-tee-charcoal (SKU prefix CHR)
--   White:    https://www.truwear.com/products/faze-heavyweight-tee-white    (SKU prefix WHT)
--
-- All 8 sizes in stock for all 3 colors.

delete from public.product_templates
where slug = 'truwear-faze-tee-black';

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-faze-tee',
  'Faze Heavyweight Tee',
  'Premium heavyweight cotton tee. Box fit, relaxed oversized silhouette with drop-shoulder design. Clean minimalist aesthetic that holds shape through multiple washes.',
  'apparel',
  4300,
  500,
  600,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424',
  '[{"name":"Color","values":["Black","Charcoal","White"]},{"name":"Size","values":["S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
from public.fulfillment_partners fp
where fp.slug = 'truwear'
on conflict (slug) do nothing;

insert into public.product_template_variants
  (template_id, sku, options, delta_cost_cents, image_path, ordering)
select
  t.id,
  v.sku,
  jsonb_build_object('Color', v.color, 'Size', v.size) as options,
  0 as delta_cost_cents,
  v.image_path,
  v.ordering
from public.product_templates t
cross join (values
  -- Black
  ('Black',    'S',   'TW-FZ-T-BLK-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 10),
  ('Black',    'M',   'TW-FZ-T-BLK-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 20),
  ('Black',    'L',   'TW-FZ-T-BLK-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 30),
  ('Black',    'XL',  'TW-FZ-T-BLK-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 40),
  ('Black',    '2XL', 'TW-FZ-T-BLK-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 50),
  ('Black',    '3XL', 'TW-FZ-T-BLK-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 60),
  ('Black',    '4XL', 'TW-FZ-T-BLK-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 70),
  ('Black',    '5XL', 'TW-FZ-T-BLK-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/faze-tshirt-black1.jpg?v=1760464424', 80),

  -- Charcoal
  ('Charcoal', 'S',   'TW-FZ-T-CHR-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           110),
  ('Charcoal', 'M',   'TW-FZ-T-CHR-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           120),
  ('Charcoal', 'L',   'TW-FZ-T-CHR-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           130),
  ('Charcoal', 'XL',  'TW-FZ-T-CHR-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           140),
  ('Charcoal', '2XL', 'TW-FZ-T-CHR-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           150),
  ('Charcoal', '3XL', 'TW-FZ-T-CHR-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           160),
  ('Charcoal', '4XL', 'TW-FZ-T-CHR-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           170),
  ('Charcoal', '5XL', 'TW-FZ-T-CHR-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1773.jpg?v=1760653645',           180),

  -- White
  ('White',    'S',   'TW-FZ-T-WHT-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         210),
  ('White',    'M',   'TW-FZ-T-WHT-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         220),
  ('White',    'L',   'TW-FZ-T-WHT-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         230),
  ('White',    'XL',  'TW-FZ-T-WHT-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         240),
  ('White',    '2XL', 'TW-FZ-T-WHT-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         250),
  ('White',    '3XL', 'TW-FZ-T-WHT-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         260),
  ('White',    '4XL', 'TW-FZ-T-WHT-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         270),
  ('White',    '5XL', 'TW-FZ-T-WHT-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_1765_1.jpg?v=1760653907',         280)
) as v(color, size, sku, image_path, ordering)
where t.slug = 'truwear-faze-tee'
on conflict (template_id, sku) do nothing;
