-- Allow logged-in clients to call has_account_role (used by app routes + settings UI)
grant execute on function public.has_account_role(uuid, text) to authenticated;
