ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'general';

ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'general'));

CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_account_id_role ON public.profiles (account_id, role);
