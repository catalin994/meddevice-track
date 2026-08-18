/**
 * Tabelele referatelor si ale documentelor de fundamentare.
 *
 * Scriptul de securitate se ocupa de aparate, sarcini, facturi si conturi — el
 * a fost scris inainte ca tab-urile de achizitii sa existe. Fara acesta cele
 * doua tabele lipsesc cu totul din baza de date, iar sincronizarea le sare in
 * tacere: documentele raman pe telefonul sau calculatorul pe care au fost
 * facute, si nu ajung nicaieri altundeva.
 *
 * Tinut ca sir, ca ecranul de Configurare sa il poata arata si copia — proiectul
 * n-are server de pe care sa ruleze migratii.
 *
 * Numele coloanelor sunt exact numele campurilor din aplicatie, cu majuscule cu
 * tot: randul se urca asa cum e. De aceea sunt intre ghilimele — altfel
 * Postgres le-ar face litere mici si n-ar mai corespunde.
 *
 * Se poate rula de cate ori e nevoie.
 */
export const ACHIZITII_SQL = `-- BIOMEDIC — REFERATE, DOCUMENTE DE FUNDAMENTARE SI COMENZI
-- Ruleaza in Supabase Dashboard -> SQL Editor -> RUN.
-- Se poate rula de mai multe ori, in siguranta.
--
-- Ruleaza-l DUPA scriptul "Conturi si acces": foloseste functiile de rol
-- definite acolo (app_can_read, app_can_write, app_can_delete).

-- ── 1. REFERATE DE NECESITATE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referate (
  id              TEXT PRIMARY KEY,
  "number"        TEXT,
  "date"          TEXT,
  "issuedBy"      TEXT,
  "approvedBy"    TEXT,
  "department"    TEXT,
  "subject"       TEXT,
  "items"         JSONB   NOT NULL DEFAULT '[]'::jsonb,
  "justification" TEXT,
  "budgetArticle" TEXT,
  "offerProvider" TEXT,
  "offerNumbers"  TEXT,
  "currency"      TEXT,
  "status"        TEXT,
  "deviceIds"     JSONB   NOT NULL DEFAULT '[]'::jsonb,
  "contactName"   TEXT,
  "contactRole"   TEXT,
  "contactEmail"  TEXT,
  "contactPhone"  TEXT,
  "estimatedValue" NUMERIC,
  "filePath"      TEXT,
  "fileUrl"       TEXT,
  "fileName"      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. DOCUMENTE DE FUNDAMENTARE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documente_fundamentare (
  id                  TEXT PRIMARY KEY,
  "referatId"         TEXT,
  "type"              TEXT,
  "number"            TEXT,
  "date"              TEXT,
  "revision"          INTEGER,
  "revisionDate"      TEXT,
  "compartment"       TEXT,
  "subject"           TEXT,
  "shortDescription"  TEXT,
  "description"       TEXT,
  "budgetArticle"     TEXT,
  "ssiCode"           TEXT,
  "program"           TEXT,
  "element"           TEXT,
  "parameters"        TEXT,
  "previousValue"     NUMERIC,
  "influence"         NUMERIC,
  "amount"            NUMERIC,
  "remainingAmount"   NUMERIC,
  "currency"          TEXT,
  "supplier"          TEXT,
  "referenceNumber"   TEXT,
  "frameworkContract" TEXT,
  "frameworkTotal"    NUMERIC,
  "reference"         TEXT,
  "recurring"         BOOLEAN,
  "seriesId"          TEXT,
  "periodMonth"       TEXT,
  "notes"             TEXT,
  "filePath"          TEXT,
  "fileUrl"           TEXT,
  "fileName"          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coloanele adaugate dupa ce formularul a fost pus fata in fata cu documentele
-- reale ale spitalului. Separate, ca sa se adauge si la un tabel deja existent.
ALTER TABLE public.documente_fundamentare
  ADD COLUMN IF NOT EXISTS "shortDescription"  TEXT,
  ADD COLUMN IF NOT EXISTS "element"           TEXT,
  ADD COLUMN IF NOT EXISTS "reference"         TEXT,
  ADD COLUMN IF NOT EXISTS "frameworkContract" TEXT,
  ADD COLUMN IF NOT EXISTS "remainingAmount"   NUMERIC,
  -- documentele lunare de pe contracte: ce serie, ce luna
  ADD COLUMN IF NOT EXISTS "recurring"         BOOLEAN,
  ADD COLUMN IF NOT EXISTS "seriesId"          TEXT,
  ADD COLUMN IF NOT EXISTS "periodMonth"       TEXT,
  -- plafonul acordului-cadru din care trag alocarile lunare
  ADD COLUMN IF NOT EXISTS "frameworkTotal"    NUMERIC;

-- ── 3. COMENZI CATRE FURNIZOR ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comenzi (
  id                  TEXT PRIMARY KEY,
  "number"            TEXT,
  "date"              TEXT,
  "supplier"          TEXT,
  "supplierCui"       TEXT,
  "referatNumber"     TEXT,
  "offerNumber"       TEXT,
  "contractNumber"    TEXT,
  "frameworkContract" TEXT,
  "warehouse"         TEXT,
  "paymentDays"       INTEGER,
  "items"             JSONB NOT NULL DEFAULT '[]'::jsonb,
  "currency"          TEXT,
  "status"            TEXT,
  "totalWithVat"      NUMERIC,
  "deliveredAt"       TEXT,
  "notes"             TEXT,
  "deviceIds"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  "filePath"          TEXT,
  "fileUrl"           TEXT,
  "fileName"          TEXT,
  "fileSize"          NUMERIC,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. CONTRACTE ────────────────────────────────────────────────────────────
-- Contractele stateau doar in randul fiecarui aparat pe care erau trecute. Unul
-- de consumabile sau de service general, care nu se leaga de un aparat anume,
-- n-avea unde sa stea si nu se putea salva deloc.
CREATE TABLE IF NOT EXISTS public.contracte (
  id                  TEXT PRIMARY KEY,
  "contractNumber"    TEXT,
  "name"              TEXT,
  "provider"          TEXT,
  "startDate"         TEXT,
  "endDate"           TEXT,
  "coverageDetails"   TEXT,
  "contactPhone"      TEXT,
  "annualCost"        NUMERIC,
  "annualCostWithVat" NUMERIC,
  "deviceIds"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  "filePath"          TEXT,
  "fileUrl"           TEXT,
  "fileName"          TEXT,
  "fileSize"          NUMERIC,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracte_numar_idx ON public.contracte ("contractNumber");

-- Facturile stiu pe ce comanda vin: numarul e tiparit pe ele.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;

-- Cautarea dupa referatul sustinut, pe dosarele mari.
CREATE INDEX IF NOT EXISTS documente_fundamentare_referat_idx
  ON public.documente_fundamentare ("referatId");

-- Lunile aceleiasi serii se citesc impreuna la fiecare deschidere a tab-ului.
CREATE INDEX IF NOT EXISTS documente_fundamentare_serie_idx
  ON public.documente_fundamentare ("seriesId", "periodMonth");

-- ── 3. ACCES, dupa aceleasi reguli ca restul datelor ────────────────────────
ALTER TABLE public.referate                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documente_fundamentare  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comenzi                 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['referate','documente_fundamentare','comenzi','contracte'] LOOP
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

-- ── 4. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
`;
