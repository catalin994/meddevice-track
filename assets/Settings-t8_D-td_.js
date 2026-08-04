import{m as Qe,o as L,p as Ge,q as Ee,s as Ze,t as qe,v as ea,w as aa,x as he,n as $,S as Ne,y as ta,j as e,z as sa,R as ge,A as la,B as ia}from"./index-ZvwMcIBn.js";import{a as t,o as fe,m as f,v as je,F as Y,z as Ae,b as na,T as ra,w as ca,C as I,e as H,_ as oa,ai as da,d as X,$ as ua,a7 as ma,aj as ve,G as pa,ak as xa,B as we,p as Ta}from"./vendor-icons-D4fOy8Ml.js";import{C as ba}from"./ConfirmDialog-D93xHw9Y.js";import{g as Ea,s as ha,S as Se}from"./scanQuality-BG2ILRky.js";import"./vendor-recharts-jXshe1Ew.js";import"./vendor-db-CxvqBt6T.js";const Ce=`-- BIOMEDIC — REFERATE SI DOCUMENTE DE FUNDAMENTARE
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
  "reference"         TEXT,
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
  ADD COLUMN IF NOT EXISTS "remainingAmount"   NUMERIC;

-- Cautarea dupa referatul sustinut, pe dosarele mari.
CREATE INDEX IF NOT EXISTS documente_fundamentare_referat_idx
  ON public.documente_fundamentare ("referatId");

-- ── 3. ACCES, dupa aceleasi reguli ca restul datelor ────────────────────────
ALTER TABLE public.referate                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documente_fundamentare  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['referate','documente_fundamentare'] LOOP
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
`,Na="2026-08-04 20:24",Ia=({devices:n,onImport:W,auditLog:O=[],currentUser:r=null,onMigrateFiles:j})=>{t.useRef(null);const[J,ga]=t.useState(Qe()),[V,Le]=t.useState(J.url||""),[K,Ie]=t.useState(J.key||""),[R,Xe]=t.useState(!1),[Q,G]=t.useState(!1),[fa,ja]=t.useState(null),[m,D]=t.useState(null),[Z,q]=t.useState(!1),[Oe,Re]=t.useState(null),[De,ee]=t.useState(null),[y,ae]=t.useState(!1),[d,te]=t.useState(null),[k,U]=t.useState(null),[F,se]=t.useState(!1),[A,v]=t.useState(!1),[le,ie]=t.useState(0),[N,p]=t.useState(null),b=t.useCallback(async()=>{if(!L){U("Cloud neconfigurat");return}se(!0),U(null);const{count:a,error:s}=await Ge("devices");s?(U(s.message||"eroare necunoscuta"),te(null)):te(a),se(!1)},[]);t.useEffect(()=>{b()},[b,n.length]);const[u,ne]=t.useState(null),[M,B]=t.useState(!1),ye=t.useCallback(async()=>{B(!0),ne(null);const{data:a,error:s}=await Ee("devices");if(s||!a){p({ok:!1,message:`Nu s-a putut citi lista din cloud: ${(s==null?void 0:s.message)||"eroare"}`}),B(!1);return}const l=new Set(a.map(i=>String(i.id).trim())),c=new Set(n.map(i=>String(i.id).trim())),o=i=>{var T,C;return((T=n.find(z=>z.id===i))==null?void 0:T.name)||((C=a.find(z=>String(z.id).trim()===i))==null?void 0:C.name)||i};ne({localOnly:[...c].filter(i=>!l.has(i)).map(i=>`${o(i)} (${i})`),cloudOnly:[...l].filter(i=>!c.has(i)).map(i=>`${o(i)} (${i})`)}),B(!1)},[n]),ke=t.useCallback(async()=>{if(n.length===0)return;v(!0),ie(0),p(null);const{data:a,error:s}=await Ee("devices");if(s){v(!1),p({ok:!1,message:`Nu s-a putut citi cloud-ul inainte de urcare: ${s.message||s}`});return}const l=Ze(n,a||[]);if(l.length===0){v(!1),p({ok:!0,message:"Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat."}),await b();return}const{error:c,written:o,skippedColumns:i,oversized:T}=await qe("devices",l,100,C=>ie(C));v(!1),c?p({ok:!1,message:`Urcarea s-a oprit dupa ${o} echipamente: ${c.message||c}`}):T.length>0?p({ok:!1,message:`${o} echipamente urcate, dar ${T.length} nu au incaput (documente atasate prea mari): ${T.slice(0,3).join(", ")}${T.length>3?"...":""}`}):i.length>0?p({ok:!0,message:`${o} echipamente au fost urcate. Atentie: campurile ${i.join(", ")} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.`}):p({ok:!0,message:`${o} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await b()},[n,b]),x=t.useMemo(()=>{let a=0,s=0;return n.forEach(l=>(l.files||[]).forEach(c=>{var o;!c.path&&((o=c.url)!=null&&o.startsWith("data:"))&&(a++,s+=Math.round(c.url.length*.75))})),{count:a,mb:s/(1024*1024)}},[n]),[Ue,Fe]=t.useState(()=>Ea().id),Me=t.useCallback(a=>{ha(a),Fe(a)},[]),[w,re]=t.useState(!1),[E,ce]=t.useState({done:0,total:0,label:""}),[oe,g]=t.useState(null),Be=t.useCallback(async()=>{if(j){re(!0),g(null),ce({done:0,total:0,label:""});try{const a=await j((s,l,c)=>ce({done:s,total:l,label:c}));a.error?g(`S-au mutat ${a.moved} din ${a.total}, apoi a aparut o eroare: ${a.error}`):a.total===0?g("Nu mai exista documente de mutat — totul e deja in Storage."):g(`Gata: ${a.moved} documente mutate in Storage.`)}catch(a){g(`Mutarea a esuat: ${(a==null?void 0:a.message)||a}`)}finally{re(!1)}}},[j]),P=ea(r,"manageUsers"),[de,Pe]=t.useState([]),[ue,S]=t.useState(""),h=t.useCallback(async()=>{const a=await aa();Pe(a)},[]);t.useEffect(()=>{P&&h()},[P,h]);const _e=t.useCallback(async(a,s)=>{S("");const{error:l}=await he(a.id,{role:s,approved:!0});l?S(l):h()},[h]),ze=t.useCallback(async a=>{S("");const{error:s}=await he(a.id,{approved:!a.approved});s?S(s):h()},[h]),$e=t.useCallback(async()=>{try{if("caches"in window){const s=await caches.keys();await Promise.all(s.map(l=>caches.delete(l)))}if("serviceWorker"in navigator){const s=await navigator.serviceWorker.getRegistrations();await Promise.all(s.map(l=>l.unregister()))}}catch{}const a=new URL(window.location.href);a.searchParams.set("v",Date.now().toString()),window.location.replace(a.toString())},[]),me=`-- BIOMEDIC — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
-- 1. Deschide Supabase Dashboard -> SQL Editor
-- 2. Lipeste tot acest script si apasa RUN
--
-- IMPORTANT: in PostgreSQL, un nume de coloana scris fara ghilimele devine
-- minuscule (serialNumber -> serialnumber). Aplicatia trimite serialNumber,
-- deci fara ghilimele fiecare salvare de echipament era respinsa.
-- Blocul de migrare de mai jos redenumeste coloanele vechi, pastrand datele.

-- ── 1. TABELE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Altele',
    manufacturer TEXT,
    model TEXT,
    "serialNumber" TEXT,
    department TEXT,
    "purchaseDate" TEXT,
    "warrantyExpiration" TEXT,
    "nextMaintenanceDate" TEXT,
    status TEXT DEFAULT 'Active',
    "isCNCAN" BOOLEAN DEFAULT FALSE,
    image TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    "maintenanceHistory" JSONB DEFAULT '[]'::jsonb,
    contracts JSONB DEFAULT '[]'::jsonb,
    files JSONB DEFAULT '[]'::jsonb,
    components JSONB DEFAULT '[]'::jsonb,
    "locationHistory" JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    "deviceId" TEXT,
    "deviceName" TEXT,
    department TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    "createdAt" TEXT,
    "dueDate" TEXT,
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    supplier TEXT,
    "issueDate" TEXT,
    "dueDate" TEXT,
    amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'RON',
    status TEXT DEFAULT 'NotUploaded',
    "contractNumber" TEXT,
    "deviceIds" JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.referate (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT,
    "issuedBy" TEXT,
    "approvedBy" TEXT,
    department TEXT,
    subject TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    justification TEXT,
    "budgetArticle" TEXT,
    "offerProvider" TEXT,
    "offerNumbers" TEXT,
    "estimatedValue" NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'RON',
    status TEXT DEFAULT 'Draft',
    "deviceIds" JSONB DEFAULT '[]'::jsonb,
    "contactName" TEXT,
    "contactRole" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "filePath" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.documente_fundamentare (
    id TEXT PRIMARY KEY,
    "referatId" TEXT,
    type TEXT,
    number TEXT,
    date TEXT,
    revision INTEGER DEFAULT 0,
    "revisionDate" TEXT,
    compartment TEXT,
    subject TEXT,
    description TEXT,
    "budgetArticle" TEXT,
    "ssiCode" TEXT,
    program TEXT,
    parameters TEXT,
    "previousValue" NUMERIC,
    influence NUMERIC,
    amount NUMERIC,
    currency TEXT DEFAULT 'RON',
    supplier TEXT,
    "referenceNumber" TEXT,
    notes TEXT,
    "filePath" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.deletions (
    id TEXT PRIMARY KEY,
    entity TEXT,
    "entityId" TEXT,
    "deletedAt" TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    "userName" TEXT,
    action TEXT,
    entity TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    details TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ── 2. MIGRARE: redenumeste coloanele minuscule create anterior ──────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('devices','serialnumber','serialNumber'),
      ('devices','purchasedate','purchaseDate'),
      ('devices','warrantyexpiration','warrantyExpiration'),
      ('devices','nextmaintenancedate','nextMaintenanceDate'),
      ('devices','iscncan','isCNCAN'),
      ('devices','maintenancehistory','maintenanceHistory'),
      ('devices','locationhistory','locationHistory'),
      ('tasks','deviceid','deviceId'),
      ('tasks','devicename','deviceName'),
      ('tasks','createdat','createdAt'),
      ('tasks','duedate','dueDate'),
      ('invoices','invoicenumber','invoiceNumber'),
      ('invoices','issuedate','issueDate'),
      ('invoices','duedate','dueDate'),
      ('invoices','contractnumber','contractNumber'),
      ('invoices','deviceids','deviceIds'),
      ('invoices','fileurl','fileUrl'),
      ('invoices','filename','fileName'),
      ('audit_logs','username','userName'),
      ('audit_logs','entityid','entityId'),
      ('audit_logs','entityname','entityName')
    ) AS t(tbl, old_col, new_col)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.old_col)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.new_col) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.old_col, r.new_col);
      RAISE NOTICE 'Redenumit %.% -> %', r.tbl, r.old_col, r.new_col;
    END IF;
  END LOOP;
END $$;

-- ── 3. COMPLETEAZA coloanele lipsa (pentru instalari partiale) ───────────────
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "purchaseDate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "warrantyExpiration" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "nextMaintenanceDate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "isCNCAN" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "maintenanceHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "locationHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS contracts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE public.tasks    ADD COLUMN IF NOT EXISTS "deviceName" TEXT;

-- ── 4. ACCES (idempotent — se poate rula din nou fara eroare) ────────────────
ALTER TABLE public.devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referate   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documente_fundamentare ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletions  ENABLE ROW LEVEL SECURITY;

-- Politicile de acces sunt create de scriptul "Conturi si acces" de mai jos.
-- Acest script nu mai acorda acces public: pana rulezi si celalalt script,
-- tabelele raman inchise.

-- ── 5. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
`;t.useEffect(()=>{(async()=>{const s=await ia();Re(s.count);try{const l=localStorage.getItem("meditrack_devices");ee(l?JSON.parse(l).length:0)}catch{ee(0)}})()},[n]);const Ye=t.useCallback(async()=>{ae(!0);try{const a=localStorage.getItem("meditrack_devices");if(a){const s=JSON.parse(a);Array.isArray(s)&&s.length>0&&(await W(s),$(`S-au recuperat ${s.length} dispozitive din datele vechi.`,"success"))}else $("Nu s-au gasit date vechi de recuperat.","info")}catch(a){$("Recuperarea a esuat: "+a.message,"error")}finally{ae(!1)}},[W]),[pe,xe]=t.useState(!1),He=t.useCallback(()=>{navigator.clipboard.writeText(Ne),xe(!0),setTimeout(()=>xe(!1),2e3)},[]),[Te,be]=t.useState(!1),We=t.useCallback(()=>{navigator.clipboard.writeText(Ce),be(!0),setTimeout(()=>be(!1),2e3)},[]),Je=t.useCallback(()=>{navigator.clipboard.writeText(me),q(!0),setTimeout(()=>q(!1),2e3)},[]),Ve=t.useCallback(async()=>{G(!0),D(null);try{D(await ta())}catch(a){D({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(a==null?void 0:a.message)||String(a),hint:"Reincearca sau verifica conexiunea la internet."})}finally{G(!1)}},[]),[Ke,_]=t.useState(!1);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center justify-between mb-10",children:[e.jsxs("div",{className:"flex items-center gap-5",children:[e.jsx("div",{className:`p-5 rounded-3xl ${L?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(fe,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:Ve,disabled:Q||!L,className:"p-4 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[Q?e.jsx(f,{className:"w-5 h-5 animate-spin"}):e.jsx(je,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest hidden sm:inline",children:"Verifica conexiunea"})]})]}),m&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${m.ok?"bg-green-50 border-green-200 text-green-700":m.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[m.ok?e.jsx(Y,{className:"w-6 h-6 shrink-0"}):e.jsx(Ae,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-widest",children:m.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:m.detail}),m.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:m.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:V,onChange:a=>Le(a.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:R?"text":"password",value:K,onChange:a=>Ie(a.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>Xe(!R),className:"absolute right-2 top-1/2 -translate-y-1/2 px-3 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest",children:R?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>sa(V,K),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),L&&e.jsx("button",{onClick:()=>_(!0),className:"px-8 py-5 bg-red-50 text-red-700 rounded-[1.5rem] font-black transition hover:bg-red-100",title:"Deconecteaza Cloud","aria-label":"Deconecteaza Cloud",children:e.jsx(na,{className:"w-6 h-6"})})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(ra,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx(ca,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-widest",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed",children:me}),e.jsxs("button",{onClick:Je,className:"absolute top-4 right-4 px-3 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",children:[Z?e.jsx(I,{className:"w-4 h-4"}):e.jsx(H,{className:"w-4 h-4"}),Z?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-emerald-600 text-white rounded-2xl shadow-lg",children:e.jsx(je,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Conturi si acces"}),e.jsx("p",{className:"text-[11px] text-emerald-300 font-bold",children:"Ruleaza al doilea, dupa scriptul de schema"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Pana rulezi acest script, tabelele nu au nicio politica de acces, deci sincronizarea nu functioneaza. Dupa ce il rulezi, primul cont inregistrat devine automat Administrator aprobat — inregistreaza-te tu primul."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-emerald-100 break-all whitespace-pre-wrap leading-relaxed",children:Ne}),e.jsxs("button",{onClick:He,className:"sticky top-0 float-right -mt-2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[pe?e.jsx(I,{className:"w-4 h-4"}):e.jsx(H,{className:"w-4 h-4"}),pe?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-indigo-600 text-white rounded-2xl shadow-lg",children:e.jsx(oa,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Referate si documente de fundamentare"}),e.jsx("p",{className:"text-[11px] text-indigo-300 font-bold",children:"Ruleaza al treilea, dupa cel de conturi"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Cele doua tabele nu sunt create de scripturile de mai sus. Pana rulezi acest script, referatele si documentele de fundamentare se salveaza doar pe aparatul pe care le faci: nu ajung pe telefon, si nu le vede nimeni altcineva."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-indigo-100 break-all whitespace-pre-wrap leading-relaxed",children:Ce}),e.jsxs("button",{onClick:We,className:"sticky top-0 float-right -mt-2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[Te?e.jsx(I,{className:"w-4 h-4"}):e.jsx(H,{className:"w-4 h-4"}),Te?"Copiat":"Copiaza SQL"]})]})]})]}),j&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-emerald-100 text-emerald-600 rounded-3xl",children:e.jsx(da,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Documente in Storage"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Scoate fisierele din interiorul randurilor"})]})]}),x.count===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(Y,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsx("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:"Toate documentele sunt deja in Storage. Sincronizarea nu le mai transporta la fiecare rulare."})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"p-5 bg-amber-50 border border-amber-100 rounded-2xl mb-5",children:e.jsxs("p",{className:"text-sm font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:x.count===1?"Un document":`${x.count} documente`}),x.mb>=.1?` (~${x.mb.toFixed(1)} MB)`:"",x.count===1?" este":" sunt"," inca salvat",x.count===1?"":"e"," in interiorul randurilor dispozitivelor. Fiecare telefon le descarca integral la fiecare sincronizare. Mutarea lor in Storage lasa in rand doar o referinta."]})}),e.jsxs("button",{onClick:Be,disabled:w,className:"w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3",children:[w?e.jsx(X,{className:"w-5 h-5 animate-spin"}):e.jsx(ua,{className:"w-5 h-5"}),w?"Se muta...":"Muta documentele in Storage"]})]}),w&&E.total>0&&e.jsxs("div",{className:"mt-5 space-y-2",children:[e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-emerald-500 transition-all",style:{width:`${Math.round(E.done/E.total*100)}%`}})}),e.jsxs("p",{className:"text-xs font-semibold text-slate-500 truncate",children:[E.done," / ",E.total," · ",E.label]})]}),oe&&e.jsx("p",{className:"mt-5 text-sm font-semibold text-slate-700",children:oe})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(ma,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Calitatea scanarilor"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat de mult se comprima paginile scanate"})]})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:Se.map(a=>{const s=a.id===Ue;return e.jsxs("button",{onClick:()=>Me(a.id),className:`text-left p-5 rounded-2xl border-2 transition ${s?"border-blue-600 bg-blue-50":"border-slate-200 bg-white hover:border-slate-300"}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-2 mb-2",children:[e.jsx("span",{className:`text-[15px] font-bold ${s?"text-blue-700":"text-slate-900"}`,children:a.label}),s&&e.jsx(I,{className:"w-4 h-4 text-blue-600 shrink-0"})]}),e.jsx("p",{className:"text-xs font-medium text-slate-500 leading-relaxed mb-3",children:a.description}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500",children:["~",a.approxKb," KB / pagina"]})]},a.id)})}),e.jsxs("p",{className:"mt-5 text-[13px] font-medium text-slate-500 leading-relaxed",children:["Cu 1 GB de spatiu, alegerea inseamna aproximativ"," ",e.jsx("span",{className:"font-bold text-slate-700",children:Se.map(a=>`${a.label}: ${Math.round(1024*1024/a.approxKb/3).toLocaleString("ro-RO")}`).join(" · ")})," ","documente de cate 3 pagini. Setarea se aplica scanarilor viitoare; cele existente raman neschimbate."]})]}),P&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(ve,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:"Controlul accesului in aplicatie"})]})]}),ue&&e.jsx("div",{className:"mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl",children:e.jsx("p",{className:"text-xs font-bold text-red-600",children:ue})}),e.jsxs("div",{className:"space-y-3 mb-8",children:[de.length===0&&e.jsx("p",{className:"text-sm font-semibold text-slate-500 py-6 text-center",children:"Niciun cont inca. Utilizatorii se inregistreaza singuri din ecranul de autentificare."}),de.map(a=>e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:`p-2.5 rounded-xl border shrink-0 self-start ${a.approved?"bg-white text-indigo-600 border-slate-200":"bg-amber-50 text-amber-700 border-amber-200"}`,children:e.jsx(ve,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-[15px] font-bold text-slate-900 truncate",children:[a.name,a.id===(r==null?void 0:r.id)&&e.jsx("span",{className:"ml-2 text-[11px] text-blue-600 font-bold",children:"(tu)"})]}),e.jsx("p",{className:"text-xs font-semibold text-slate-500 truncate",children:a.email}),!a.approved&&e.jsx("p",{className:"text-[11px] font-bold text-amber-600 mt-0.5",children:"Asteapta aprobare"})]}),e.jsx("select",{value:a.role,onChange:s=>_e(a,s.target.value),disabled:a.id===(r==null?void 0:r.id),title:a.id===(r==null?void 0:r.id)?"Nu iti poti schimba propriul rol":"Schimba rolul",className:"px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none disabled:opacity-50",children:Object.keys(ge).map(s=>e.jsx("option",{value:s,children:ge[s]},s))}),e.jsx("button",{onClick:()=>ze(a),disabled:a.id===(r==null?void 0:r.id),className:`px-4 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap ${a.approved?"bg-white text-slate-500 border-2 border-slate-200 hover:text-red-600 hover:border-red-200":"bg-emerald-600 text-white hover:bg-emerald-700"}`,children:a.approved?"Suspenda":"Aproba"})]},a.id))]}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3",children:[e.jsx("p",{className:"text-[13px] font-bold text-slate-500",children:"Cum se adauga un utilizator"}),e.jsxs("p",{className:"text-sm font-medium text-slate-600 leading-relaxed",children:["Persoana isi creeaza singura cont din ecranul de autentificare, cu emailul si o parola proprie. Contul apare aici imediat, marcat ",e.jsx("span",{className:"font-bold text-amber-600",children:"Asteapta aprobare"}),", si nu vede niciun fel de date pana cand nu ii alegi un rol si apesi ",e.jsx("span",{className:"font-bold",children:"Aproba"}),"."]}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-500 leading-relaxed pt-1",children:["Roluri: ",e.jsx("span",{className:"text-slate-700",children:"Administrator"})," (tot, inclusiv stergeri) ·",e.jsx("span",{className:"text-slate-700",children:" Tehnician"})," (fara Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Contabil"})," (cu Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Vizualizare"})," (doar citire)"]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(pa,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(O.length,50)," actiuni"]})]})]}),O.length===0?e.jsx("p",{className:"py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:O.slice(0,50).map(a=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${a.action==="delete"?"bg-red-50 text-red-500":a.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:a.action==="create"?"Creat":a.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500",children:a.entity==="device"?"Dispozitiv":a.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:a.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:a.userName}),e.jsx("p",{className:"shrink-0 text-[10px] font-mono font-bold text-slate-500",children:new Date(a.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},a.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(xa,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(f,{className:`w-5 h-5 ${y?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white uppercase tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:Ye,disabled:y,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[y?e.jsx(X,{className:"w-5 h-5 animate-spin"}):e.jsx(f,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[10px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:De??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(we,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 uppercase tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:Oe??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Dispozitive active in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:n.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${d!==null&&d<n.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${d!==null&&d<n.length?"text-amber-600":"text-emerald-600"}`,children:F?"...":k?"—":d??"?"}),e.jsx("button",{onClick:b,disabled:F,className:"p-1.5 text-slate-500 hover:text-blue-600 transition",title:"Verifica din nou","aria-label":"Verifica din nou",children:e.jsx(f,{className:`w-3.5 h-3.5 ${F?"animate-spin":""}`})})]})]}),k&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",k]}),d!==null&&d<n.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:n.length-d})," echipamente. Pe alt telefon vor aparea doar cele ",d," existente in cloud. Apasa mai jos pentru a urca toate dispozitivele."]}),e.jsxs("button",{onClick:ke,disabled:A,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[A?e.jsx(X,{className:"w-4 h-4 animate-spin"}):e.jsx(fe,{className:"w-4 h-4"}),A?`Se urca ${le}...`:"Urca toate dispozitivele in cloud"]}),A&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${n.length?le/n.length*100:0}%`}})})]}),e.jsxs("button",{onClick:ye,disabled:M,className:"w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[M?e.jsx(X,{className:"w-4 h-4 animate-spin"}):e.jsx(we,{className:"w-4 h-4"}),M?"Se compara...":"Compara local cu cloud"]}),u&&e.jsx("div",{className:"p-4 bg-white border border-slate-200 rounded-2xl space-y-3",children:u.localOnly.length===0&&u.cloudOnly.length===0?e.jsx("p",{className:"text-[11px] font-bold text-emerald-700",children:"Identice — fiecare echipament local exista si in cloud."}):e.jsxs(e.Fragment,{children:[u.localOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1",children:["Doar pe acest dispozitiv (",u.localOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:u.localOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Urca toate dispozitivele" ca sa ajunga si in cloud.'})]}),u.cloudOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1",children:["Doar in cloud (",u.cloudOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:u.cloudOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Re-sincronizare" ca sa le aduci aici.'})]})]})}),N&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${N.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[N.ok?e.jsx(Y,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(Ae,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${N.ok?"text-emerald-700":"text-red-700"}`,children:N.message})]})]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-slate-200 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest",children:"Versiune aplicatie"}),e.jsx("span",{className:"text-[10px] font-mono font-bold text-slate-600",children:Na})]}),e.jsxs("button",{onClick:$e,className:"w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-2",children:[e.jsx(f,{className:"w-3.5 h-3.5"})," Forteaza reincarcarea aplicatiei"]})]})]})]}),e.jsx(ba,{open:Ke,tone:"neutral",title:"Deconectezi cloud-ul?",icon:e.jsx(Ta,{className:"w-8 h-8 sm:w-10 sm:h-10"}),body:e.jsx(e.Fragment,{children:"Aplicatia trece in modul doar local pe acest dispozitiv. Datele salvate raman, dar nu se mai sincronizeaza pana la o reconectare."}),confirmLabel:"Deconecteaza",cancelLabel:"Ramai conectat",onCancel:()=>_(!1),onConfirm:()=>{la(),_(!1)}})]})};export{Ia as default};
