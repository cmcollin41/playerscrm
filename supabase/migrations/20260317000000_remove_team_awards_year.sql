-- Remove year from team_awards; year is inferred from team (season)
alter table public.team_awards drop column if exists year;
