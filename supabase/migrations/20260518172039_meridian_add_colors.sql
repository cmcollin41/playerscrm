-- Add the remaining Meridian Crewneck colors that were missing from the
-- earlier 3-color consolidation: Navy, Ecru, True Navy.
--
-- Sources:
--   Navy:       https://www.truwear.com/products/heather-navy-meridian       (SKU prefix HN; only S in stock)
--   Ecru:       https://www.truwear.com/products/meridian-ecru-crewneck       (SKU prefix EC; all 8 sizes)
--   True Navy:  https://www.truwear.com/products/meridian-true-navy-crewneck  (SKU prefix N;  all 8 sizes)

update public.product_templates
set options = '[{"name":"Color","values":["Black","Heather Grey","Navy","Dark Green","Ecru","True Navy"]},{"name":"Size","values":["S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
where slug = 'truwear-meridian-crewneck';

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
  -- Navy (only S in stock)
  ('Navy',       'S',   'TW-MRD-CN-HN-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Meridian-02.png?v=1743531744',                                              310),

  -- Ecru (all 8 sizes)
  ('Ecru',       'S',   'TW-MRD-CN-EC-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 410),
  ('Ecru',       'M',   'TW-MRD-CN-EC-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 420),
  ('Ecru',       'L',   'TW-MRD-CN-EC-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 430),
  ('Ecru',       'XL',  'TW-MRD-CN-EC-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 440),
  ('Ecru',       '2XL', 'TW-MRD-CN-EC-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 450),
  ('Ecru',       '3XL', 'TW-MRD-CN-EC-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 460),
  ('Ecru',       '4XL', 'TW-MRD-CN-EC-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 470),
  ('Ecru',       '5XL', 'TW-MRD-CN-EC-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_d5bb1f6f-55b2-437b-ac29-3ac9ea73a8ac.png?v=1743552966', 480),

  -- True Navy (all 8 sizes)
  ('True Navy',  'S',   'TW-MRD-CN-N-S',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 510),
  ('True Navy',  'M',   'TW-MRD-CN-N-M',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 520),
  ('True Navy',  'L',   'TW-MRD-CN-N-L',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 530),
  ('True Navy',  'XL',  'TW-MRD-CN-N-XL',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 540),
  ('True Navy',  '2XL', 'TW-MRD-CN-N-2XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 550),
  ('True Navy',  '3XL', 'TW-MRD-CN-N-3XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 560),
  ('True Navy',  '4XL', 'TW-MRD-CN-N-4XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 570),
  ('True Navy',  '5XL', 'TW-MRD-CN-N-5XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/Untitled-2-07_0824a283-c39b-4e91-876b-1d758fca6393.png?v=1743554670', 580)
) as v(color, size, sku, image_path, ordering)
where t.slug = 'truwear-meridian-crewneck'
on conflict (template_id, sku) do nothing;
