-- store slice 3: anon read access to catalog joins for the public storefront.
--
-- public storefront pages (rendered for an unauthenticated visitor on an
-- org's subdomain or custom-domain) join org_products → product_templates →
-- fulfillment_partners. org_products already allows anon SELECT on
-- status='active' rows; the joined tables need matching anon policies for
-- active rows.

create policy "Anon can view active templates"
  on public.product_templates for select
  to anon
  using (is_active);

create policy "Anon can view active variants"
  on public.product_template_variants for select
  to anon
  using (
    is_active
    and exists (
      select 1 from public.product_templates t
      where t.id = product_template_variants.template_id
        and t.is_active
    )
  );

create policy "Anon can view active partners"
  on public.fulfillment_partners for select
  to anon
  using (is_active);
