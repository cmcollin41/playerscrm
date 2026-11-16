-- Consolidate the Meridian Crewneck single-color template into a proper
-- multi-color template with [Color, Size] option axes.
--
-- Truwear models each color as a separate Shopify product (SEO convention),
-- so we have to stitch the three color products into one of our templates.
-- Each (Color, Size) combo becomes one product_template_variant; per-color
-- featured images are stored on the variant so the storefront swaps the
-- hero image when a buyer picks a color.
--
-- Sources:
--   Black:        https://www.truwear.com/products/meridian-black-crewneck
--   Heather Grey: https://www.truwear.com/products/heather-grey-meridian
--   Dark Green:   https://www.truwear.com/products/meridian-dark-green-crewneck
--
-- Variant exclusions:
--   - Heather Grey 4XL/5XL: null SKU on partner side (can't map an order).
--   - Dark Green XL: out of stock at partner.
--
-- Drop the previous single-color "Black" template first. Cascades its variants.

delete from public.product_templates
where slug = 'truwear-meridian-crewneck-black';

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-meridian-crewneck',
  'Meridian Crewneck',
  'Premium crewneck sweatshirt. Cotton-polyester-elastane blend offering softness, stretch, and wrinkle resistance.',
  'apparel',
  8300,
  500,
  900,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',
  '[{"name":"Color","values":["Black","Heather Grey","Dark Green"]},{"name":"Size","values":["S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
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
  -- Black (8 sizes)  10-80
  ('Black',         'S',   'TW-MRD-CN-B-S',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          10),
  ('Black',         'M',   'TW-MRD-CN-B-M',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          20),
  ('Black',         'L',   'TW-MRD-CN-B-L',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          30),
  ('Black',         'XL',  'TW-MRD-CN-B-XL',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          40),
  ('Black',         '2XL', 'TW-MRD-CN-B-2XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          50),
  ('Black',         '3XL', 'TW-MRD-CN-B-3XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          60),
  ('Black',         '4XL', 'TW-MRD-CN-B-4XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          70),
  ('Black',         '5XL', 'TW-MRD-CN-B-5XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-01.png?v=1743560531',                          80),

  -- Heather Grey (6 sizes; 4XL/5XL excluded — null partner SKU)  110-160
  ('Heather Grey',  'S',   'TW-MRD-CN-HGR-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          110),
  ('Heather Grey',  'M',   'TW-MRD-CN-HGR-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          120),
  ('Heather Grey',  'L',   'TW-MRD-CN-HGR-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          130),
  ('Heather Grey',  'XL',  'TW-MRD-CN-HGR-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          140),
  ('Heather Grey',  '2XL', 'TW-MRD-CN-HGR-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          150),
  ('Heather Grey',  '3XL', 'TW-MRD-CN-HGR-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-03.png?v=1743531557',                          160),

  -- Dark Green (7 sizes; XL excluded — OOS)  210-270
  ('Dark Green',    'S',   'TW-MRD-CN-DG-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 210),
  ('Dark Green',    'M',   'TW-MRD-CN-DG-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 220),
  ('Dark Green',    'L',   'TW-MRD-CN-DG-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 230),
  ('Dark Green',    '2XL', 'TW-MRD-CN-DG-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 240),
  ('Dark Green',    '3XL', 'TW-MRD-CN-DG-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 250),
  ('Dark Green',    '4XL', 'TW-MRD-CN-DG-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 260),
  ('Dark Green',    '5XL', 'TW-MRD-CN-DG-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/3_dc5cc845-683e-48b9-99ae-2d5aa104e931.png?v=1743554521', 270)
) as v(color, size, sku, image_path, ordering)
where t.slug = 'truwear-meridian-crewneck'
on conflict (template_id, sku) do nothing;
