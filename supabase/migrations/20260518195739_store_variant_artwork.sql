-- Per-variant artwork override: orgs can upload a different artwork file
-- for any variant (e.g., a white logo for dark shirts, a black logo for
-- light shirts). NULL means "use the product-level artwork_path".
--
-- Storage paths live under
--   org-products/<account_id>/<product_id>/variants/<variant_id>/...
-- which is already covered by the existing store-artwork bucket policies
-- (split_part check uses account_id at position 2).

alter table public.org_product_variants
  add column artwork_path text;

comment on column public.org_product_variants.artwork_path is
  'Optional per-variant artwork override stored in the private store-artwork bucket. NULL = use the parent product''s artwork_path.';
