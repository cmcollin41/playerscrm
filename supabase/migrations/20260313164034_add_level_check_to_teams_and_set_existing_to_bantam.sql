-- Set all existing teams to 'bantam'
UPDATE public.teams SET level = 'bantam' WHERE level IS NULL OR level = '';

-- Add a check constraint to enforce allowed values
ALTER TABLE public.teams
  ADD CONSTRAINT teams_level_check
  CHECK (level IN ('bantam', 'club', 'freshman', 'sophomore', 'jv', 'varsity'));

-- Make level NOT NULL going forward
ALTER TABLE public.teams
  ALTER COLUMN level SET NOT NULL,
  ALTER COLUMN level SET DEFAULT 'bantam';
