import{i as me,k as m,l as be,u as he,m as Te,n as b,o as Ne,r as ge,p as Ee,q as fe,s as je,j as e,t as Ae,R as S,v as we}from"./index-CyjvrYrA.js";import{a,m as J,k as h,d as ve,t as W,T as K,s as Le,a8 as Se,a9 as Ce,a6 as Ie,aa as ke,ab as V,ac as Oe,J as De,P as Re,u as ye,ad as Xe,o as G,A as Ue}from"./vendor-icons-CvD4Hwck.js";import"./vendor-recharts-Cf84R7xK.js";import"./vendor-db-CxvqBt6T.js";const Ye=({devices:l,onImport:C,auditLog:T=[],currentUser:n=null})=>{a.useRef(null);const[I,Fe]=a.useState(me()),[k,Q]=a.useState(I.url||""),[O,Z]=a.useState(I.key||""),[N,q]=a.useState(!1),[D,R]=a.useState(!1),[Be,Me]=a.useState(null),[r,g]=a.useState(null),[y,X]=a.useState(!1),[ee,te]=a.useState(null),[ae,U]=a.useState(null),[E,F]=a.useState(!1),[i,B]=a.useState(null),[f,j]=a.useState(null),[A,M]=a.useState(!1),[u,P]=a.useState(!1),[_,z]=a.useState(0),[c,w]=a.useState(null),o=a.useCallback(async()=>{if(!m){j("Cloud neconfigurat");return}M(!0),j(null);const{count:t,error:s}=await be("devices");s?(j(s.message||"eroare necunoscuta"),B(null)):B(t),M(!1)},[]);a.useEffect(()=>{o()},[o,l.length]);const se=a.useCallback(async()=>{if(l.length===0)return;P(!0),z(0),w(null);const{error:t,written:s}=await he("devices",l,100,d=>z(d));P(!1),w(t?{ok:!1,message:`Urcarea s-a oprit dupa ${s} echipamente: ${t.message||t}`}:{ok:!0,message:`${s} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await o()},[l,o]),le=Te(n,"manageUsers"),[ie,v]=a.useState(()=>b()),[x,H]=a.useState(""),[L,ne]=a.useState("TEHNICIAN"),[p,Y]=a.useState(""),re=a.useCallback(()=>{if(!x.trim()||p.length<4){alert("Completeaza numele si un PIN de minim 4 cifre.");return}Ne(x,L,p),v(b()),H(""),Y("")},[x,L,p]),ce=a.useCallback(t=>{if(t===(n==null?void 0:n.id)){alert("Nu iti poti sterge propriul cont.");return}window.confirm("Stergi acest utilizator?")&&(ge(t)||alert("Nu poti sterge ultimul administrator."),v(b()))},[n]),oe=a.useCallback(t=>{const s=window.prompt(`PIN nou pentru ${t.name} (minim 4 cifre):`);s&&s.length>=4&&(Ee({...t,pin:s}),v(b()))},[]),$=`-- MEDITRACK — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
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

DROP POLICY IF EXISTS "Allow all public access" ON public.devices;
DROP POLICY IF EXISTS "Allow all public access" ON public.tasks;
DROP POLICY IF EXISTS "Allow all public access" ON public.invoices;
DROP POLICY IF EXISTS "Allow all public access" ON public.audit_logs;

CREATE POLICY "Allow all public access" ON public.devices    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.tasks      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.invoices   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all public access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Reincarca schema pentru API ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
`;a.useEffect(()=>{(async()=>{const s=await we();te(s.count);try{const d=localStorage.getItem("meditrack_devices");U(d?JSON.parse(d).length:0)}catch{U(0)}})()},[l]);const de=a.useCallback(async()=>{F(!0);try{const t=localStorage.getItem("meditrack_devices");if(t){const s=JSON.parse(t);Array.isArray(s)&&s.length>0&&(await C(s),alert(`S-au recuperat cu succes ${s.length} dispozitive vechi.`))}else alert("Nu s-au gasit date vechi in LocalStorage de recuperat.")}catch(t){alert("Recuperarea a esuat: "+t.message)}finally{F(!1)}},[C]),ue=a.useCallback(()=>{navigator.clipboard.writeText($),X(!0),setTimeout(()=>X(!1),2e3)},[]),xe=a.useCallback(async()=>{R(!0),g(null);try{g(await fe())}catch(t){g({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(t==null?void 0:t.message)||String(t),hint:"Reincearca sau verifica conexiunea la internet."})}finally{R(!1)}},[]),pe=a.useCallback(()=>{window.confirm("Confirmi deconectarea? Aplicatia va trece in modul doar local.")&&je()},[]);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center justify-between mb-10",children:[e.jsxs("div",{className:"flex items-center gap-5",children:[e.jsx("div",{className:`p-5 rounded-3xl ${m?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(J,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:xe,disabled:D||!m,className:"p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[D?e.jsx(h,{className:"w-5 h-5 animate-spin"}):e.jsx(ve,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest hidden sm:inline",children:"Verifica conexiunea"})]})]}),r&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${r.ok?"bg-green-50 border-green-200 text-green-700":r.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[r.ok?e.jsx(W,{className:"w-6 h-6 shrink-0"}):e.jsx(K,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-widest",children:r.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:r.detail}),r.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:r.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:k,onChange:t=>Q(t.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:N?"text":"password",value:O,onChange:t=>Z(t.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>q(!N),className:"absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest",children:N?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>Ae(k,O),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),m&&e.jsx("button",{onClick:pe,className:"px-8 py-5 bg-red-50 text-red-600 rounded-[1.5rem] font-black transition hover:bg-red-100",title:"Deconecteaza Cloud",children:e.jsx(Le,{className:"w-6 h-6"})})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(Se,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx(Ce,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-widest",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed",children:$}),e.jsxs("button",{onClick:ue,className:"absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",children:[y?e.jsx(Ie,{className:"w-4 h-4"}):e.jsx(ke,{className:"w-4 h-4"}),y?"Copiat":"Copiaza SQL"]})]})]})]}),le&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(V,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:"Controlul accesului in aplicatie"})]})]}),e.jsx("div",{className:"space-y-3 mb-8",children:ie.map(t=>e.jsxs("div",{className:"flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:"p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200",children:e.jsx(V,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-sm font-black text-slate-900 truncate",children:[t.name," ",t.id===(n==null?void 0:n.id)&&e.jsx("span",{className:"text-[9px] text-blue-600 font-black uppercase",children:"(tu)"})]}),e.jsx("p",{className:"text-[10px] font-bold text-slate-400 uppercase tracking-widest",children:S[t.role]})]}),e.jsx("button",{onClick:()=>oe(t),className:"p-2.5 bg-white text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 transition",title:"Schimba PIN",children:e.jsx(Oe,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>ce(t.id),className:"p-2.5 bg-white text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 transition",title:"Sterge utilizator",children:e.jsx(De,{className:"w-4 h-4"})})]},t.id))}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4",children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Adauga utilizator nou"}),e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[e.jsx("input",{value:x,onChange:t=>H(t.target.value),placeholder:"Nume complet",className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"}),e.jsx("select",{value:L,onChange:t=>ne(t.target.value),className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none",children:Object.keys(S).map(t=>e.jsx("option",{value:t,children:S[t]},t))}),e.jsx("input",{value:p,onChange:t=>Y(t.target.value.replace(/\D/g,"")),placeholder:"PIN (min. 4 cifre)",inputMode:"numeric",maxLength:6,className:"px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:ring-4 focus:ring-indigo-500/10"})]}),e.jsxs("button",{onClick:re,className:"w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2",children:[e.jsx(Re,{className:"w-4 h-4"})," Creeaza cont"]}),e.jsx("p",{className:"text-[9px] text-slate-400 font-bold uppercase tracking-widest",children:"Roluri: Administrator (tot) · Tehnician (fara Financiar) · Contabil (cu Financiar, fara stergere) · Vizualizare (doar citire)"})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(ye,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-400 font-bold uppercase tracking-widest mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(T.length,50)," actiuni"]})]})]}),T.length===0?e.jsx("p",{className:"py-10 text-center text-xs font-bold text-slate-300 uppercase tracking-widest",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:T.slice(0,50).map(t=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.action==="delete"?"bg-red-50 text-red-500":t.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:t.action==="create"?"Creat":t.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400",children:t.entity==="device"?"Dispozitiv":t.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:t.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:t.userName}),e.jsx("p",{className:"shrink-0 text-[9px] font-mono font-bold text-slate-400",children:new Date(t.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},t.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(Xe,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(h,{className:`w-5 h-5 ${E?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white uppercase tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:de,disabled:E,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[E?e.jsx(G,{className:"w-5 h-5 animate-spin"}):e.jsx(h,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[9px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:ae??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(Ue,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 uppercase tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:ee??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Flota activa in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:l.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${i!==null&&i<l.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-400 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${i!==null&&i<l.length?"text-amber-600":"text-emerald-600"}`,children:A?"...":f?"—":i??"?"}),e.jsx("button",{onClick:o,disabled:A,className:"p-1.5 text-slate-400 hover:text-blue-600 transition",title:"Verifica din nou",children:e.jsx(h,{className:`w-3.5 h-3.5 ${A?"animate-spin":""}`})})]})]}),f&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",f]}),i!==null&&i<l.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:l.length-i})," echipamente. Pe alt telefon vor aparea doar cele ",i," existente in cloud. Apasa mai jos pentru a urca toata flota."]}),e.jsxs("button",{onClick:se,disabled:u,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[u?e.jsx(G,{className:"w-4 h-4 animate-spin"}):e.jsx(J,{className:"w-4 h-4"}),u?`Se urca ${_}/${l.length}...`:"Urca toata flota in cloud"]}),u&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${l.length?_/l.length*100:0}%`}})})]}),c&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${c.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[c.ok?e.jsx(W,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(K,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${c.ok?"text-emerald-700":"text-red-700"}`,children:c.message})]})]})]}),e.jsx("p",{className:"text-[9px] text-slate-400 mt-6 font-bold uppercase tracking-widest text-center",children:"Compara ce ai local cu ce exista in cloud"})]})]})]})};export{Ye as default};
