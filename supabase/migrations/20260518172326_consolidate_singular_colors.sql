-- Consolidate the Singular Hoodie single-color "Black" template into a
-- multi-color blank with Color: [Grey, Navy, Black, Dark Green, Ecru, True Navy].
--
-- Color labels mirror Truwear's swatch labels verbatim (Grey, not "Heather
-- Grey"; Navy, not "Lifestyle Navy") even where they're internally
-- inconsistent with their own SKU coding.
--
-- Sources (slugs):
--   Grey:       singular-heather-grey-performance-sweatshirt        SKU HG
--   Navy:       singular-lifestyle-navy-blue-performance-active-hoodie SKU N
--   Black:      singular-black-hoodie                                SKU B
--   Dark Green: singular-dark-green-hoodie                           SKU DG
--   Ecru:       singular-ecru-hoodie                                 SKU EC
--   True Navy:  singular-true-navy-hoodie-1                          SKU TN
--
-- OOS sizes per current partner snapshot:
--   Grey:       XS
--   Navy:       2XL (and no 5XL listed)
--   Black:      XS, XL
--   Dark Green: XS, L
--   Ecru:       (none; no 5XL listed)
--   True Navy:  4XL (and no 5XL listed)

delete from public.product_templates
where slug = 'truwear-singular-hoodie-black';

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-singular-hoodie',
  'Singular Hoodie',
  'Premium performance hoodie. Cotton-polyester-elastane blend, moisture-wicking and stain-resistant, built for fit and durability.',
  'apparel',
  8700,
  500,
  900,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',
  '[{"name":"Color","values":["Grey","Navy","Black","Dark Green","Ecru","True Navy"]},{"name":"Size","values":["XS","S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
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
  -- Grey (XS OOS)
  ('Grey',       'S',   'TW-SI-H-HG-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      10),
  ('Grey',       'M',   'TW-SI-H-HG-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      20),
  ('Grey',       'L',   'TW-SI-H-HG-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      30),
  ('Grey',       'XL',  'TW-SI-H-HG-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      40),
  ('Grey',       '2XL', 'TW-SI-H-HG-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      50),
  ('Grey',       '3XL', 'TW-SI-H-HG-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      60),
  ('Grey',       '4XL', 'TW-SI-H-HG-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      70),
  ('Grey',       '5XL', 'TW-SI-H-HG-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3404.png?v=1743538452',                      80),

  -- Navy (2XL OOS, no 5XL)
  ('Navy',       'XS',  'TW-SI-H-N-XS',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 100),
  ('Navy',       'S',   'TW-SI-H-N-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 110),
  ('Navy',       'M',   'TW-SI-H-N-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 120),
  ('Navy',       'L',   'TW-SI-H-N-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 130),
  ('Navy',       'XL',  'TW-SI-H-N-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 140),
  ('Navy',       '3XL', 'TW-SI-H-N-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 160),
  ('Navy',       '4XL', 'TW-SI-H-N-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/1_54b333bf-2ee4-47cc-b342-c177b2d83bb9.png?v=1769643341', 170),

  -- Black (XS, XL OOS)
  ('Black',      'S',   'TW-SI-H-B-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      210),
  ('Black',      'M',   'TW-SI-H-B-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      220),
  ('Black',      'L',   'TW-SI-H-B-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      230),
  ('Black',      '2XL', 'TW-SI-H-B-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      250),
  ('Black',      '3XL', 'TW-SI-H-B-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      260),
  ('Black',      '4XL', 'TW-SI-H-B-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      270),
  ('Black',      '5XL', 'TW-SI-H-B-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_3421.png?v=1743539785',                      280),

  -- Dark Green (XS, L OOS)
  ('Dark Green', 'S',   'TW-SI-H-DG-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 310),
  ('Dark Green', 'M',   'TW-SI-H-DG-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 320),
  ('Dark Green', 'XL',  'TW-SI-H-DG-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 340),
  ('Dark Green', '2XL', 'TW-SI-H-DG-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 350),
  ('Dark Green', '3XL', 'TW-SI-H-DG-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 360),
  ('Dark Green', '4XL', 'TW-SI-H-DG-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 370),
  ('Dark Green', '5XL', 'TW-SI-H-DG-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-05_e3f50a0b-05dc-4d12-891c-4486c5c59a8c.png?v=1743554098', 380),

  -- Ecru (no 5XL)
  ('Ecru',       'XS',  'TW-SI-H-EC-XS',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 400),
  ('Ecru',       'S',   'TW-SI-H-EC-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 410),
  ('Ecru',       'M',   'TW-SI-H-EC-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 420),
  ('Ecru',       'L',   'TW-SI-H-EC-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 430),
  ('Ecru',       'XL',  'TW-SI-H-EC-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 440),
  ('Ecru',       '2XL', 'TW-SI-H-EC-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 450),
  ('Ecru',       '3XL', 'TW-SI-H-EC-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 460),
  ('Ecru',       '4XL', 'TW-SI-H-EC-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-06_d66d4e3d-b2bc-40fb-b8ae-1151bff6b85d.png?v=1743553451', 470),

  -- True Navy (4XL OOS, no 5XL)
  ('True Navy',  'XS',  'TW-SI-H-TN-XS',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    500),
  ('True Navy',  'S',   'TW-SI-H-TN-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    510),
  ('True Navy',  'M',   'TW-SI-H-TN-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    520),
  ('True Navy',  'L',   'TW-SI-H-TN-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    530),
  ('True Navy',  'XL',  'TW-SI-H-TN-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    540),
  ('True Navy',  '2XL', 'TW-SI-H-TN-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    550),
  ('True Navy',  '3XL', 'TW-SI-H-TN-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/J7H_7370_1.png?v=1743553975',                    560)
) as v(color, size, sku, image_path, ordering)
where t.slug = 'truwear-singular-hoodie'
on conflict (template_id, sku) do nothing;
