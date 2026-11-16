-- 1. Add photo and is_public to people
ALTER TABLE public.people
  ADD COLUMN photo text,
  ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- 2. Add jersey_number and position to rosters (per-team/per-season)
ALTER TABLE public.rosters
  ADD COLUMN jersey_number integer,
  ADD COLUMN position text;

-- 3. Drop jersey_number and position from people (no data exists, safe to drop)
ALTER TABLE public.people
  DROP COLUMN jersey_number,
  DROP COLUMN position;
