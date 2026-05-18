-- Consolidate the Spectacle 2.0 single-color "Heather White" template into a
-- multi-color blank covering Truwear's full 18-color line.
--
-- Color labels mirror Truwear's swatch labels verbatim. Where their swatch
-- label disagrees with the URL slug, the swatch label wins (e.g. "Olive" not
-- "Sage Green", "Sky Blue" not "Powder Blue").
--
-- 110 variant rows total — out-of-stock combos at the partner are skipped.

delete from public.product_templates
where slug = 'truwear-spectacle-2-heather-white-tee';

insert into public.product_templates
  (partner_id, slug, name, description, category,
   base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days,
   image_path, options)
select
  fp.id,
  'truwear-spectacle-2-tee',
  'Spectacle 2.0 T-Shirt',
  'Premium pima-cotton lifestyle performance tee. 360° stretch, anti-odor, moisture-wicking, double-needle stitching, split hemline. Tapered athletic fit.',
  'apparel',
  3700,
  500,
  600,
  14,
  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',
  '[{"name":"Color","values":["Black","White","Charcoal","Navy","Olive","Heather Grey","Bone","Sky Blue","Steelblue","Milk","Light Blue","Walnut","Pine Green","Plum","Teal","Rose","Silver","Heather White"]},{"name":"Size","values":["S","M","L","XL","2XL","3XL","4XL","5XL"]}]'::jsonb
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
  -- Black (L, XL OOS)
  ('Black',         'S',   'TW-S2-T-B-S',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1010),
  ('Black',         'M',   'TW-S2-T-B-M',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1020),
  ('Black',         '2XL', 'TW-S2-T-B-2XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1050),
  ('Black',         '3XL', 'TW-S2-T-B-3XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1060),
  ('Black',         '4XL', 'TW-S2-T-B-4XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1070),
  ('Black',         '5XL', 'TW-S2-T-B-5XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/black-ls.jpg?v=1743533814',    1080),

  -- White (5XL OOS)
  ('White',         'S',   'TW-S2-T-PW-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2010),
  ('White',         'M',   'TW-S2-T-PW-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2020),
  ('White',         'L',   'TW-S2-T-PW-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2030),
  ('White',         'XL',  'TW-S2-T-PW-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2040),
  ('White',         '2XL', 'TW-S2-T-PW-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2050),
  ('White',         '3XL', 'TW-S2-T-PW-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2060),
  ('White',         '4XL', 'TW-S2-T-PW-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/white-ls.jpg?v=1769642689',    2070),

  -- Charcoal (all 8)
  ('Charcoal',      'S',   'TW-S2-T-CH-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3010),
  ('Charcoal',      'M',   'TW-S2-T-CH-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3020),
  ('Charcoal',      'L',   'TW-S2-T-CH-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3030),
  ('Charcoal',      'XL',  'TW-S2-T-CH-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3040),
  ('Charcoal',      '2XL', 'TW-S2-T-CH-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3050),
  ('Charcoal',      '3XL', 'TW-S2-T-CH-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3060),
  ('Charcoal',      '4XL', 'TW-S2-T-CH-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3070),
  ('Charcoal',      '5XL', 'TW-S2-T-CH-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/charcoal-ls.jpg?v=1769643081', 3080),

  -- Navy (all 8)
  ('Navy',          'S',   'TW-S2-T-N-S',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4010),
  ('Navy',          'M',   'TW-S2-T-N-M',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4020),
  ('Navy',          'L',   'TW-S2-T-N-L',     'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4030),
  ('Navy',          'XL',  'TW-S2-T-N-XL',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4040),
  ('Navy',          '2XL', 'TW-S2-T-N-2XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4050),
  ('Navy',          '3XL', 'TW-S2-T-N-3XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4060),
  ('Navy',          '4XL', 'TW-S2-T-N-4XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4070),
  ('Navy',          '5XL', 'TW-S2-T-N-5XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-09.png?v=1769812462',    4080),

  -- Olive (L OOS)
  ('Olive',         'S',   'TW-S2-T-SG-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5010),
  ('Olive',         'M',   'TW-S2-T-SG-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5020),
  ('Olive',         'XL',  'TW-S2-T-SG-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5040),
  ('Olive',         '2XL', 'TW-S2-T-SG-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5050),
  ('Olive',         '3XL', 'TW-S2-T-SG-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5060),
  ('Olive',         '4XL', 'TW-S2-T-SG-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5070),
  ('Olive',         '5XL', 'TW-S2-T-SG-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-05.png?v=1743534059',    5080),

  -- Heather Grey (M, L, XL OOS)
  ('Heather Grey',  'S',   'TW-S2-T-HGR-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-11.png?v=1743534352',    6010),
  ('Heather Grey',  '2XL', 'TW-S2-T-HGR-2XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-11.png?v=1743534352',    6050),
  ('Heather Grey',  '3XL', 'TW-S2-T-HGR-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-11.png?v=1743534352',    6060),
  ('Heather Grey',  '4XL', 'TW-S2-T-HGR-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-11.png?v=1743534352',    6070),
  ('Heather Grey',  '5XL', 'TW-S2-T-HGR-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-11.png?v=1743534352',    6080),

  -- Bone (L, XL OOS)
  ('Bone',          'S',   'TW-S2-T-BN-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7010),
  ('Bone',          'M',   'TW-S2-T-BN-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7020),
  ('Bone',          '2XL', 'TW-S2-T-BN-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7050),
  ('Bone',          '3XL', 'TW-S2-T-BN-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7060),
  ('Bone',          '4XL', 'TW-S2-T-BN-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7070),
  ('Bone',          '5XL', 'TW-S2-T-BN-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/bonenew-01.png?v=1743534691',  7080),

  -- Sky Blue (L, XL, 2XL OOS)
  ('Sky Blue',      'S',   'TW-S2-T-PWDBL-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/powdernew-01.png?v=1743534241', 8010),
  ('Sky Blue',      'M',   'TW-S2-T-PWDBL-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/powdernew-01.png?v=1743534241', 8020),
  ('Sky Blue',      '3XL', 'TW-S2-T-PWDBL-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/powdernew-01.png?v=1743534241', 8060),
  ('Sky Blue',      '4XL', 'TW-S2-T-PWDBL-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/powdernew-01.png?v=1743534241', 8070),
  ('Sky Blue',      '5XL', 'TW-S2-T-PWDBL-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/powdernew-01.png?v=1743534241', 8080),

  -- Steelblue (L, 2XL OOS)
  ('Steelblue',     'S',   'TW-S2-T-PLBL-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9010),
  ('Steelblue',     'M',   'TW-S2-T-PLBL-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9020),
  ('Steelblue',     'XL',  'TW-S2-T-PLBL-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9040),
  ('Steelblue',     '3XL', 'TW-S2-T-PLBL-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9060),
  ('Steelblue',     '4XL', 'TW-S2-T-PLBL-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9070),
  ('Steelblue',     '5XL', 'TW-S2-T-PLBL-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-13.png?v=1743535751',     9080),

  -- Milk (all 8)
  ('Milk',          'S',   'TW-S2-T-OW-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10010),
  ('Milk',          'M',   'TW-S2-T-OW-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10020),
  ('Milk',          'L',   'TW-S2-T-OW-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10030),
  ('Milk',          'XL',  'TW-S2-T-OW-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10040),
  ('Milk',          '2XL', 'TW-S2-T-OW-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10050),
  ('Milk',          '3XL', 'TW-S2-T-OW-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10060),
  ('Milk',          '4XL', 'TW-S2-T-OW-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10070),
  ('Milk',          '5XL', 'TW-S2-T-OW-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/off-white-ls.jpg?v=1769813345', 10080),

  -- Light Blue (L, 2XL OOS)
  ('Light Blue',    'S',   'TW-S2-T-LBL-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11010),
  ('Light Blue',    'M',   'TW-S2-T-LBL-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11020),
  ('Light Blue',    'XL',  'TW-S2-T-LBL-XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11040),
  ('Light Blue',    '3XL', 'TW-S2-T-LBL-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11060),
  ('Light Blue',    '4XL', 'TW-S2-T-LBL-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11070),
  ('Light Blue',    '5XL', 'TW-S2-T-LBL-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-17.png?v=1743534293',     11080),

  -- Walnut (M, L, XL, 2XL, 3XL OOS)
  ('Walnut',        'S',   'TW-S2-T-WNT-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/7_89d9a110-2631-4c35-b592-f7d14d876e02.jpg?v=1743545502',         12010),
  ('Walnut',        '4XL', 'TW-S2-T-WNT-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/7_89d9a110-2631-4c35-b592-f7d14d876e02.jpg?v=1743545502',         12070),
  ('Walnut',        '5XL', 'TW-S2-T-WNT-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/7_89d9a110-2631-4c35-b592-f7d14d876e02.jpg?v=1743545502',         12080),

  -- Pine Green (S, L OOS)
  ('Pine Green',    'M',   'TW-S2-T-PG-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13020),
  ('Pine Green',    'XL',  'TW-S2-T-PG-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13040),
  ('Pine Green',    '2XL', 'TW-S2-T-PG-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13050),
  ('Pine Green',    '3XL', 'TW-S2-T-PG-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13060),
  ('Pine Green',    '4XL', 'TW-S2-T-PG-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13070),
  ('Pine Green',    '5XL', 'TW-S2-T-PG-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972.png?v=1743546140',     13080),

  -- Plum (L, XL, 2XL, 3XL OOS)
  ('Plum',          'S',   'TW-S2-T-PLM-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972_3b4f9b74-ffba-4faa-9183-ebd4d5d6f1b4.png?v=1743556692', 14010),
  ('Plum',          'M',   'TW-S2-T-PLM-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972_3b4f9b74-ffba-4faa-9183-ebd4d5d6f1b4.png?v=1743556692', 14020),
  ('Plum',          '4XL', 'TW-S2-T-PLM-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972_3b4f9b74-ffba-4faa-9183-ebd4d5d6f1b4.png?v=1743556692', 14070),
  ('Plum',          '5XL', 'TW-S2-T-PLM-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_2972_3b4f9b74-ffba-4faa-9183-ebd4d5d6f1b4.png?v=1743556692', 14080),

  -- Teal (all 8)
  ('Teal',          'S',   'TW-S2-T-TL-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15010),
  ('Teal',          'M',   'TW-S2-T-TL-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15020),
  ('Teal',          'L',   'TW-S2-T-TL-L',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15030),
  ('Teal',          'XL',  'TW-S2-T-TL-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15040),
  ('Teal',          '2XL', 'TW-S2-T-TL-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15050),
  ('Teal',          '3XL', 'TW-S2-T-TL-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15060),
  ('Teal',          '4XL', 'TW-S2-T-TL-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15070),
  ('Teal',          '5XL', 'TW-S2-T-TL-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/spect-25.png?v=1743534198',     15080),

  -- Rose (S, M, L, XL OOS)
  ('Rose',          '2XL', 'TW-S2-T-RS-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/4_7a943cad-cd8c-4f47-b704-053b54f68e64.jpg?v=1743546019',         16050),
  ('Rose',          '3XL', 'TW-S2-T-RS-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/4_7a943cad-cd8c-4f47-b704-053b54f68e64.jpg?v=1743546019',         16060),
  ('Rose',          '4XL', 'TW-S2-T-RS-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/4_7a943cad-cd8c-4f47-b704-053b54f68e64.jpg?v=1743546019',         16070),
  ('Rose',          '5XL', 'TW-S2-T-RS-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/4_7a943cad-cd8c-4f47-b704-053b54f68e64.jpg?v=1743546019',         16080),

  -- Silver (XL, 2XL OOS)
  ('Silver',        'S',   'TW-S2-T-SLV-S',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17010),
  ('Silver',        'M',   'TW-S2-T-SLV-M',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17020),
  ('Silver',        'L',   'TW-S2-T-SLV-L',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17030),
  ('Silver',        '3XL', 'TW-S2-T-SLV-3XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17060),
  ('Silver',        '4XL', 'TW-S2-T-SLV-4XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17070),
  ('Silver',        '5XL', 'TW-S2-T-SLV-5XL', 'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/CementFront.png?v=1743557960',  17080),

  -- Heather White (L OOS)
  ('Heather White', 'S',   'TW-S2-T-HW-S',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18010),
  ('Heather White', 'M',   'TW-S2-T-HW-M',    'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18020),
  ('Heather White', 'XL',  'TW-S2-T-HW-XL',   'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18040),
  ('Heather White', '2XL', 'TW-S2-T-HW-2XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18050),
  ('Heather White', '3XL', 'TW-S2-T-HW-3XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18060),
  ('Heather White', '4XL', 'TW-S2-T-HW-4XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18070),
  ('Heather White', '5XL', 'TW-S2-T-HW-5XL',  'https://cdn.shopify.com/s/files/1/0157/3607/8384/files/JTH_7735.jpg?v=1752074716',     18080)
) as v(color, size, sku, image_path, ordering)
where t.slug = 'truwear-spectacle-2-tee'
on conflict (template_id, sku) do nothing;
