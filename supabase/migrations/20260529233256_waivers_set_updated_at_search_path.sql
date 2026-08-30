-- Lock down the search_path on the trigger function added in
-- 20260529233052_waivers.sql. Matches Supabase's function_search_path_mutable
-- lint guidance.

alter function public.waivers_set_updated_at() set search_path = '';
