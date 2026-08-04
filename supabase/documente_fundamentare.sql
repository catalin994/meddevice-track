-- Campurile noi ale documentului de fundamentare, adaugate dupa ce formularul
-- a fost pus fata in fata cu documentele reale ale spitalului.
--
-- Aplicatia urca obiectul asa cum e, deci numele coloanelor sunt cele ale
-- campurilor — cu majuscule, deci intre ghilimele.
--
-- Pana cand se ruleaza, documentele se salveaza local si merg mai departe;
-- doar sincronizarea in cloud sare peste tabel.

alter table public.documente_fundamentare
  add column if not exists "shortDescription"  text,   -- punctul 2, cand difera de titlu
  add column if not exists "element"           text,   -- coloana 1 din tabelul de valori
  add column if not exists "reference"         text,   -- fraza cu oferta / contractul
  add column if not exists "frameworkContract" text,   -- nr. acordului-cadru
  add column if not exists "remainingAmount"   numeric; -- "ramane in suma de ___ lei"
