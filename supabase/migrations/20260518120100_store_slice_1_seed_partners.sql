-- store slice 1: seed the two MVP fulfillment partners + one sample template each.
-- idempotent via on-conflict-do-nothing so re-applying in any environment is safe.

insert into public.fulfillment_partners (slug, name, adapter_key, contact_email, config)
values
  ('prolook', 'Prolook', 'prolook', null, '{"website":"https://prolook.com"}'::jsonb),
  ('truwear', 'Truwear', 'truwear', null, '{"website":"https://truwear.com"}'::jsonb)
on conflict (slug) do nothing;

insert into public.product_templates
  (partner_id, slug, name, description, category, base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days, metadata)
select
  fp.id,
  'prolook-home-jersey',
  'Home Jersey',
  'Custom sublimated home jersey. Choose primary/secondary color and team name.',
  'uniform',
  4500,
  500,
  800,
  21,
  '{"customizable":["primary_color","secondary_color","team_name","logo_url"],"sizes":["YS","YM","YL","S","M","L","XL","XXL"]}'::jsonb
from public.fulfillment_partners fp
where fp.slug = 'prolook'
on conflict (slug) do nothing;

insert into public.product_templates
  (partner_id, slug, name, description, category, base_cost_cents, min_markup_cents, shipping_flat_cents, lead_time_days, metadata)
select
  fp.id,
  'truwear-team-hoodie',
  'Team Hoodie',
  'Cotton-blend pullover hoodie with embroidered team logo.',
  'apparel',
  3200,
  500,
  600,
  14,
  '{"customizable":["primary_color","team_name","logo_url"],"sizes":["YS","YM","YL","S","M","L","XL","XXL"]}'::jsonb
from public.fulfillment_partners fp
where fp.slug = 'truwear'
on conflict (slug) do nothing;
