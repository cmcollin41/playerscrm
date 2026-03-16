/*
  Migration: Drop person_awards table

  Purpose:
  - person_awards has been replaced by roster_awards (awards are now per-roster/season)
  - This table is no longer used by the application
*/

drop table if exists public.person_awards;
