import{i as Ce,k as w,l as Ie,m as se,n as ke,u as Oe,o as ye,p as A,q as Re,r as De,s as Xe,t as Ue,v as Fe,j as e,w as Be,R as F,x as Me}from"./index-CS8CjBpg.js";import{a as t,m as le,k as g,d as Pe,u as ie,T as ne,t as ze,ad as _e,ae as $e,ab as He,af as Ye,ag as ce,ah as We,V as Je,P as Ke,v as Ve,ai as Ge,o as B,A as re}from"./vendor-icons-CPkAJPZK.js";import"./vendor-recharts-B6e7uH-1.js";import"./vendor-db-CxvqBt6T.js";const Qe="2026-08-02 11:45",ia=({devices:i,onImport:M,auditLog:v=[],currentUser:o=null})=>{t.useRef(null);const[P,Ze]=t.useState(Ce()),[z,oe]=t.useState(P.url||""),[_,de]=t.useState(P.key||""),[S,ue]=t.useState(!1),[$,H]=t.useState(!1),[qe,ea]=t.useState(null),[d,L]=t.useState(null),[Y,W]=t.useState(!1),[pe,xe]=t.useState(null),[me,J]=t.useState(null),[C,K]=t.useState(!1),[c,V]=t.useState(null),[I,k]=t.useState(null),[O,G]=t.useState(!1),[T,N]=t.useState(!1),[Q,Z]=t.useState(0),[h,u]=t.useState(null),m=t.useCallback(async()=>{if(!w){k("Cloud neconfigurat");return}G(!0),k(null);const{count:a,error:s}=await Ie("devices");s?(k(s.message||"eroare necunoscuta"),V(null)):V(a),G(!1)},[]);t.useEffect(()=>{m()},[m,i.length]);const[r,q]=t.useState(null),[y,R]=t.useState(!1),be=t.useCallback(async()=>{R(!0),q(null);const{data:a,error:s}=await se("devices");if(s||!a){u({ok:!1,message:`Nu s-a putut citi lista din cloud: ${(s==null?void 0:s.message)||"eroare"}`}),R(!1);return}const n=new Set(a.map(l=>String(l.id).trim())),b=new Set(i.map(l=>String(l.id).trim())),p=l=>{var x,j;return((x=i.find(U=>U.id===l))==null?void 0:x.name)||((j=a.find(U=>String(U.id).trim()===l))==null?void 0:j.name)||l};q({localOnly:[...b].filter(l=>!n.has(l)).map(l=>`${p(l)} (${l})`),cloudOnly:[...n].filter(l=>!b.has(l)).map(l=>`${p(l)} (${l})`)}),R(!1)},[i]),he=t.useCallback(async()=>{if(i.length===0)return;N(!0),Z(0),u(null);const{data:a,error:s}=await se("devices");if(s){N(!1),u({ok:!1,message:`Nu s-a putut citi cloud-ul inainte de urcare: ${s.message||s}`});return}const n=ke(i,a||[]);if(n.length===0){N(!1),u({ok:!0,message:"Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat."}),await m();return}const{error:b,written:p,skippedColumns:l,oversized:x}=await Oe("devices",n,100,j=>Z(j));N(!1),b?u({ok:!1,message:`Urcarea s-a oprit dupa ${p} echipamente: ${b.message||b}`}):x.length>0?u({ok:!1,message:`${p} echipamente urcate, dar ${x.length} nu au incaput (documente atasate prea mari): ${x.slice(0,3).join(", ")}${x.length>3?"...":""}`}):l.length>0?u({ok:!0,message:`${p} echipamente au fost urcate. Atentie: campurile ${l.join(", ")} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.`}):u({ok:!0,message:`${p} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await m()},[i,m]),ge=ye(o,"manageUsers"),[Te,D]=t.useState(()=>A()),[E,ee]=t.useState(""),[X,Ne]=t.useState("TEHNICIAN"),[f,ae]=t.useState(""),Ee=t.useCallback(()=>{if(!E.trim()||f.length<4){alert("Completeaza numele si un PIN de minim 4 cifre.");return}Re(E,X,f),D(A()),ee(""),ae("")},[E,X,f]),fe=t.useCallback(a=>{if(a===(o==null?void 0:o.id)){alert("Nu iti poti sterge propriul cont.");return}window.confirm("Stergi acest utilizator?")&&(De(a)||alert("Nu poti sterge ultimul administrator."),D(A()))},[o]),je=t.useCallback(async()=>{try{if("caches"in window){const s=await caches.keys();await Promise.all(s.map(n=>caches.delete(n)))}if("serviceWorker"in navigator){const s=await navigator.serviceWorker.getRegistrations();await Promise.all(s.map(n=>n.unregister()))}}catch{}const a=new URL(window.location.href);a.searchParams.set("v",Date.now().toString()),window.location.replace(a.toString())},[]),we=t.useCallback(a=>{const s=window.prompt(`PIN nou pentru ${a.name} (minim 4 cifre):`);s&&s.length>=4&&(Xe({...a,pin:s}),D(A()))},[]),te=`-- MEDITRACK — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
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
    status TEXT DEFAULT 'Unpaid',
    "contractNumber" TEXT,
    "deviceIds" JSONB DEFAULT '[]'::jsonb,
    description TEXT,
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
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public access" ON public.devices;
DROP POLICY IF EXISTS "Allow all public access" ON public.tasks;
DROP POLICY IF EXISTS "Allow all public access" ON public.invoices;
DROP POLICY IF EXISTS "Allow all public access" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow all public access" ON public.deletions;

CREATE POLICY "Allow all public access" ON public.devices    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.tasks      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.invoices   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.deletions  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
`;t.useEffect(()=>{(async()=>{const s=await Me();xe(s.count);try{const n=localStorage.getItem("meditrack_devices");J(n?JSON.parse(n).length:0)}catch{J(0)}})()},[i]);const Ae=t.useCallback(async()=>{K(!0);try{const a=localStorage.getItem("meditrack_devices");if(a){const s=JSON.parse(a);Array.isArray(s)&&s.length>0&&(await M(s),alert(`S-au recuperat cu succes ${s.length} dispozitive vechi.`))}else alert("Nu s-au gasit date vechi in LocalStorage de recuperat.")}catch(a){alert("Recuperarea a esuat: "+a.message)}finally{K(!1)}},[M]),ve=t.useCallback(()=>{navigator.clipboard.writeText(te),W(!0),setTimeout(()=>W(!1),2e3)},[]),Se=t.useCallback(async()=>{H(!0),L(null);try{L(await Ue())}catch(a){L({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(a==null?void 0:a.message)||String(a),hint:"Reincearca sau verifica conexiunea la internet."})}finally{H(!1)}},[]),Le=t.useCallback(()=>{window.confirm("Confirmi deconectarea? Aplicatia va trece in modul doar local.")&&Fe()},[]);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center justify-between mb-10",children:[e.jsxs("div",{className:"flex items-center gap-5",children:[e.jsx("div",{className:`p-5 rounded-3xl ${w?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(le,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:Se,disabled:$||!w,className:"p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[$?e.jsx(g,{className:"w-5 h-5 animate-spin"}):e.jsx(Pe,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest hidden sm:inline",children:"Verifica conexiunea"})]})]}),d&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${d.ok?"bg-green-50 border-green-200 text-green-700":d.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[d.ok?e.jsx(ie,{className:"w-6 h-6 shrink-0"}):e.jsx(ne,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-widest",children:d.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:d.detail}),d.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:d.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:z,onChange:a=>oe(a.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:S?"text":"password",value:_,onChange:a=>de(a.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>ue(!S),className:"absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest",children:S?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>Be(z,_),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),w&&e.jsx("button",{onClick:Le,className:"px-8 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black transition hover:bg-red-100",title:"Deconecteaza Cloud",children:e.jsx(ze,{className:"w-6 h-6"})})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(_e,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx($e,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-widest",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed",children:te}),e.jsxs("button",{onClick:ve,className:"absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",children:[Y?e.jsx(He,{className:"w-4 h-4"}):e.jsx(Ye,{className:"w-4 h-4"}),Y?"Copiat":"Copiaza SQL"]})]})]})]}),ge&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(ce,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:"Controlul accesului in aplicatie"})]})]}),e.jsx("div",{className:"space-y-3 mb-8",children:Te.map(a=>e.jsxs("div",{className:"flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:"p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200",children:e.jsx(ce,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-sm font-black text-slate-900 truncate",children:[a.name," ",a.id===(o==null?void 0:o.id)&&e.jsx("span",{className:"text-[9px] text-blue-600 font-black uppercase",children:"(tu)"})]}),e.jsx("p",{className:"text-[10px] font-bold text-slate-400 uppercase tracking-widest",children:F[a.role]})]}),e.jsx("button",{onClick:()=>we(a),className:"p-2.5 bg-white text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 transition",title:"Schimba PIN",children:e.jsx(We,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>fe(a.id),className:"p-2.5 bg-white text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 transition",title:"Sterge utilizator",children:e.jsx(Je,{className:"w-4 h-4"})})]},a.id))}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4",children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Adauga utilizator nou"}),e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[e.jsx("input",{value:E,onChange:a=>ee(a.target.value),placeholder:"Nume complet",className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"}),e.jsx("select",{value:X,onChange:a=>Ne(a.target.value),className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none",children:Object.keys(F).map(a=>e.jsx("option",{value:a,children:F[a]},a))}),e.jsx("input",{value:f,onChange:a=>ae(a.target.value.replace(/\D/g,"")),placeholder:"PIN (min. 4 cifre)",inputMode:"numeric",maxLength:6,className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-4 focus:ring-indigo-500/10"})]}),e.jsxs("button",{onClick:Ee,className:"w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2",children:[e.jsx(Ke,{className:"w-4 h-4"})," Creeaza cont"]}),e.jsx("p",{className:"text-[9px] text-slate-400 font-bold uppercase tracking-widest",children:"Roluri: Administrator (tot) · Tehnician (fara Financiar) · Contabil (cu Financiar, fara stergere) · Vizualizare (doar citire)"})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ve,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(v.length,50)," actiuni"]})]})]}),v.length===0?e.jsx("p",{className:"py-10 text-center text-xs font-bold text-slate-300 uppercase tracking-widest",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:v.slice(0,50).map(a=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${a.action==="delete"?"bg-red-50 text-red-500":a.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:a.action==="create"?"Creat":a.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400",children:a.entity==="device"?"Dispozitiv":a.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:a.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:a.userName}),e.jsx("p",{className:"shrink-0 text-[9px] font-mono font-bold text-slate-400",children:new Date(a.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},a.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(Ge,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(g,{className:`w-5 h-5 ${C?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white uppercase tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:Ae,disabled:C,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[C?e.jsx(B,{className:"w-5 h-5 animate-spin"}):e.jsx(g,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[9px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:me??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(re,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 uppercase tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:pe??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Flota activa in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:i.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${c!==null&&c<i.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${c!==null&&c<i.length?"text-amber-600":"text-emerald-600"}`,children:O?"...":I?"—":c??"?"}),e.jsx("button",{onClick:m,disabled:O,className:"p-1.5 text-slate-400 hover:text-blue-600 transition",title:"Verifica din nou",children:e.jsx(g,{className:`w-3.5 h-3.5 ${O?"animate-spin":""}`})})]})]}),I&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",I]}),c!==null&&c<i.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:i.length-c})," echipamente. Pe alt telefon vor aparea doar cele ",c," existente in cloud. Apasa mai jos pentru a urca toata flota."]}),e.jsxs("button",{onClick:he,disabled:T,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[T?e.jsx(B,{className:"w-4 h-4 animate-spin"}):e.jsx(le,{className:"w-4 h-4"}),T?`Se urca ${Q}...`:"Urca toata flota in cloud"]}),T&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${i.length?Q/i.length*100:0}%`}})})]}),e.jsxs("button",{onClick:be,disabled:y,className:"w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[y?e.jsx(B,{className:"w-4 h-4 animate-spin"}):e.jsx(re,{className:"w-4 h-4"}),y?"Se compara...":"Compara local cu cloud"]}),r&&e.jsx("div",{className:"p-4 bg-white border border-slate-200 rounded-2xl space-y-3",children:r.localOnly.length===0&&r.cloudOnly.length===0?e.jsx("p",{className:"text-[11px] font-bold text-emerald-700",children:"Identice — fiecare echipament local exista si in cloud."}):e.jsxs(e.Fragment,{children:[r.localOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1",children:["Doar pe acest dispozitiv (",r.localOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:r.localOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[9px] text-slate-400 font-bold mt-1",children:'Apasa "Urca toata flota" ca sa ajunga si in cloud.'})]}),r.cloudOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1",children:["Doar in cloud (",r.cloudOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:r.cloudOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[9px] text-slate-400 font-bold mt-1",children:'Apasa "Re-sincronizare" ca sa le aduci aici.'})]})]})}),h&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${h.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[h.ok?e.jsx(ie,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(ne,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${h.ok?"text-emerald-700":"text-red-700"}`,children:h.message})]})]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-slate-200 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[9px] font-black text-slate-400 uppercase tracking-widest",children:"Versiune aplicatie"}),e.jsx("span",{className:"text-[10px] font-mono font-bold text-slate-600",children:Qe})]}),e.jsxs("button",{onClick:je,className:"w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-2",children:[e.jsx(g,{className:"w-3.5 h-3.5"})," Forteaza reincarcarea aplicatiei"]})]})]})]})]})};export{ia as default};
