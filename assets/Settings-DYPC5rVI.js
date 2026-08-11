import{s as Oe,m as ba,o as _,p as Ea,q as Re,t as ha,v as Na,w as fa,x as ga,y as De,n as ae,S as ye,z as ja,j as e,A as Aa,R as ke,B as Sa,C as La}from"./index-W8WSOrhC.js";import{a as t,o as Ue,m as w,v as Fe,G as te,z as Me,b as va,T as Ia,w as wa,C as P,e as se,$ as Ca,aj as Be,d as R,I as Xa,a0 as Oa,a8 as Ra,ak as _e,H as Da,al as ya,B as Pe,p as ka}from"./vendor-icons-CdwZrgy4.js";import{C as Ua}from"./ConfirmDialog-CWZlo1bK.js";import{g as Fa,s as Ma,S as ze}from"./scanQuality-BG2ILRky.js";import"./vendor-recharts-CzDSmGWv.js";import"./vendor-db-CxvqBt6T.js";const Ye="meditrack_limita_stocare_gb",ie=1,Ba=()=>{try{const i=parseFloat(localStorage.getItem(Ye)||"");return Number.isFinite(i)&&i>0?i:ie}catch{return ie}},_a=i=>{try{localStorage.setItem(Ye,String(i))}catch{}},C=i=>{if(!Number.isFinite(i)||i<=0)return"0 kB";const d=["kB","MB","GB","TB"];let n=i/1024,T=0;for(;n>=1024&&T<d.length-1;)n/=1024,T++;return`${n.toLocaleString("ro-RO",{maximumFractionDigits:n<10?1:0,useGrouping:!1})} ${d[T]}`},Pa=async()=>{const i={fisiere:0,octeti:0,peFeluri:[]};if(!Oe)return{...i,eroare:"Cloud neconfigurat"};try{const{data:d,error:n}=await Oe.rpc("spatiu_fisiere");if(n){const u=/does not exist|not find|404|PGRST202/i.test(n.message||"");return{...i,eroare:u?'Ruleaza din nou scriptul "Conturi si acces" din Configurare — masurarea are nevoie de o functie noua.':n.message||"Nu s-a putut citi marimea"}}const T=(d||[]).map(u=>({fel:String(u.fel||"altele"),fisiere:Number(u.fisiere)||0,octeti:Number(u.octeti)||0}));return{fisiere:T.reduce((u,b)=>u+b.fisiere,0),octeti:T.reduce((u,b)=>u+b.octeti,0),peFeluri:T.sort((u,b)=>b.octeti-u.octeti)}}catch(d){return{...i,eroare:(d==null?void 0:d.message)||"Nu s-a putut citi marimea"}}},za=async()=>{var i,d;try{const n=await((d=(i=navigator.storage)==null?void 0:i.estimate)==null?void 0:d.call(i));return{octeti:(n==null?void 0:n.usage)||0,limita:(n==null?void 0:n.quota)||0}}catch{return{octeti:0,limita:0}}},$a=(i=[],d=[])=>{const n=new Map;let T=0;const u=(m,x)=>{const p=n.get(m)||{fel:m,fisiere:0,octeti:0};p.fisiere+=1,x&&x>0?p.octeti+=x:T+=1,n.set(m,p)};for(const m of i)for(const x of m.files||[])x.path&&u("devices",x.size);for(const m of d)m.filePath&&u("invoices",m.fileSize);const b=[...n.values()].sort((m,x)=>x.octeti-m.octeti);return{fisiere:b.reduce((m,x)=>m+x.fisiere,0),octeti:b.reduce((m,x)=>m+x.octeti,0),peFeluri:b,faraMarime:T}},Ya={devices:"Documentele aparatelor",invoices:"Facturi",sabloane:"Sabloane Word",tasks:"Atasamente tichete",altele:"Altele"},$e=`-- BIOMEDIC — REFERATE, DOCUMENTE DE FUNDAMENTARE SI COMENZI
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
  FOREACH t IN ARRAY ARRAY['referate','documente_fundamentare','comenzi'] LOOP
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
`,Ha="2026-08-11 17:35",at=({devices:i,invoices:d=[],tasks:n=[],referate:T=[],foundationDocs:u=[],comenzi:b=[],onImport:m,auditLog:x=[],currentUser:p=null,onMigrateFiles:D})=>{t.useRef(null);const[le,Wa]=t.useState(ba()),[re,He]=t.useState(le.url||""),[ne,We]=t.useState(le.key||""),[z,Ge]=t.useState(!1),[ce,oe]=t.useState(!1),[Ga,Ja]=t.useState(null),[N,$]=t.useState(null),[de,ue]=t.useState(!1),[Je,Ve]=t.useState(null),[Y,Ke]=t.useState(null),[f,Qe]=t.useState(null),[me,pe]=t.useState(!1),[j,Ze]=t.useState(()=>Ba()),y=t.useMemo(()=>$a(i,d),[i,d]),H=t.useCallback(async()=>{pe(!0);const[a,s]=await Promise.all([Pa(),za()]);Ke(a),Qe(s),pe(!1)},[]);t.useEffect(()=>{H()},[H]);const[qe,xe]=t.useState(null),[W,Te]=t.useState(!1),[E,be]=t.useState(null),[G,J]=t.useState(null),[V,Ee]=t.useState(!1),[k,U]=t.useState(!1),[he,Ne]=t.useState(0),[X,g]=t.useState(null),L=t.useCallback(async()=>{if(!_){J("Cloud neconfigurat");return}Ee(!0),J(null);const{count:a,error:s}=await Ea("devices");s?(J(s.message||"eroare necunoscuta"),be(null)):be(a),Ee(!1)},[]);t.useEffect(()=>{L()},[L,i.length]);const[h,fe]=t.useState(null),[K,Q]=t.useState(!1),ea=t.useCallback(async()=>{Q(!0),fe(null);const{data:a,error:s}=await Re("devices");if(s||!a){g({ok:!1,message:`Nu s-a putut citi lista din cloud: ${(s==null?void 0:s.message)||"eroare"}`}),Q(!1);return}const l=new Set(a.map(c=>String(c.id).trim())),r=new Set(i.map(c=>String(c.id).trim())),o=c=>{var S,B;return((S=i.find(ee=>ee.id===c))==null?void 0:S.name)||((B=a.find(ee=>String(ee.id).trim()===c))==null?void 0:B.name)||c};fe({localOnly:[...r].filter(c=>!l.has(c)).map(c=>`${o(c)} (${c})`),cloudOnly:[...l].filter(c=>!r.has(c)).map(c=>`${o(c)} (${c})`)}),Q(!1)},[i]),aa=t.useCallback(async()=>{if(i.length===0)return;U(!0),Ne(0),g(null);const{data:a,error:s}=await Re("devices");if(s){U(!1),g({ok:!1,message:`Nu s-a putut citi cloud-ul inainte de urcare: ${s.message||s}`});return}const l=ha(i,a||[]);if(l.length===0){U(!1),g({ok:!0,message:"Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat."}),await L();return}const{error:r,written:o,skippedColumns:c,oversized:S}=await Na("devices",l,100,B=>Ne(B));U(!1),r?g({ok:!1,message:`Urcarea s-a oprit dupa ${o} echipamente: ${r.message||r}`}):S.length>0?g({ok:!1,message:`${o} echipamente urcate, dar ${S.length} nu au incaput (documente atasate prea mari): ${S.slice(0,3).join(", ")}${S.length>3?"...":""}`}):c.length>0?g({ok:!0,message:`${o} echipamente au fost urcate. Atentie: campurile ${c.join(", ")} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.`}):g({ok:!0,message:`${o} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await L()},[i,L]),A=t.useMemo(()=>{let a=0,s=0;const l=r=>{r!=null&&r.startsWith("data:")&&(a++,s+=Math.round(r.length*.75))};return i.forEach(r=>{(r.files||[]).forEach(o=>{o.path||l(o.url)}),(r.contracts||[]).forEach(o=>{o.filePath||l(o.fileUrl)})}),n.forEach(r=>(r.attachments||[]).forEach(o=>{o.path||l(o.url)})),[...d,...T,...u,...b].forEach(r=>{r.filePath||l(r.fileUrl)}),{count:a,mb:s/(1024*1024)}},[i,n,d,T,u,b]),[ta,sa]=t.useState(()=>Fa().id),ia=t.useCallback(a=>{Ma(a),sa(a)},[]),[F,ge]=t.useState(!1),[v,je]=t.useState({done:0,total:0,label:""}),[Ae,O]=t.useState(null),la=t.useCallback(async()=>{if(D){ge(!0),O(null),je({done:0,total:0,label:""});try{const a=await D((s,l,r)=>je({done:s,total:l,label:r}));a.error?O(`S-au mutat ${a.moved} din ${a.total}, apoi a aparut o eroare: ${a.error}`):a.total===0?O("Nu mai exista documente de mutat — totul e deja in Storage."):O(`Gata: ${a.moved} documente mutate in Storage.`)}catch(a){O(`Mutarea a esuat: ${(a==null?void 0:a.message)||a}`)}finally{ge(!1)}}},[D]),Z=fa(p,"manageUsers"),[Se,ra]=t.useState([]),[Le,M]=t.useState(""),I=t.useCallback(async()=>{const a=await ga();ra(a)},[]);t.useEffect(()=>{Z&&I()},[Z,I]);const na=t.useCallback(async(a,s)=>{M("");const{error:l}=await De(a.id,{role:s,approved:!0});l?M(l):I()},[I]),ca=t.useCallback(async a=>{M("");const{error:s}=await De(a.id,{approved:!a.approved});s?M(s):I()},[I]),oa=t.useCallback(async()=>{try{if("caches"in window){const s=await caches.keys();await Promise.all(s.map(l=>caches.delete(l)))}if("serviceWorker"in navigator){const s=await navigator.serviceWorker.getRegistrations();await Promise.all(s.map(l=>l.unregister()))}}catch{}const a=new URL(window.location.href);a.searchParams.set("v",Date.now().toString()),window.location.replace(a.toString())},[]),ve=`-- BIOMEDIC — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
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
    "cncanExpiry" TEXT,
    "metrologyRequired" BOOLEAN DEFAULT FALSE,
    "metrologyCertificate" TEXT,
    "metrologyDate" TEXT,
    "metrologyExpiry" TEXT,
    "metrologyLab" TEXT,
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
    "budgetArticle" TEXT,
    "fileSize" NUMERIC,
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
-- termenele: autorizatia CNCAN si verificarea metrologica periodica
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "cncanExpiry" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "metrologyRequired" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "metrologyCertificate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "metrologyDate" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "metrologyExpiry" TEXT;
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "metrologyLab" TEXT;
-- articolul bugetar al facturii, pentru pagina de buget
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "budgetArticle" TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "uploadedAt" TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "fileSize" NUMERIC;
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
`;t.useEffect(()=>{(async()=>{const s=await La();Ve(s.count);try{const l=localStorage.getItem("meditrack_devices");xe(l?JSON.parse(l).length:0)}catch{xe(0)}})()},[i]);const da=t.useCallback(async()=>{Te(!0);try{const a=localStorage.getItem("meditrack_devices");if(a){const s=JSON.parse(a);Array.isArray(s)&&s.length>0&&(await m(s),ae(`S-au recuperat ${s.length} dispozitive din datele vechi.`,"success"))}else ae("Nu s-au gasit date vechi de recuperat.","info")}catch(a){ae("Recuperarea a esuat: "+a.message,"error")}finally{Te(!1)}},[m]),[Ie,we]=t.useState(!1),ua=t.useCallback(()=>{navigator.clipboard.writeText(ye),we(!0),setTimeout(()=>we(!1),2e3)},[]),[Ce,Xe]=t.useState(!1),ma=t.useCallback(()=>{navigator.clipboard.writeText($e),Xe(!0),setTimeout(()=>Xe(!1),2e3)},[]),pa=t.useCallback(()=>{navigator.clipboard.writeText(ve),ue(!0),setTimeout(()=>ue(!1),2e3)},[]),xa=t.useCallback(async()=>{oe(!0),$(null);try{$(await ja())}catch(a){$({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(a==null?void 0:a.message)||String(a),hint:"Reincearca sau verifica conexiunea la internet."})}finally{oe(!1)}},[]),[Ta,q]=t.useState(!1);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center justify-between mb-10",children:[e.jsxs("div",{className:"flex items-center gap-5",children:[e.jsx("div",{className:`p-5 rounded-3xl ${_?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(Ue,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:xa,disabled:ce||!_,className:"p-4 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[ce?e.jsx(w,{className:"w-5 h-5 animate-spin"}):e.jsx(Fe,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest hidden sm:inline",children:"Verifica conexiunea"})]})]}),N&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${N.ok?"bg-green-50 border-green-200 text-green-700":N.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[N.ok?e.jsx(te,{className:"w-6 h-6 shrink-0"}):e.jsx(Me,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-widest",children:N.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:N.detail}),N.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:N.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:re,onChange:a=>He(a.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:z?"text":"password",value:ne,onChange:a=>We(a.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>Ge(!z),className:"absolute right-2 top-1/2 -translate-y-1/2 px-3 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest",children:z?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>Aa(re,ne),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),_&&e.jsx("button",{onClick:()=>q(!0),className:"px-8 py-5 bg-red-50 text-red-700 rounded-[1.5rem] font-black transition hover:bg-red-100",title:"Deconecteaza Cloud","aria-label":"Deconecteaza Cloud",children:e.jsx(va,{className:"w-6 h-6"})})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(Ia,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx(wa,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-widest",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed",children:ve}),e.jsxs("button",{onClick:pa,className:"absolute top-4 right-4 px-3 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",children:[de?e.jsx(P,{className:"w-4 h-4"}):e.jsx(se,{className:"w-4 h-4"}),de?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-emerald-600 text-white rounded-2xl shadow-lg",children:e.jsx(Fe,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Conturi si acces"}),e.jsx("p",{className:"text-[11px] text-emerald-300 font-bold",children:"Ruleaza al doilea, dupa scriptul de schema"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Pana rulezi acest script, tabelele nu au nicio politica de acces, deci sincronizarea nu functioneaza. Dupa ce il rulezi, primul cont inregistrat devine automat Administrator aprobat — inregistreaza-te tu primul."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-emerald-100 break-all whitespace-pre-wrap leading-relaxed",children:ye}),e.jsxs("button",{onClick:ua,className:"sticky top-0 float-right -mt-2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[Ie?e.jsx(P,{className:"w-4 h-4"}):e.jsx(se,{className:"w-4 h-4"}),Ie?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-indigo-600 text-white rounded-2xl shadow-lg",children:e.jsx(Ca,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Referate, documente de fundamentare si comenzi"}),e.jsx("p",{className:"text-[11px] text-indigo-300 font-bold",children:"Ruleaza al treilea, dupa cel de conturi"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Cele trei tabele nu sunt create de scripturile de mai sus. Pana rulezi acest script, referatele, documentele de fundamentare si comenzile se salveaza doar pe aparatul pe care le faci: nu ajung pe telefon, si nu le vede nimeni altcineva. Tot el adauga pe facturi numarul comenzii, cel dupa care se leaga singure de comanda."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-indigo-100 break-all whitespace-pre-wrap leading-relaxed",children:$e}),e.jsxs("button",{onClick:ma,className:"sticky top-0 float-right -mt-2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[Ce?e.jsx(P,{className:"w-4 h-4"}):e.jsx(se,{className:"w-4 h-4"}),Ce?"Copiat":"Copiaza SQL"]})]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-4 mb-6",children:[e.jsxs("div",{className:"flex items-center gap-5 min-w-0",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Be,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Spatiu pentru fisiere"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat ocupa documentele si cat a mai ramas"})]})]}),e.jsxs("button",{onClick:H,disabled:me,className:"px-5 py-3 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-50 flex items-center gap-2",children:[me?e.jsx(R,{className:"w-4 h-4 animate-spin"}):e.jsx(w,{className:"w-4 h-4"}),"Masoara din nou"]})]}),(()=>{const a=!!Y&&!Y.eroare,s=a?Y:y,l=s.octeti;return e.jsxs("div",{className:"space-y-6",children:[!a&&e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3",children:[e.jsx(Xa,{className:"w-4 h-4 text-slate-500 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-600 leading-relaxed",children:["Socotit din evidenta aplicatiei",y.faraMarime>0&&e.jsxs(e.Fragment,{children:[" — ",y.faraMarime," document",y.faraMarime===1?"":"e"," urcate inainte ca marimea sa fie retinuta nu intra in total"]}),'. Pentru cifra exacta din stocare, ruleaza din nou scriptul "Conturi si acces" de mai sus.']})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsxs("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:["In cloud · vazut de toti",a?" · masurat exact":""]}),e.jsxs("p",{className:"text-2xl font-black text-slate-900 tabular-nums mt-0.5",children:[C(l),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",j," GB"]})]})]}),e.jsxs("p",{className:`text-sm font-black tabular-nums ${l>j*1024**3*.9?"text-red-600":"text-emerald-700"}`,children:["mai ai ",C(Math.max(0,j*1024**3-l))]})]}),e.jsx("div",{className:"h-3 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all ${l>j*1024**3*.9?"bg-red-600":l>j*1024**3*.7?"bg-amber-500":"bg-blue-600"}`,style:{width:`${Math.min(100,l/(j*1024**3)*100)}%`}})}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500 mt-2",children:[`${s.fisiere} fisiere`,s.peFeluri.length?` · ${s.peFeluri.map(r=>`${Ya[r.fel]||r.fel} ${C(r.octeti)}`).join(" · ")}`:""]})]}),e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3",children:[e.jsx("label",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:"Limita abonamentului"}),e.jsx("input",{type:"number",min:"0.1",step:"0.1",value:j,onChange:r=>{const o=parseFloat(r.target.value)||ie;Ze(o),_a(o)},"aria-label":"Limita de stocare, in gigaocteti",className:"w-28 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none"}),e.jsx("span",{className:"text-[11px] font-bold text-slate-500",children:"GB — Supabase nu spune cat da planul vostru, asa ca se scrie aici. Gratuit e 1 GB. Se tine pe aparatul de la care se scrie, deci pe telefon trebuie trecuta din nou."})]}),f&&f.limita>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:"Pe aparatul acesta · copiile pentru offline"}),e.jsxs("p",{className:"text-lg font-black text-slate-900 tabular-nums mt-0.5",children:[C(f.octeti),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",C(f.limita)]})]})]}),e.jsxs("p",{className:"text-sm font-black text-emerald-700 tabular-nums",children:["mai ai ",C(Math.max(0,f.limita-f.octeti))]})]}),e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-slate-400 rounded-full",style:{width:`${Math.min(100,f.octeti/f.limita*100)}%`}})}),e.jsx("p",{className:"text-[11px] font-bold text-slate-500 mt-2 leading-relaxed",children:"Copiile aparatului acesta: documentele deschise, aplicatia pentru offline si, daca s-a citit vreun document scanat, motorul de recunoastere a textului. Limita o pune browserul, dupa cat loc liber are aparatul — de-aia e alta pe telefon decat pe calculator, si nu are legatura cu spatiul din cloud de mai sus."})]})]})})()]}),D&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-emerald-100 text-emerald-600 rounded-3xl",children:e.jsx(Be,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Documente in Storage"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Scoate fisierele din interiorul randurilor"})]})]}),A.count===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(te,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsx("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:"Toate documentele sunt deja in Storage. Sincronizarea nu le mai transporta la fiecare rulare."})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"p-5 bg-amber-50 border border-amber-100 rounded-2xl mb-5",children:e.jsxs("p",{className:"text-sm font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:A.count===1?"Un document":`${A.count} documente`}),A.mb>=.1?` (~${A.mb.toFixed(1)} MB)`:"",A.count===1?" este":" sunt"," inca salvat",A.count===1?"":"e"," in interiorul randurilor, nu in Storage. Fiecare telefon le descarca integral la fiecare sincronizare. Mutarea lor in Storage lasa in rand doar o referinta."]})}),e.jsxs("button",{onClick:la,disabled:F,className:"w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3",children:[F?e.jsx(R,{className:"w-5 h-5 animate-spin"}):e.jsx(Oa,{className:"w-5 h-5"}),F?"Se muta...":"Muta documentele in Storage"]})]}),F&&v.total>0&&e.jsxs("div",{className:"mt-5 space-y-2",children:[e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-emerald-500 transition-all",style:{width:`${Math.round(v.done/v.total*100)}%`}})}),e.jsxs("p",{className:"text-xs font-semibold text-slate-500 truncate",children:[v.done," / ",v.total," · ",v.label]})]}),Ae&&e.jsx("p",{className:"mt-5 text-sm font-semibold text-slate-700",children:Ae})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ra,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Calitatea scanarilor"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat de mult se comprima paginile scanate"})]})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:ze.map(a=>{const s=a.id===ta;return e.jsxs("button",{onClick:()=>ia(a.id),className:`text-left p-5 rounded-2xl border-2 transition ${s?"border-blue-600 bg-blue-50":"border-slate-200 bg-white hover:border-slate-300"}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-2 mb-2",children:[e.jsx("span",{className:`text-[15px] font-bold ${s?"text-blue-700":"text-slate-900"}`,children:a.label}),s&&e.jsx(P,{className:"w-4 h-4 text-blue-600 shrink-0"})]}),e.jsx("p",{className:"text-xs font-medium text-slate-500 leading-relaxed mb-3",children:a.description}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500",children:["~",a.approxKb," KB / pagina"]})]},a.id)})}),e.jsxs("p",{className:"mt-5 text-[13px] font-medium text-slate-500 leading-relaxed",children:["Cu 1 GB de spatiu, alegerea inseamna aproximativ"," ",e.jsx("span",{className:"font-bold text-slate-700",children:ze.map(a=>`${a.label}: ${Math.round(1024*1024/a.approxKb/3).toLocaleString("ro-RO")}`).join(" · ")})," ","documente de cate 3 pagini. Setarea se aplica scanarilor viitoare; cele existente raman neschimbate."]})]}),Z&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(_e,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:"Controlul accesului in aplicatie"})]})]}),Le&&e.jsx("div",{className:"mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl",children:e.jsx("p",{className:"text-xs font-bold text-red-600",children:Le})}),e.jsxs("div",{className:"space-y-3 mb-8",children:[Se.length===0&&e.jsx("p",{className:"text-sm font-semibold text-slate-500 py-6 text-center",children:"Niciun cont inca. Utilizatorii se inregistreaza singuri din ecranul de autentificare."}),Se.map(a=>e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:`p-2.5 rounded-xl border shrink-0 self-start ${a.approved?"bg-white text-indigo-600 border-slate-200":"bg-amber-50 text-amber-700 border-amber-200"}`,children:e.jsx(_e,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-[15px] font-bold text-slate-900 truncate",children:[a.name,a.id===(p==null?void 0:p.id)&&e.jsx("span",{className:"ml-2 text-[11px] text-blue-600 font-bold",children:"(tu)"})]}),e.jsx("p",{className:"text-xs font-semibold text-slate-500 truncate",children:a.email}),!a.approved&&e.jsx("p",{className:"text-[11px] font-bold text-amber-600 mt-0.5",children:"Asteapta aprobare"})]}),e.jsx("select",{value:a.role,onChange:s=>na(a,s.target.value),disabled:a.id===(p==null?void 0:p.id),title:a.id===(p==null?void 0:p.id)?"Nu iti poti schimba propriul rol":"Schimba rolul",className:"px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none disabled:opacity-50",children:Object.keys(ke).map(s=>e.jsx("option",{value:s,children:ke[s]},s))}),e.jsx("button",{onClick:()=>ca(a),disabled:a.id===(p==null?void 0:p.id),className:`px-4 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap ${a.approved?"bg-white text-slate-500 border-2 border-slate-200 hover:text-red-600 hover:border-red-200":"bg-emerald-600 text-white hover:bg-emerald-700"}`,children:a.approved?"Suspenda":"Aproba"})]},a.id))]}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3",children:[e.jsx("p",{className:"text-[13px] font-bold text-slate-500",children:"Cum se adauga un utilizator"}),e.jsxs("p",{className:"text-sm font-medium text-slate-600 leading-relaxed",children:["Persoana isi creeaza singura cont din ecranul de autentificare, cu emailul si o parola proprie. Contul apare aici imediat, marcat ",e.jsx("span",{className:"font-bold text-amber-600",children:"Asteapta aprobare"}),", si nu vede niciun fel de date pana cand nu ii alegi un rol si apesi ",e.jsx("span",{className:"font-bold",children:"Aproba"}),"."]}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-500 leading-relaxed pt-1",children:["Roluri: ",e.jsx("span",{className:"text-slate-700",children:"Administrator"})," (tot, inclusiv stergeri) ·",e.jsx("span",{className:"text-slate-700",children:" Tehnician"})," (fara Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Contabil"})," (cu Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Vizualizare"})," (doar citire)"]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Da,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(x.length,50)," actiuni"]})]})]}),x.length===0?e.jsx("p",{className:"py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:x.slice(0,50).map(a=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${a.action==="delete"?"bg-red-50 text-red-500":a.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:a.action==="create"?"Creat":a.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500",children:a.entity==="device"?"Dispozitiv":a.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:a.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:a.userName}),e.jsx("p",{className:"shrink-0 text-[10px] font-mono font-bold text-slate-500",children:new Date(a.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},a.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(ya,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(w,{className:`w-5 h-5 ${W?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white uppercase tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:da,disabled:W,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[W?e.jsx(R,{className:"w-5 h-5 animate-spin"}):e.jsx(w,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[10px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:qe??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(Pe,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 uppercase tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:Je??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Dispozitive active in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:i.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${E!==null&&E<i.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${E!==null&&E<i.length?"text-amber-600":"text-emerald-600"}`,children:V?"...":G?"—":E??"?"}),e.jsx("button",{onClick:L,disabled:V,className:"p-1.5 text-slate-500 hover:text-blue-600 transition",title:"Verifica din nou","aria-label":"Verifica din nou",children:e.jsx(w,{className:`w-3.5 h-3.5 ${V?"animate-spin":""}`})})]})]}),G&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",G]}),E!==null&&E<i.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:i.length-E})," echipamente. Pe alt telefon vor aparea doar cele ",E," existente in cloud. Apasa mai jos pentru a urca toate dispozitivele."]}),e.jsxs("button",{onClick:aa,disabled:k,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[k?e.jsx(R,{className:"w-4 h-4 animate-spin"}):e.jsx(Ue,{className:"w-4 h-4"}),k?`Se urca ${he}...`:"Urca toate dispozitivele in cloud"]}),k&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${i.length?he/i.length*100:0}%`}})})]}),e.jsxs("button",{onClick:ea,disabled:K,className:"w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[K?e.jsx(R,{className:"w-4 h-4 animate-spin"}):e.jsx(Pe,{className:"w-4 h-4"}),K?"Se compara...":"Compara local cu cloud"]}),h&&e.jsx("div",{className:"p-4 bg-white border border-slate-200 rounded-2xl space-y-3",children:h.localOnly.length===0&&h.cloudOnly.length===0?e.jsx("p",{className:"text-[11px] font-bold text-emerald-700",children:"Identice — fiecare echipament local exista si in cloud."}):e.jsxs(e.Fragment,{children:[h.localOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1",children:["Doar pe acest dispozitiv (",h.localOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:h.localOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Urca toate dispozitivele" ca sa ajunga si in cloud.'})]}),h.cloudOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1",children:["Doar in cloud (",h.cloudOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:h.cloudOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Re-sincronizare" ca sa le aduci aici.'})]})]})}),X&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${X.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[X.ok?e.jsx(te,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(Me,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${X.ok?"text-emerald-700":"text-red-700"}`,children:X.message})]})]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-slate-200 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest",children:"Versiune aplicatie"}),e.jsx("span",{className:"text-[10px] font-mono font-bold text-slate-600",children:Ha})]}),e.jsxs("button",{onClick:oa,className:"w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-2",children:[e.jsx(w,{className:"w-3.5 h-3.5"})," Forteaza reincarcarea aplicatiei"]})]})]})]}),e.jsx(Ua,{open:Ta,tone:"neutral",title:"Deconectezi cloud-ul?",icon:e.jsx(ka,{className:"w-8 h-8 sm:w-10 sm:h-10"}),body:e.jsx(e.Fragment,{children:"Aplicatia trece in modul doar local pe acest dispozitiv. Datele salvate raman, dar nu se mai sincronizeaza pana la o reconectare."}),confirmLabel:"Deconecteaza",cancelLabel:"Ramai conectat",onCancel:()=>q(!1),onConfirm:()=>{Sa(),q(!1)}})]})};export{at as default};
