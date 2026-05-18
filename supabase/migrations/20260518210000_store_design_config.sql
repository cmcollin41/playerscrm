-- store: per-product design config (placement, embellishment, transform)
-- and per-variant ink color override.
--
-- design jsonb fields:
--   placement      'front_chest' | 'front_center' | 'back_center' | 'left_chest'
--   embellishment  'screenprint' | 'embroidery' | 'dtg' | 'vinyl'
--   x, y           normalized 0..1 — design center inside the garment image
--   scale          0..1 — fraction of garment width
--   rotation       degrees
--
-- design_color_hex: explicit ink color for that variant. NULL means
--   "auto": derived from the variant's Color value at render time
--   (lookup table → white on dark shirts, black on light).

alter table public.org_products
  add column design jsonb not null default jsonb_build_object(
    'placement',     'front_center',
    'embellishment', 'screenprint',
    'x',             0.5,
    'y',             0.4,
    'scale',         0.35,
    'rotation',      0
  );

comment on column public.org_products.design is
  'Design config: placement enum, embellishment enum, normalized x/y position, scale (fraction of width), rotation (degrees). See lib/store/design.ts for the source of truth.';

alter table public.org_product_variants
  add column design_color_hex text;

comment on column public.org_product_variants.design_color_hex is
  'Explicit ink color hex for this variant. NULL = auto (computed from the variant''s Color value at render time).';
