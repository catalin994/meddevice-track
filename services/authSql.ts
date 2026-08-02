/**
 * The migration that turns the cloud from "anyone with the link owns the data"
 * into a real account system. Kept as a string so the Configurare screen can
 * show it and copy it — the project has no server to run migrations from.
 *
 * Idempotent: safe to run again.
 */
export const SECURITY_SQL = `-- MEDITRACK — CONTURI SI ACCES (se poate rula de mai multe ori, in siguranta)
-- Ruleaza acest script in Supabase Dashboard -> SQL Editor -> RUN.
--
-- Ce face:
--   1. creeaza tabelul de profiluri (nume, rol, aprobat) legat de conturile reale
--   2. primul cont inregistrat devine automat Administrator aprobat
--   3. inlocuieste politicile "acces public" cu politici bazate pe cont si rol
--
-- IMPORTANT: dupa rulare, datele NU mai sunt accesibile fara autentificare.

-- ── 1. PROFILURI ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  name       TEXT NOT NULL DEFAULT 'Utilizator',
  role       TEXT NOT NULL DEFAULT 'VIZUALIZARE',
  approved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Profil automat la inregistrare; primul cont e Administrator aprobat ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;
  INSERT INTO public.profiles (id, email, name, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    CASE WHEN is_first THEN 'ADMIN' ELSE 'VIZUALIZARE' END,
    is_first
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Daca ai deja conturi create inainte de acest script, le aduce in profiles.
INSERT INTO public.profiles (id, email, name, role, approved)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
  'VIZUALIZARE',
  FALSE
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Daca niciun profil nu e administrator, promoveaza-l pe cel mai vechi.
UPDATE public.profiles SET role = 'ADMIN', approved = TRUE
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'ADMIN' AND approved);

-- ── 3. Rolul contului curent ────────────────────────────────────────────────
-- SECURITY DEFINER: altfel politicile de pe profiles s-ar interoga pe ele insele.
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND approved;
$$;

CREATE OR REPLACE FUNCTION public.app_can_read()
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$ SELECT public.app_role() IS NOT NULL $$;

CREATE OR REPLACE FUNCTION public.app_can_write()
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$ SELECT public.app_role() IN ('ADMIN', 'TEHNICIAN', 'CONTABIL') $$;

CREATE OR REPLACE FUNCTION public.app_can_delete()
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$ SELECT public.app_role() = 'ADMIN' $$;

-- ── 4. POLITICI PE DATE ─────────────────────────────────────────────────────
ALTER TABLE public.devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['devices','tasks','invoices','audit_logs','deletions'] LOOP
    -- scoate vechiul acces public
    EXECUTE format('DROP POLICY IF EXISTS "Allow all public access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "mt_read"   ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "mt_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "mt_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "mt_delete" ON public.%I', t);

    EXECUTE format('CREATE POLICY "mt_read"   ON public.%I FOR SELECT TO authenticated USING (public.app_can_read())', t);
    EXECUTE format('CREATE POLICY "mt_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_can_write())', t);
    EXECUTE format('CREATE POLICY "mt_update" ON public.%I FOR UPDATE TO authenticated USING (public.app_can_write()) WITH CHECK (public.app_can_write())', t);
    EXECUTE format('CREATE POLICY "mt_delete" ON public.%I FOR DELETE TO authenticated USING (public.app_can_delete())', t);
  END LOOP;
END $$;

-- ── 5. POLITICI PE PROFILURI ────────────────────────────────────────────────
DROP POLICY IF EXISTS "mt_profile_self"        ON public.profiles;
DROP POLICY IF EXISTS "mt_profile_admin_read"  ON public.profiles;
DROP POLICY IF EXISTS "mt_profile_admin_write" ON public.profiles;
DROP POLICY IF EXISTS "mt_profile_self_name"   ON public.profiles;

-- oricine isi vede propriul profil (ca sa afle daca e aprobat si ce rol are)
CREATE POLICY "mt_profile_self" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- administratorii vad si administreaza toate profilurile
CREATE POLICY "mt_profile_admin_read" ON public.profiles
  FOR SELECT TO authenticated USING (public.app_role() = 'ADMIN');
CREATE POLICY "mt_profile_admin_write" ON public.profiles
  FOR UPDATE TO authenticated USING (public.app_role() = 'ADMIN') WITH CHECK (public.app_role() = 'ADMIN');

-- fiecare isi poate schimba propriul nume, dar nu rolul sau aprobarea
CREATE POLICY "mt_profile_self_name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role     = (SELECT p.role     FROM public.profiles p WHERE p.id = auth.uid())
    AND approved = (SELECT p.approved FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ── 6. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
`;
