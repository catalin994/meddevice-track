import{j as e,t as Xa,v as ae,w as Oa,x as Je,y as Da,z as ya,A as Ra,B as ka,C as We,s as Te,S as He,E as Ua,F as Ma,G as Fa,Z as he,N as Ba,I as Ve,J as za,K as Pa}from"./index-xtzjw6iE.js";import{a as t,ak as _a,F as se,I as fe,aj as Ge,al as Ee,d as _,o as Ke,m as M,v as Ze,z as Qe,b as $a,T as Ya,w as Ja,C as te,e as Ne,a0 as Wa,am as qe,a3 as Ha,a1 as Va,a7 as Ga,an as ea,J as Ka,ao as Za,B as aa,p as Qa}from"./vendor-icons-GVqSwoQY.js";import{C as ia}from"./ConfirmDialog-CO0U3cus.js";import{i as qa,l as et,s as at,a as tt,b as st,m as P,N as lt,L as it,p as rt}from"./spatiu-BevheGUt.js";import{g as nt,a as ct,s as ot,S as ta,b as dt}from"./scanQuality-Fm2hIQei.js";import"./vendor-recharts-BxiADjAJ.js";import"./vendor-db-CxvqBt6T.js";const mt=new Set(["sectia","sectie","sec","compartimentul","compartiment","comp","serviciul","serviciu","serv","unitatea","unitate","clinica","clinic","laborator","laboratorul","laboratoare","lab","de","si","a","al","ale","cu","din","pentru","la"]),ut={cab:"cabinet",cabinetul:"cabinet",cabinete:"cabinet",ati:"anestezie terapie intensiva",ti:"terapie intensiva",upu:"unitate primiri urgente",cpu:"camera primiri urgente",uts:"unitate transfuzie sanguina",ctt:"centru transfuzie",bo:"bloc operator",blocop:"bloc operator",orl:"otorinolaringologie",bfk:"balneofizioterapie",rmf:"recuperare medicina fizica"},pt=i=>String(i??"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[șşŞȘ]/g,"s").replace(/[țţŢȚ]/g,"t").replace(/[ăâĂÂ]/g,"a").replace(/[îÎ]/g,"i").toLowerCase(),ge=i=>{const x=pt(i).replace(/[^a-z0-9]+/g," ").trim().replace(/\b(?:[a-z] ){1,}[a-z]\b/g,u=>u.replace(/ /g,""));if(!x)return"";const E=x.split(/\s+/).map(u=>ut[u]||u).join(" ").split(/\s+/).filter(u=>u&&!mt.has(u));return E.length===0?x:[...new Set(E)].sort().join(" ")},ra=(i,x=[])=>{const E=new Map,u=(d,N)=>{const c=String(d??"").trim();if(!c)return;const o=E.get(c)||{aparate:0,tichete:0};o[N]++,E.set(c,o)};i.forEach(d=>u(d.department,"aparate")),x.forEach(d=>u(d.department,"tichete"));const g=new Map;for(const[d,N]of E){const c=ge(d);if(!c)continue;const o=g.get(c)||{cheie:c,feluri:[],propus:d,total:0};o.feluri.push({nume:d,aparate:N.aparate,tichete:N.tichete}),o.total+=N.aparate+N.tichete,g.set(c,o)}return[...g.values()].filter(d=>d.feluri.length>1).map(d=>{var v;d.feluri.sort((m,j)=>j.aparate+j.tichete-(m.aparate+m.tichete)||m.nume.localeCompare(j.nume,"ro"));const N=m=>/\b[a-zA-ZăâîșțĂÂÎȘȚ]{1,4}\./.test(m),c=d.feluri.filter(m=>!N(m.nume)),o=c.length?c:d.feluri,S=o[0].aparate+o[0].tichete,y=o.filter(m=>m.aparate+m.tichete===S);return d.propus=((v=y.find(m=>/[ăâîșțĂÂÎȘȚşţŞŢ]/.test(m.nume)))==null?void 0:v.nume)||y[0].nume,d}).sort((d,N)=>N.total-d.total)},sa=({devices:i,tasks:x,onUneste:E,canEdit:u})=>{const g=t.useMemo(()=>ra(i,x),[i,x]),[d,N]=t.useState({}),[c,o]=t.useState(null),[S,y]=t.useState(!1),v=t.useMemo(()=>{const n=new Set;return i.forEach(b=>{var h;(h=b.department)!=null&&h.trim()&&n.add(b.department.trim())}),x.forEach(b=>{var h;(h=b.department)!=null&&h.trim()&&n.add(b.department.trim())}),[...n].sort((b,h)=>b.localeCompare(h,"ro"))},[i,x]),[m,j]=t.useState(""),[A,J]=t.useState(""),W=n=>i.filter(b=>{var h;return((h=b.department)==null?void 0:h.trim())===n}).length+x.filter(b=>{var h;return((h=b.department)==null?void 0:h.trim())===n}).length,H=async()=>{if(c){y(!0);try{await E(c.dela,c.la)}finally{y(!1),o(null)}}};return e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 mb-6",children:[e.jsx("div",{className:"p-3 sm:p-5 bg-indigo-100 text-indigo-600 rounded-2xl sm:rounded-3xl shrink-0",children:e.jsx(_a,{className:"w-7 h-7 sm:w-10 sm:h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Sectii care se repeta"}),e.jsx("p",{className:"text-[12px] sm:text-sm text-slate-500 font-semibold mt-1",children:"Aceeasi sectie scrisa in mai multe feluri, adusa la una singura"})]})]}),g.length===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:["Nicio sectie nu se repeta. ",v.length," sectii, fiecare cu un singur nume."]})]}):e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-4 h-4 text-amber-600 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-[13px] font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:g.length})," ",g.length===1?"sectie apare":"sectii apar",' sub mai multe nume. Alege forma care ramane si apasa "Uneste" — aparatele si tichetele se muta pe ea. Verifica-le pe fiecare: "Chirurgie 1" si "Chirurgie 2" seamana, dar sunt doua sectii.']})]}),g.map(n=>{const b=d[n.cheie]||n.propus,h=n.feluri.filter(f=>f.nume!==b),C=h.reduce((f,w)=>f+w.aparate+w.tichete,0);return e.jsxs("div",{className:"p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3",children:[e.jsx("div",{className:"flex flex-wrap gap-2",children:n.feluri.map(f=>{const w=f.nume===b;return e.jsxs("button",{onClick:()=>N(V=>({...V,[n.cheie]:f.nume})),disabled:!u,title:w?"Numele care ramane":"Apasa ca sa pastrezi acest nume",className:`px-3.5 py-2.5 rounded-xl text-[12px] font-bold transition border-2 text-left disabled:cursor-not-allowed ${w?"bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20":"bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`,children:[e.jsx("span",{className:"block",children:f.nume}),e.jsxs("span",{className:`block text-[10px] font-black uppercase tracking-wide mt-0.5 ${w?"text-white/70":"text-slate-400"}`,children:[f.aparate," aparate",f.tichete?` · ${f.tichete} tichete`:""]})]},f.nume)})}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("p",{className:"text-[12px] font-bold text-slate-500 flex items-center gap-2 min-w-0",children:[e.jsx(Ge,{className:"w-4 h-4 shrink-0 text-slate-400"}),e.jsxs("span",{className:"truncate",children:[C," ",C===1?"inregistrare se muta":"inregistrari se muta"," pe",e.jsxs("span",{className:"text-slate-900 font-black",children:[" ",b]})]})]}),e.jsxs("button",{onClick:()=>o({cheie:n.cheie,dela:h.map(f=>f.nume),la:b,cate:C}),disabled:!u||C===0,className:"px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0",children:[e.jsx(Ee,{className:"w-4 h-4"})," Uneste"]})]})]},n.cheie)})]}),e.jsxs("div",{className:"mt-6 pt-6 border-t border-slate-100",children:[e.jsx("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-wide mb-3",children:"Uneste doua sectii care nu seamana la nume"}),e.jsx("p",{className:"text-[12px] font-semibold text-slate-500 mb-3 leading-relaxed",children:'Pentru cazurile pe care aplicatia n-are cum sa le ghiceasca — "UTS Judetean" si "Unitate de transfuzie", de pilda, cand numele vine din registrul contabil.'}),e.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-end gap-3",children:[e.jsxs("label",{className:"flex-1 min-w-0 space-y-1.5",children:[e.jsx("span",{className:"text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1",children:"Se muta de la"}),e.jsxs("select",{value:m,onChange:n=>j(n.target.value),disabled:!u,className:"w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500",children:[e.jsx("option",{value:"",children:"— alege sectia —"}),v.map(n=>e.jsxs("option",{value:n,children:[n," (",W(n),")"]},n))]})]}),e.jsx(Ge,{className:"w-5 h-5 text-slate-300 shrink-0 hidden sm:block mb-3.5"}),e.jsxs("label",{className:"flex-1 min-w-0 space-y-1.5",children:[e.jsx("span",{className:"text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1",children:"Ramane"}),e.jsxs("select",{value:A,onChange:n=>J(n.target.value),disabled:!u,className:"w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500",children:[e.jsx("option",{value:"",children:"— alege sectia —"}),v.map(n=>e.jsxs("option",{value:n,children:[n," (",W(n),")"]},n))]})]}),e.jsxs("button",{onClick:()=>o({cheie:"manual",dela:[m],la:A,cate:W(m)}),disabled:!u||!m||!A||m===A,className:"px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0",children:[e.jsx(Ee,{className:"w-4 h-4"})," Uneste"]})]}),m&&A&&m!==A&&ge(m)!==ge(A)&&e.jsx("p",{className:"text-[12px] font-bold text-amber-700 mt-3 leading-relaxed",children:"Numele astea doua nu seamana deloc. Sigur e aceeasi sectie?"})]}),e.jsx(ia,{open:!!c,tone:"neutral",title:"Unesti sectiile?",icon:S?e.jsx(_,{className:"w-8 h-8 animate-spin"}):e.jsx(Ee,{className:"w-8 h-8"}),body:e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"font-black text-slate-900",children:c==null?void 0:c.cate})," ",(c==null?void 0:c.cate)===1?"inregistrare se muta":"inregistrari se muta"," de pe"," ",c==null?void 0:c.dela.map(n=>e.jsxs("span",{className:"font-black text-slate-900",children:['"',n,'" ']},n)),"pe ",e.jsxs("span",{className:"font-black text-slate-900",children:['"',c==null?void 0:c.la,'"']}),". Aparatele raman aceleasi, li se schimba doar sectia — si se poate face la loc de aici, unind inapoi."]}),confirmLabel:S?"Se muta...":"Uneste",cancelLabel:"Renunt",onCancel:()=>o(null),onConfirm:H})]})},la=`-- BIOMEDIC — REFERATE, DOCUMENTE DE FUNDAMENTARE SI COMENZI
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
`,xt="2026-09-04 20:36",bt=i=>{if(i===1)return"zi";const x=i%100;return x===0||x>=20?"de zile":"zile"},vt=({devices:i,invoices:x=[],tasks:E=[],referate:u=[],foundationDocs:g=[],comenzi:d=[],onImport:N,auditLog:c=[],currentUser:o=null,onMigrateFiles:S,deletions:y=[],onRestore:v,canDelete:m=!1,onUnesteSectii:j,canEdit:A=!1})=>{t.useRef(null);const[J,W]=t.useState(Xa()),[H,n]=t.useState(J.url||""),[b,h]=t.useState(J.key||""),[C,f]=t.useState(!1),[w,V]=t.useState(!1),[Tt,ht]=t.useState(null),[X,le]=t.useState(null),[je,Ae]=t.useState(!1),[na,ca]=t.useState(null),[ie,oa]=t.useState(null),[O,da]=t.useState(null),[Se,ve]=t.useState(!1),[R,we]=t.useState(()=>qa());t.useEffect(()=>{et().then(we)},[]);const G=t.useMemo(()=>at(i,x,u,g,d),[i,x,u,g,d]),re=t.useCallback(async()=>{ve(!0);const[a,s]=await Promise.all([tt(),st()]);oa(a),da(s),ve(!1)},[]);t.useEffect(()=>{re()},[re]);const[ma,Le]=t.useState(null),[ne,Ie]=t.useState(!1),[L,Ce]=t.useState(null),[ce,oe]=t.useState(null),[de,Xe]=t.useState(!1),[K,Z]=t.useState(!1),[Oe,De]=t.useState(0),[$,D]=t.useState(null),F=t.useCallback(async()=>{if(!ae){oe("Cloud neconfigurat");return}Xe(!0),oe(null);const{count:a,error:s}=await Oa("devices");s?(oe(s.message||"eroare necunoscuta"),Ce(null)):Ce(a),Xe(!1)},[]);t.useEffect(()=>{F()},[F,i.length]);const[I,ye]=t.useState(null),[me,ue]=t.useState(!1),ua=t.useCallback(async()=>{ue(!0),ye(null);const{data:a,error:s}=await Je("devices");if(s||!a){D({ok:!1,message:`Nu s-a putut citi lista din cloud: ${(s==null?void 0:s.message)||"eroare"}`}),ue(!1);return}const l=new Set(a.map(p=>String(p.id).trim())),r=new Set(i.map(p=>String(p.id).trim())),T=p=>{var U,ee;return((U=i.find(be=>be.id===p))==null?void 0:U.name)||((ee=a.find(be=>String(be.id).trim()===p))==null?void 0:ee.name)||p};ye({localOnly:[...r].filter(p=>!l.has(p)).map(p=>`${T(p)} (${p})`),cloudOnly:[...l].filter(p=>!r.has(p)).map(p=>`${T(p)} (${p})`)}),ue(!1)},[i]),pa=t.useCallback(async()=>{if(i.length===0)return;Z(!0),De(0),D(null);const{data:a,error:s}=await Je("devices");if(s){Z(!1),D({ok:!1,message:`Nu s-a putut citi cloud-ul inainte de urcare: ${s.message||s}`});return}const l=Da(i,a||[]);if(l.length===0){Z(!1),D({ok:!0,message:"Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat."}),await F();return}const{error:r,written:T,skippedColumns:p,oversized:U}=await ya("devices",l,100,ee=>De(ee));Z(!1),r?D({ok:!1,message:`Urcarea s-a oprit dupa ${T} echipamente: ${r.message||r}`}):U.length>0?D({ok:!1,message:`${T} echipamente urcate, dar ${U.length} nu au incaput (documente atasate prea mari): ${U.slice(0,3).join(", ")}${U.length>3?"...":""}`}):p.length>0?D({ok:!0,message:`${T} echipamente au fost urcate. Atentie: campurile ${p.join(", ")} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.`}):D({ok:!0,message:`${T} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await F()},[i,F]),k=t.useMemo(()=>{let a=0,s=0;const l=r=>{r!=null&&r.startsWith("data:")&&(a++,s+=Math.round(r.length*.75))};return i.forEach(r=>{(r.files||[]).forEach(T=>{T.path||l(T.url)}),(r.contracts||[]).forEach(T=>{T.filePath||l(T.fileUrl)})}),E.forEach(r=>(r.attachments||[]).forEach(T=>{T.path||l(T.url)})),[...x,...u,...g,...d].forEach(r=>{r.filePath||l(r.fileUrl)}),{count:a,mb:s/(1024*1024)}},[i,E,x,u,g,d]),[xa,ba]=t.useState(()=>nt().id),[Ta,ha]=t.useState(()=>ct()),Ea=t.useCallback(a=>{ot(a),ba(a)},[]),[Q,Re]=t.useState(!1),[B,ke]=t.useState({done:0,total:0,label:""}),[Ue,Y]=t.useState(null),Na=t.useCallback(async()=>{if(S){Re(!0),Y(null),ke({done:0,total:0,label:""});try{const a=await S((s,l,r)=>ke({done:s,total:l,label:r}));a.error?Y(`S-au mutat ${a.moved} din ${a.total}, apoi a aparut o eroare: ${a.error}`):a.total===0?Y("Nu mai exista documente de mutat — totul e deja in Storage."):Y(`Gata: ${a.moved} documente mutate in Storage.`)}catch(a){Y(`Mutarea a esuat: ${(a==null?void 0:a.message)||a}`)}finally{Re(!1)}}},[S]),pe=Ra(o,"manageUsers"),[Me,fa]=t.useState([]),[Fe,q]=t.useState(""),z=t.useCallback(async()=>{const a=await ka();fa(a)},[]);t.useEffect(()=>{pe&&z()},[pe,z]);const ga=t.useCallback(async(a,s)=>{q("");const{error:l}=await We(a.id,{role:s,approved:!0});l?q(l):z()},[z]),ja=t.useCallback(async a=>{q("");const{error:s}=await We(a.id,{approved:!a.approved});s?q(s):z()},[z]),Aa=t.useCallback(async()=>{try{if("caches"in window){const s=await caches.keys();await Promise.all(s.map(l=>caches.delete(l)))}if("serviceWorker"in navigator){const s=await navigator.serviceWorker.getRegistrations();await Promise.all(s.map(l=>l.unregister()))}}catch{}const a=new URL(window.location.href);a.searchParams.set("v",Date.now().toString()),window.location.replace(a.toString())},[]),Be=`-- BIOMEDIC — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
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
    "inventoryNumber" TEXT,
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

-- Cosul de stergeri: randul sters se pastreaza intreg, ca sa poata fi pus la
-- loc. "restoredAt" anuleaza piatra de mormant fara s-o stearga — stearsa, un
-- alt telefon care inca o are ar urca-o inapoi si ar sterge din nou.
ALTER TABLE public.deletions
  ADD COLUMN IF NOT EXISTS "entityName" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "payload"    JSONB,
  ADD COLUMN IF NOT EXISTS "restoredAt" TEXT;

-- Setarile care trebuie sa fie la fel pe toate aparatele. Tinute in
-- localStorage, ramaneau pe aparatul de la care fusesera scrise: limita
-- abonamentului trecuta pe calculator arata tot 1 GB pe telefon.
CREATE TABLE IF NOT EXISTS public.setari (
    cheie TEXT PRIMARY KEY,
    valoare JSONB,
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
-- Numarul de inventar din registrul de mijloace fixe: cheia dupa care se leaga
-- Anexa 6, evidenta contabila si listele de casare. Il are fiecare aparat si e
-- unic, spre deosebire de serie, care lipseste de pe aproape o treime din ele.
ALTER TABLE public.devices  ADD COLUMN IF NOT EXISTS "inventoryNumber" TEXT;
CREATE INDEX IF NOT EXISTS devices_inventar_idx ON public.devices ("inventoryNumber");
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
`;t.useEffect(()=>{(async()=>{const s=await Pa();ca(s.count);try{const l=localStorage.getItem("meditrack_devices");Le(l?JSON.parse(l).length:0)}catch{Le(0)}})()},[i]);const Sa=t.useCallback(async()=>{Ie(!0);try{const a=localStorage.getItem("meditrack_devices");if(a){const s=JSON.parse(a);Array.isArray(s)&&s.length>0&&(await N(s),Te(`S-au recuperat ${s.length} dispozitive din datele vechi.`,"success"))}else Te("Nu s-au gasit date vechi de recuperat.","info")}catch(a){Te("Recuperarea a esuat: "+a.message,"error")}finally{Ie(!1)}},[N]),[ze,Pe]=t.useState(!1),va=t.useCallback(()=>{navigator.clipboard.writeText(He),Pe(!0),setTimeout(()=>Pe(!1),2e3)},[]),[_e,$e]=t.useState(!1),wa=t.useCallback(()=>{navigator.clipboard.writeText(la),$e(!0),setTimeout(()=>$e(!1),2e3)},[]),La=t.useCallback(()=>{navigator.clipboard.writeText(Be),Ae(!0),setTimeout(()=>Ae(!1),2e3)},[]),Ia=t.useCallback(async()=>{V(!0),le(null);try{le(await Ua())}catch(a){le({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(a==null?void 0:a.message)||String(a),hint:"Reincearca sau verifica conexiunea la internet."})}finally{V(!1)}},[]),[Ca,xe]=t.useState(!1),Ye=t.useMemo(()=>ra(i,E).length>0,[i,E]);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[j&&Ye&&e.jsx(sa,{devices:i,tasks:E,onUneste:j,canEdit:A}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-start sm:items-center justify-between gap-3 mb-8 sm:mb-10",children:[e.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 min-w-0",children:[e.jsx("div",{className:`p-3 sm:p-5 rounded-2xl sm:rounded-3xl shrink-0 ${ae?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(Ke,{className:"w-7 h-7 sm:w-10 sm:h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-[12px] sm:text-sm text-slate-500 font-bold sm:tracking-tight mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:Ia,disabled:w||!ae,className:"p-4 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[w?e.jsx(M,{className:"w-5 h-5 animate-spin"}):e.jsx(Ze,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-wide hidden sm:inline",children:"Verifica conexiunea"})]})]}),X&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${X.ok?"bg-green-50 border-green-200 text-green-700":X.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[X.ok?e.jsx(se,{className:"w-6 h-6 shrink-0"}):e.jsx(Qe,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-wide",children:X.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:X.detail}),X.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:X.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-wide mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:H,onChange:a=>n(a.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-[11px] sm:text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-wide mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:C?"text":"password",value:b,onChange:a=>h(a.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>f(!C),className:"absolute right-2 top-1/2 -translate-y-1/2 px-3 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wide bg-slate-50 rounded-lg",children:C?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>Ma(H,b),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-bold tracking-normal shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),ae&&e.jsxs("button",{onClick:()=>xe(!0),className:"px-8 py-5 bg-red-50 text-red-700 rounded-[1.5rem] font-bold tracking-normal text-[13px] transition hover:bg-red-100 flex items-center justify-center gap-2 shrink-0","aria-label":"Deconecteaza cloud-ul de pe acest aparat",children:[e.jsx($a,{className:"w-5 h-5 shrink-0"})," Deconecteaza"]})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(Ya,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx(Ja,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-wide",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:Be}),e.jsxs("button",{onClick:La,className:"absolute top-4 right-4 px-3 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wide",children:[je?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),je?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-emerald-600 text-white rounded-2xl shadow-lg",children:e.jsx(Ze,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white tracking-tight",children:"Conturi si acces"}),e.jsx("p",{className:"text-[11px] text-emerald-300 font-bold",children:"Ruleaza al doilea, dupa scriptul de schema"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Pana rulezi acest script, tabelele nu au nicio politica de acces, deci sincronizarea nu functioneaza. Dupa ce il rulezi, primul cont inregistrat devine automat Administrator aprobat — inregistreaza-te tu primul."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-emerald-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:He}),e.jsxs("button",{onClick:va,className:"sticky top-0 float-right -mt-2 z-10 px-3 py-3 bg-slate-900 hover:bg-slate-800 border border-white/20 shadow-lg text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[ze?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),ze?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-indigo-600 text-white rounded-2xl shadow-lg",children:e.jsx(Wa,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white tracking-tight",children:"Referate, fundamentare, comenzi si contracte"}),e.jsx("p",{className:"text-[11px] text-indigo-300 font-bold",children:"Ruleaza al treilea, dupa cel de conturi"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Cele patru tabele nu sunt create de scripturile de mai sus. Pana rulezi acest script, referatele, documentele de fundamentare, comenzile si contractele se salveaza doar pe aparatul pe care le faci: nu ajung pe telefon, si nu le vede nimeni altcineva. Tot el adauga pe facturi numarul comenzii, cel dupa care se leaga singure de comanda."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-indigo-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:la}),e.jsxs("button",{onClick:wa,className:"sticky top-0 float-right -mt-2 z-10 px-3 py-3 bg-slate-900 hover:bg-slate-800 border border-white/20 shadow-lg text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[_e?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),_e?"Copiat":"Copiaza SQL"]})]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-4 mb-6",children:[e.jsxs("div",{className:"flex items-center gap-5 min-w-0",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(qe,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Spatiu pentru fisiere"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat ocupa documentele si cat a mai ramas"})]})]}),e.jsxs("button",{onClick:re,disabled:Se,className:"px-5 py-3 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-slate-100 transition disabled:opacity-50 flex items-center gap-2",children:[Se?e.jsx(_,{className:"w-4 h-4 animate-spin"}):e.jsx(M,{className:"w-4 h-4"}),"Masoara din nou"]})]}),(()=>{const a=!!ie&&!ie.eroare,s=a?ie:G,l=s.octeti;return e.jsxs("div",{className:"space-y-6",children:[!a&&e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-4 h-4 text-slate-500 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-600 leading-relaxed",children:["Socotit din evidenta aplicatiei",G.faraMarime>0&&e.jsxs(e.Fragment,{children:[" — ",G.faraMarime," document",G.faraMarime===1?"":"e"," urcate inainte ca marimea sa fie retinuta nu intra in total"]}),'. Pentru cifra exacta din stocare, ruleaza din nou scriptul "Conturi si acces" de mai sus.']})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsxs("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-wide",children:["In cloud · vazut de toti",a?" · masurat exact":""]}),e.jsxs("p",{className:"text-2xl font-black text-slate-900 tabular-nums mt-0.5",children:[P(l),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",R," GB"]})]})]}),e.jsxs("p",{className:`text-sm font-black tabular-nums ${l>R*1024**3*.9?"text-red-600":"text-emerald-700"}`,children:["mai ai ",P(Math.max(0,R*1024**3-l))]})]}),e.jsx("div",{className:"h-3 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all ${l>R*1024**3*.9?"bg-red-600":l>R*1024**3*.7?"bg-amber-500":"bg-blue-600"}`,style:{width:`${Math.min(100,l/(R*1024**3)*100)}%`}})}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500 mt-2",children:[`${s.fisiere} fisiere`,s.peFeluri.length?` · ${s.peFeluri.map(r=>`${lt[r.fel]||r.fel} ${P(r.octeti)}`).join(" · ")}`:""]})]}),e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3",children:[e.jsx("label",{className:"text-[11px] font-black text-slate-500 uppercase tracking-wide",children:"Limita abonamentului"}),e.jsx("input",{type:"number",min:"0.1",step:"0.1",value:R,onChange:r=>{const T=parseFloat(r.target.value)||it;we(T),rt(T)},"aria-label":"Limita de stocare, in gigaocteti",className:"w-28 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none"}),e.jsx("span",{className:"text-[11px] font-bold text-slate-500",children:"GB — Supabase nu spune cat da planul vostru, asa ca se scrie aici. Gratuit e 1 GB. Se salveaza pentru toata lumea: scrisa o data, o stiu si telefoanele."})]}),O&&O.limita>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-wide",children:"Pe aparatul acesta · copiile pentru offline"}),e.jsxs("p",{className:"text-lg font-black text-slate-900 tabular-nums mt-0.5",children:[P(O.octeti),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",P(O.limita)]})]})]}),e.jsxs("p",{className:"text-sm font-black text-emerald-700 tabular-nums",children:["mai ai ",P(Math.max(0,O.limita-O.octeti))]})]}),e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-slate-400 rounded-full",style:{width:`${Math.min(100,O.octeti/O.limita*100)}%`}})}),e.jsx("p",{className:"text-[11px] font-bold text-slate-500 mt-2 leading-relaxed",children:"Copiile aparatului acesta: documentele deschise, aplicatia pentru offline si, daca s-a citit vreun document scanat, motorul de recunoastere a textului. Limita o pune browserul, dupa cat loc liber are aparatul — de-aia e alta pe telefon decat pe calculator, si nu are legatura cu spatiul din cloud de mai sus."})]})]})})()]}),v&&(()=>{const a=Date.now(),s=y.filter(l=>Fa(l,a)).sort((l,r)=>(r.deletedAt||"").localeCompare(l.deletedAt||""));return e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-amber-100 text-amber-600 rounded-3xl",children:e.jsx(Ha,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Cosul de stergeri"}),e.jsxs("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:["Ce s-a sters in ultimele ",he," de zile se poate pune la loc"]})]})]}),s.length===0?e.jsxs("div",{className:"p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-5 h-5 text-slate-500 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-sm font-semibold text-slate-600 leading-relaxed",children:["Cosul e gol. Ce se sterge de-acum incolo ajunge aici si se poate pune la loc timp de ",he," de zile."]})]}):e.jsx("div",{className:"space-y-3",children:s.map(l=>{const r=Math.max(0,he-Math.floor((a-Date.parse(l.deletedAt))/864e5));return e.jsxs("div",{className:"flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsxs("p",{className:"text-[14px] font-black text-slate-900 truncate",children:[e.jsx("span",{className:"text-[10px] font-black uppercase tracking-wide text-slate-500 mr-2",children:Ba[l.entity]}),l.entityName||l.entityId]}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500 mt-0.5",children:["sters ",l.deletedAt.slice(0,10),l.deletedBy?` de ${l.deletedBy}`:""," · ",e.jsx("span",{className:r<=5?"text-red-600":"",children:r===0?"expira azi":`mai poate fi pus la loc ${r} ${bt(r)}`})]})]}),e.jsxs("button",{onClick:()=>v(l),disabled:!m,title:m?void 0:"Doar un administrator poate pune la loc",className:"px-5 py-3 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wide hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0",children:[e.jsx(M,{className:"w-4 h-4"})," Pune la loc"]})]},l.id)})})]})})(),S&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-emerald-100 text-emerald-600 rounded-3xl",children:e.jsx(qe,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Documente in Storage"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Scoate fisierele din interiorul randurilor"})]})]}),k.count===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsx("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:"Toate documentele sunt deja in Storage. Sincronizarea nu le mai transporta la fiecare rulare."})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"p-5 bg-amber-50 border border-amber-100 rounded-2xl mb-5",children:e.jsxs("p",{className:"text-sm font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:k.count===1?"Un document":`${k.count} documente`}),k.mb>=.1?` (~${k.mb.toFixed(1)} MB)`:"",k.count===1?" este":" sunt"," inca salvat",k.count===1?"":"e"," in interiorul randurilor, nu in Storage. Fiecare telefon le descarca integral la fiecare sincronizare. Mutarea lor in Storage lasa in rand doar o referinta."]})}),e.jsxs("button",{onClick:Na,disabled:Q,className:"w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3",children:[Q?e.jsx(_,{className:"w-5 h-5 animate-spin"}):e.jsx(Va,{className:"w-5 h-5"}),Q?"Se muta...":"Muta documentele in Storage"]})]}),Q&&B.total>0&&e.jsxs("div",{className:"mt-5 space-y-2",children:[e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-emerald-500 transition-all",style:{width:`${Math.round(B.done/B.total*100)}%`}})}),e.jsxs("p",{className:"text-xs font-semibold text-slate-500 truncate",children:[B.done," / ",B.total," · ",B.label]})]}),Ue&&e.jsx("p",{className:"mt-5 text-sm font-semibold text-slate-700",children:Ue})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ga,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Calitatea scanarilor"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat de mult se comprima paginile scanate"})]})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:ta.map(a=>{const s=a.id===xa;return e.jsxs("button",{onClick:()=>Ea(a.id),className:`text-left p-5 rounded-2xl border-2 transition ${s?"border-blue-600 bg-blue-50":"border-slate-200 bg-white hover:border-slate-300"}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-2 mb-2",children:[e.jsx("span",{className:`text-[15px] font-bold ${s?"text-blue-700":"text-slate-900"}`,children:a.label}),s&&e.jsx(te,{className:"w-4 h-4 text-blue-600 shrink-0"})]}),e.jsx("p",{className:"text-xs font-medium text-slate-500 leading-relaxed mb-3",children:a.description}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500",children:["~",a.approxKb," KB / pagina"]})]},a.id)})}),e.jsxs("label",{className:"mt-5 flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:Ta,onChange:a=>{dt(a.target.checked),ha(a.target.checked)},className:"mt-0.5 w-5 h-5 accent-blue-600 shrink-0"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-[14px] font-bold text-slate-900",children:"Indreapta lumina si scoate umbrele"}),e.jsx("p",{className:"text-[13px] font-medium text-slate-500 mt-0.5 leading-relaxed",children:"Umbra mainii, coltul mai luminos de sub lampa si galbenul becului se scot dupa fotografiere, iar hartia iese alba peste tot — ca la un scanner. Stampilele si semnaturile colorate raman colorate. Se opreste singura cand ce s-a fotografiat nu e o hartie, deci o poza a unui aparat nu se atinge."})]})]}),e.jsxs("p",{className:"mt-5 text-[13px] font-medium text-slate-500 leading-relaxed",children:["Cu 1 GB de spatiu, alegerea inseamna aproximativ"," ",e.jsx("span",{className:"font-bold text-slate-700",children:ta.map(a=>`${a.label}: ${Math.round(1024*1024/a.approxKb/3).toLocaleString("ro-RO")}`).join(" · ")})," ","documente de cate 3 pagini. Setarea se aplica scanarilor viitoare; cele existente raman neschimbate."]})]}),pe&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(ea,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold tracking-tight mt-1",children:"Controlul accesului in aplicatie"})]})]}),Fe&&e.jsx("div",{className:"mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl",children:e.jsx("p",{className:"text-xs font-bold text-red-600",children:Fe})}),e.jsxs("div",{className:"space-y-3 mb-8",children:[Me.length===0&&e.jsx("p",{className:"text-sm font-semibold text-slate-500 py-6 text-center",children:"Niciun cont inca. Utilizatorii se inregistreaza singuri din ecranul de autentificare."}),Me.map(a=>e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:`p-2.5 rounded-xl border shrink-0 self-start ${a.approved?"bg-white text-indigo-600 border-slate-200":"bg-amber-50 text-amber-700 border-amber-200"}`,children:e.jsx(ea,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-[15px] font-bold text-slate-900 truncate",children:[a.name,a.id===(o==null?void 0:o.id)&&e.jsx("span",{className:"ml-2 text-[11px] text-blue-600 font-bold",children:"(tu)"})]}),e.jsx("p",{className:"text-xs font-semibold text-slate-500 truncate",children:a.email}),!a.approved&&e.jsx("p",{className:"text-[11px] font-bold text-amber-600 mt-0.5",children:"Asteapta aprobare"})]}),e.jsx("select",{value:a.role,onChange:s=>ga(a,s.target.value),disabled:a.id===(o==null?void 0:o.id),title:a.id===(o==null?void 0:o.id)?"Nu iti poti schimba propriul rol":"Schimba rolul",className:"px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none disabled:opacity-50",children:Object.keys(Ve).map(s=>e.jsx("option",{value:s,children:Ve[s]},s))}),e.jsx("button",{onClick:()=>ja(a),disabled:a.id===(o==null?void 0:o.id),className:`px-4 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap ${a.approved?"bg-white text-slate-500 border-2 border-slate-200 hover:text-red-600 hover:border-red-200":"bg-emerald-600 text-white hover:bg-emerald-700"}`,children:a.approved?"Suspenda":"Aproba"})]},a.id))]}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3",children:[e.jsx("p",{className:"text-[13px] font-bold text-slate-500",children:"Cum se adauga un utilizator"}),e.jsxs("p",{className:"text-sm font-medium text-slate-600 leading-relaxed",children:["Persoana isi creeaza singura cont din ecranul de autentificare, cu emailul si o parola proprie. Contul apare aici imediat, marcat ",e.jsx("span",{className:"font-bold text-amber-600",children:"Asteapta aprobare"}),", si nu vede niciun fel de date pana cand nu ii alegi un rol si apesi ",e.jsx("span",{className:"font-bold",children:"Aproba"}),"."]}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-500 leading-relaxed pt-1",children:["Roluri: ",e.jsx("span",{className:"text-slate-700",children:"Administrator"})," (tot, inclusiv stergeri) ·",e.jsx("span",{className:"text-slate-700",children:" Tehnician"})," (fara Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Contabil"})," (cu Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Vizualizare"})," (doar citire)"]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ka,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-500 font-bold tracking-tight mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(c.length,50)," actiuni"]})]})]}),c.length===0?e.jsx("p",{className:"py-10 text-center text-[13px] font-bold text-slate-500 tracking-normal",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:c.slice(0,50).map(a=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${a.action==="delete"?"bg-red-50 text-red-500":a.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:a.action==="create"?"Creat":a.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wide text-slate-500",children:a.entity==="device"?"Dispozitiv":a.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:a.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:a.userName}),e.jsx("p",{className:"shrink-0 text-[10px] font-mono font-bold text-slate-500",children:new Date(a.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},a.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(Za,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(M,{className:`w-5 h-5 ${ne?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:Sa,disabled:ne,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-bold text-[13px] tracking-normal shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[ne?e.jsx(_,{className:"w-5 h-5 animate-spin"}):e.jsx(M,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[10px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:ma??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(aa,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:na??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Dispozitive active in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:i.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${L!==null&&L<i.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${L!==null&&L<i.length?"text-amber-600":"text-emerald-600"}`,children:de?"...":ce?"—":L??"?"}),e.jsx("button",{onClick:F,disabled:de,className:"p-1.5 text-slate-500 hover:text-blue-600 transition",title:"Verifica din nou","aria-label":"Verifica din nou",children:e.jsx(M,{className:`w-3.5 h-3.5 ${de?"animate-spin":""}`})})]})]}),ce&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",ce]}),L!==null&&L<i.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:i.length-L})," echipamente. Pe alt telefon vor aparea doar cele ",L," existente in cloud. Apasa mai jos pentru a urca toate dispozitivele."]}),e.jsxs("button",{onClick:pa,disabled:K,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[K?e.jsx(_,{className:"w-4 h-4 animate-spin"}):e.jsx(Ke,{className:"w-4 h-4"}),K?`Se urca ${Oe}...`:"Urca toate dispozitivele in cloud"]}),K&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${i.length?Oe/i.length*100:0}%`}})})]}),e.jsxs("button",{onClick:ua,disabled:me,className:"w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[me?e.jsx(_,{className:"w-4 h-4 animate-spin"}):e.jsx(aa,{className:"w-4 h-4"}),me?"Se compara...":"Compara local cu cloud"]}),I&&e.jsx("div",{className:"p-4 bg-white border border-slate-200 rounded-2xl space-y-3",children:I.localOnly.length===0&&I.cloudOnly.length===0?e.jsx("p",{className:"text-[11px] font-bold text-emerald-700",children:"Identice — fiecare echipament local exista si in cloud."}):e.jsxs(e.Fragment,{children:[I.localOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-amber-600 uppercase tracking-wide mb-1",children:["Doar pe acest dispozitiv (",I.localOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:I.localOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Urca toate dispozitivele" ca sa ajunga si in cloud.'})]}),I.cloudOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-blue-600 uppercase tracking-wide mb-1",children:["Doar in cloud (",I.cloudOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:I.cloudOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Re-sincronizare" ca sa le aduci aici.'})]})]})}),$&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${$.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[$.ok?e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(Qe,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${$.ok?"text-emerald-700":"text-red-700"}`,children:$.message})]})]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-slate-200 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-wide",children:"Versiune aplicatie"}),e.jsx("span",{className:"text-[10px] font-mono font-bold text-slate-600",children:xt})]}),e.jsxs("button",{onClick:Aa,className:"w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-slate-200 transition flex items-center justify-center gap-2",children:[e.jsx(M,{className:"w-3.5 h-3.5"})," Forteaza reincarcarea aplicatiei"]})]})]})]}),j&&!Ye&&e.jsx(sa,{devices:i,tasks:E,onUneste:j,canEdit:A}),e.jsx(ia,{open:Ca,tone:"neutral",title:"Deconectezi cloud-ul?",icon:e.jsx(Qa,{className:"w-8 h-8 sm:w-10 sm:h-10"}),body:e.jsx(e.Fragment,{children:"Aplicatia trece in modul doar local pe acest dispozitiv. Datele salvate raman, dar nu se mai sincronizeaza pana la o reconectare."}),confirmLabel:"Deconecteaza",cancelLabel:"Ramai conectat",onCancel:()=>xe(!1),onConfirm:()=>{za(),xe(!1)}})]})};export{vt as default};
