-- any signed-in user could update every column of their own profiles row,
-- including role, account_id, current_account_id, people_id and email, all
-- of which other policies, functions and server code treat as trusted.
-- the "users can update own profile" policy stays; what changes is which
-- columns the client roles may write. all application writes to profiles
-- already go through the service role, and account switching goes through
-- the security definer function switch_account().

revoke insert, update, delete, truncate on table public.profiles from anon, authenticated;

grant update (first_name, last_name, username) on table public.profiles to authenticated;
