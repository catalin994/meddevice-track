import{j as e,q as wa,s as ae,t as va,v as Ye,w as La,x as Ia,y as Ca,z as Xa,A as Je,p as be,S as We,B as Oa,C as Da,E as Ra,Z as he,N as ya,R as He,F as ka,G as Ua}from"./index-CHp0qwj_.js";import{a as t,aj as Ma,G as se,I as fe,ai as Ge,ak as Ee,d as z,o as Ve,m as y,v as Ke,z as Ze,b as Fa,T as Ba,w as za,C as te,e as Ne,$ as Pa,al as Qe,a2 as _a,a0 as $a,a7 as Ya,am as qe,H as Ja,an as Wa,B as ea,p as Ha}from"./vendor-icons-CwsapGYZ.js";import{C as sa}from"./ConfirmDialog-DZTtUqvX.js";import{i as Ga,l as Va,s as Ka,a as Za,b as Qa,m as B,N as qa,L as et,p as at}from"./spatiu-CRgzm9iC.js";import{g as tt,s as st,S as aa}from"./scanQuality-BG2ILRky.js";import"./vendor-recharts-Bq1lkYUk.js";import"./vendor-db-CxvqBt6T.js";const lt=new Set(["sectia","sectie","sec","compartimentul","compartiment","comp","cabinetul","cabinet","cab","laboratorul","laborator","lab","serviciul","serviciu","serv","unitatea","unitate","clinica","clinic","de","si","a","al","ale","cu","din","pentru","la"]),it={ati:"anestezie terapie intensiva",ti:"terapie intensiva",upu:"unitate primiri urgente",cpu:"camera primiri urgente",uts:"unitate transfuzie sanguina",ctt:"centru transfuzie",bo:"bloc operator",blocop:"bloc operator",orl:"otorinolaringologie",bfk:"balneofizioterapie",rmf:"recuperare medicina fizica"},rt=i=>String(i??"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[șşŞȘ]/g,"s").replace(/[țţŢȚ]/g,"t").replace(/[ăâĂÂ]/g,"a").replace(/[îÎ]/g,"i").toLowerCase(),ge=i=>{const p=rt(i).replace(/[^a-z0-9]+/g," ").trim().replace(/\b(?:[a-z] ){1,}[a-z]\b/g,m=>m.replace(/ /g,""));if(!p)return"";const f=p.split(/\s+/).map(m=>it[m]||m).join(" ").split(/\s+/).filter(m=>m&&!lt.has(m));return f.length===0?p:[...new Set(f)].sort().join(" ")},nt=(i,p=[])=>{const f=new Map,m=(d,h)=>{const o=String(d??"").trim();if(!o)return;const r=f.get(o)||{aparate:0,tichete:0};r[h]++,f.set(o,r)};i.forEach(d=>m(d.department,"aparate")),p.forEach(d=>m(d.department,"tichete"));const N=new Map;for(const[d,h]of f){const o=ge(d);if(!o)continue;const r=N.get(o)||{cheie:o,feluri:[],propus:d,total:0};r.feluri.push({nume:d,aparate:h.aparate,tichete:h.tichete}),r.total+=h.aparate+h.tichete,N.set(o,r)}return[...N.values()].filter(d=>d.feluri.length>1).map(d=>{var o;d.feluri.sort((r,g)=>g.aparate+g.tichete-(r.aparate+r.tichete)||r.nume.localeCompare(g.nume,"ro"));const h=d.feluri.filter(r=>r.aparate+r.tichete===d.feluri[0].aparate+d.feluri[0].tichete);return d.propus=((o=h.find(r=>/[ăâîșțĂÂÎȘȚşţŞŢ]/.test(r.nume)))==null?void 0:o.nume)||h[0].nume,d}).sort((d,h)=>h.total-d.total)},ct=({devices:i,tasks:p,onUneste:f,canEdit:m})=>{const N=t.useMemo(()=>nt(i,p),[i,p]),[d,h]=t.useState({}),[o,r]=t.useState(null),[g,$]=t.useState(!1),k=t.useMemo(()=>{const c=new Set;return i.forEach(x=>{var b;(b=x.department)!=null&&b.trim()&&c.add(x.department.trim())}),p.forEach(x=>{var b;(b=x.department)!=null&&b.trim()&&c.add(x.department.trim())}),[...c].sort((x,b)=>x.localeCompare(b,"ro"))},[i,p]),[j,Y]=t.useState(""),[A,J]=t.useState(""),W=c=>i.filter(x=>{var b;return((b=x.department)==null?void 0:b.trim())===c}).length+p.filter(x=>{var b;return((b=x.department)==null?void 0:b.trim())===c}).length,H=async()=>{if(o){$(!0);try{await f(o.dela,o.la)}finally{$(!1),r(null)}}};return e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 mb-6",children:[e.jsx("div",{className:"p-3 sm:p-5 bg-indigo-100 text-indigo-600 rounded-2xl sm:rounded-3xl shrink-0",children:e.jsx(Ma,{className:"w-7 h-7 sm:w-10 sm:h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Sectii care se repeta"}),e.jsx("p",{className:"text-[12px] sm:text-sm text-slate-500 font-semibold mt-1",children:"Aceeasi sectie scrisa in mai multe feluri, adusa la una singura"})]})]}),N.length===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:["Nicio sectie nu se repeta. ",k.length," sectii, fiecare cu un singur nume."]})]}):e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-4 h-4 text-amber-600 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-[13px] font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:N.length})," ",N.length===1?"sectie apare":"sectii apar",' sub mai multe nume. Alege forma care ramane si apasa "Uneste" — aparatele si tichetele se muta pe ea. Verifica-le pe fiecare: "Chirurgie 1" si "Chirurgie 2" seamana, dar sunt doua sectii.']})]}),N.map(c=>{const x=d[c.cheie]||c.propus,b=c.feluri.filter(E=>E.nume!==x),L=b.reduce((E,S)=>E+S.aparate+S.tichete,0);return e.jsxs("div",{className:"p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3",children:[e.jsx("div",{className:"flex flex-wrap gap-2",children:c.feluri.map(E=>{const S=E.nume===x;return e.jsxs("button",{onClick:()=>h(G=>({...G,[c.cheie]:E.nume})),disabled:!m,title:S?"Numele care ramane":"Apasa ca sa pastrezi acest nume",className:`px-3.5 py-2.5 rounded-xl text-[12px] font-bold transition border-2 text-left disabled:cursor-not-allowed ${S?"bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20":"bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`,children:[e.jsx("span",{className:"block",children:E.nume}),e.jsxs("span",{className:`block text-[10px] font-black uppercase tracking-wide mt-0.5 ${S?"text-white/70":"text-slate-400"}`,children:[E.aparate," aparate",E.tichete?` · ${E.tichete} tichete`:""]})]},E.nume)})}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("p",{className:"text-[12px] font-bold text-slate-500 flex items-center gap-2 min-w-0",children:[e.jsx(Ge,{className:"w-4 h-4 shrink-0 text-slate-400"}),e.jsxs("span",{className:"truncate",children:[L," ",L===1?"inregistrare se muta":"inregistrari se muta"," pe",e.jsxs("span",{className:"text-slate-900 font-black",children:[" ",x]})]})]}),e.jsxs("button",{onClick:()=>r({cheie:c.cheie,dela:b.map(E=>E.nume),la:x,cate:L}),disabled:!m||L===0,className:"px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0",children:[e.jsx(Ee,{className:"w-4 h-4"})," Uneste"]})]})]},c.cheie)})]}),e.jsxs("div",{className:"mt-6 pt-6 border-t border-slate-100",children:[e.jsx("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3",children:"Uneste doua sectii care nu seamana la nume"}),e.jsx("p",{className:"text-[12px] font-semibold text-slate-500 mb-3 leading-relaxed",children:'Pentru cazurile pe care aplicatia n-are cum sa le ghiceasca — "UTS Judetean" si "Unitate de transfuzie", de pilda, cand numele vine din registrul contabil.'}),e.jsxs("div",{className:"flex flex-col sm:flex-row items-stretch sm:items-end gap-3",children:[e.jsxs("label",{className:"flex-1 min-w-0 space-y-1.5",children:[e.jsx("span",{className:"text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1",children:"Se muta de la"}),e.jsxs("select",{value:j,onChange:c=>Y(c.target.value),disabled:!m,className:"w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500",children:[e.jsx("option",{value:"",children:"— alege sectia —"}),k.map(c=>e.jsxs("option",{value:c,children:[c," (",W(c),")"]},c))]})]}),e.jsx(Ge,{className:"w-5 h-5 text-slate-300 shrink-0 hidden sm:block mb-3.5"}),e.jsxs("label",{className:"flex-1 min-w-0 space-y-1.5",children:[e.jsx("span",{className:"text-[11px] font-bold text-slate-500 uppercase tracking-wide ml-1",children:"Ramane"}),e.jsxs("select",{value:A,onChange:c=>J(c.target.value),disabled:!m,className:"w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500",children:[e.jsx("option",{value:"",children:"— alege sectia —"}),k.map(c=>e.jsxs("option",{value:c,children:[c," (",W(c),")"]},c))]})]}),e.jsxs("button",{onClick:()=>r({cheie:"manual",dela:[j],la:A,cate:W(j)}),disabled:!m||!j||!A||j===A,className:"px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0",children:[e.jsx(Ee,{className:"w-4 h-4"})," Uneste"]})]}),j&&A&&j!==A&&ge(j)!==ge(A)&&e.jsx("p",{className:"text-[12px] font-bold text-amber-700 mt-3 leading-relaxed",children:"Numele astea doua nu seamana deloc. Sigur e aceeasi sectie?"})]}),e.jsx(sa,{open:!!o,tone:"neutral",title:"Unesti sectiile?",icon:g?e.jsx(z,{className:"w-8 h-8 animate-spin"}):e.jsx(Ee,{className:"w-8 h-8"}),body:e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"font-black text-slate-900",children:o==null?void 0:o.cate})," ",(o==null?void 0:o.cate)===1?"inregistrare se muta":"inregistrari se muta"," de pe"," ",o==null?void 0:o.dela.map(c=>e.jsxs("span",{className:"font-black text-slate-900",children:['"',c,'" ']},c)),"pe ",e.jsxs("span",{className:"font-black text-slate-900",children:['"',o==null?void 0:o.la,'"']}),". Aparatele raman aceleasi, li se schimba doar sectia — si se poate face la loc de aici, unind inapoi."]}),confirmLabel:g?"Se muta...":"Uneste",cancelLabel:"Renunt",onCancel:()=>r(null),onConfirm:H})]})},ta=`-- BIOMEDIC — REFERATE, DOCUMENTE DE FUNDAMENTARE SI COMENZI
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
`,ot="2026-08-20 11:11",dt=i=>{if(i===1)return"zi";const p=i%100;return p===0||p>=20?"de zile":"zile"},ft=({devices:i,invoices:p=[],tasks:f=[],referate:m=[],foundationDocs:N=[],comenzi:d=[],onImport:h,auditLog:o=[],currentUser:r=null,onMigrateFiles:g,deletions:$=[],onRestore:k,canDelete:j=!1,onUnesteSectii:Y,canEdit:A=!1})=>{t.useRef(null);const[J,W]=t.useState(wa()),[H,c]=t.useState(J.url||""),[x,b]=t.useState(J.key||""),[L,E]=t.useState(!1),[S,G]=t.useState(!1),[mt,ut]=t.useState(null),[I,le]=t.useState(null),[je,Ae]=t.useState(!1),[la,ia]=t.useState(null),[ie,ra]=t.useState(null),[C,na]=t.useState(null),[Se,we]=t.useState(!1),[O,ve]=t.useState(()=>Ga());t.useEffect(()=>{Va().then(ve)},[]);const V=t.useMemo(()=>Ka(i,p,m,N,d),[i,p,m,N,d]),re=t.useCallback(async()=>{we(!0);const[a,s]=await Promise.all([Za(),Qa()]);ra(a),na(s),we(!1)},[]);t.useEffect(()=>{re()},[re]);const[ca,Le]=t.useState(null),[ne,Ie]=t.useState(!1),[w,Ce]=t.useState(null),[ce,oe]=t.useState(null),[de,Xe]=t.useState(!1),[K,Z]=t.useState(!1),[Oe,De]=t.useState(0),[P,X]=t.useState(null),U=t.useCallback(async()=>{if(!ae){oe("Cloud neconfigurat");return}Xe(!0),oe(null);const{count:a,error:s}=await va("devices");s?(oe(s.message||"eroare necunoscuta"),Ce(null)):Ce(a),Xe(!1)},[]);t.useEffect(()=>{U()},[U,i.length]);const[v,Re]=t.useState(null),[me,ue]=t.useState(!1),oa=t.useCallback(async()=>{ue(!0),Re(null);const{data:a,error:s}=await Ye("devices");if(s||!a){X({ok:!1,message:`Nu s-a putut citi lista din cloud: ${(s==null?void 0:s.message)||"eroare"}`}),ue(!1);return}const l=new Set(a.map(u=>String(u.id).trim())),n=new Set(i.map(u=>String(u.id).trim())),T=u=>{var R,ee;return((R=i.find(Te=>Te.id===u))==null?void 0:R.name)||((ee=a.find(Te=>String(Te.id).trim()===u))==null?void 0:ee.name)||u};Re({localOnly:[...n].filter(u=>!l.has(u)).map(u=>`${T(u)} (${u})`),cloudOnly:[...l].filter(u=>!n.has(u)).map(u=>`${T(u)} (${u})`)}),ue(!1)},[i]),da=t.useCallback(async()=>{if(i.length===0)return;Z(!0),De(0),X(null);const{data:a,error:s}=await Ye("devices");if(s){Z(!1),X({ok:!1,message:`Nu s-a putut citi cloud-ul inainte de urcare: ${s.message||s}`});return}const l=La(i,a||[]);if(l.length===0){Z(!1),X({ok:!0,message:"Cloud-ul are deja tot ce exista pe acest dispozitiv — nimic de urcat."}),await U();return}const{error:n,written:T,skippedColumns:u,oversized:R}=await Ia("devices",l,100,ee=>De(ee));Z(!1),n?X({ok:!1,message:`Urcarea s-a oprit dupa ${T} echipamente: ${n.message||n}`}):R.length>0?X({ok:!1,message:`${T} echipamente urcate, dar ${R.length} nu au incaput (documente atasate prea mari): ${R.slice(0,3).join(", ")}${R.length>3?"...":""}`}):u.length>0?X({ok:!0,message:`${T} echipamente au fost urcate. Atentie: campurile ${u.join(", ")} nu exista in tabelul din cloud si au fost omise — ruleaza scriptul SQL de mai sus in Supabase, apoi urca din nou ca sa se salveze si ele.`}):X({ok:!0,message:`${T} echipamente au fost urcate in cloud. Deschide aplicatia pe celalalt telefon si apasa Re-sincronizare.`}),await U()},[i,U]),D=t.useMemo(()=>{let a=0,s=0;const l=n=>{n!=null&&n.startsWith("data:")&&(a++,s+=Math.round(n.length*.75))};return i.forEach(n=>{(n.files||[]).forEach(T=>{T.path||l(T.url)}),(n.contracts||[]).forEach(T=>{T.filePath||l(T.fileUrl)})}),f.forEach(n=>(n.attachments||[]).forEach(T=>{T.path||l(T.url)})),[...p,...m,...N,...d].forEach(n=>{n.filePath||l(n.fileUrl)}),{count:a,mb:s/(1024*1024)}},[i,f,p,m,N,d]),[ma,ua]=t.useState(()=>tt().id),pa=t.useCallback(a=>{st(a),ua(a)},[]),[Q,ye]=t.useState(!1),[M,ke]=t.useState({done:0,total:0,label:""}),[Ue,_]=t.useState(null),xa=t.useCallback(async()=>{if(g){ye(!0),_(null),ke({done:0,total:0,label:""});try{const a=await g((s,l,n)=>ke({done:s,total:l,label:n}));a.error?_(`S-au mutat ${a.moved} din ${a.total}, apoi a aparut o eroare: ${a.error}`):a.total===0?_("Nu mai exista documente de mutat — totul e deja in Storage."):_(`Gata: ${a.moved} documente mutate in Storage.`)}catch(a){_(`Mutarea a esuat: ${(a==null?void 0:a.message)||a}`)}finally{ye(!1)}}},[g]),pe=Ca(r,"manageUsers"),[Me,Ta]=t.useState([]),[Fe,q]=t.useState(""),F=t.useCallback(async()=>{const a=await Xa();Ta(a)},[]);t.useEffect(()=>{pe&&F()},[pe,F]);const ba=t.useCallback(async(a,s)=>{q("");const{error:l}=await Je(a.id,{role:s,approved:!0});l?q(l):F()},[F]),ha=t.useCallback(async a=>{q("");const{error:s}=await Je(a.id,{approved:!a.approved});s?q(s):F()},[F]),Ea=t.useCallback(async()=>{try{if("caches"in window){const s=await caches.keys();await Promise.all(s.map(l=>caches.delete(l)))}if("serviceWorker"in navigator){const s=await navigator.serviceWorker.getRegistrations();await Promise.all(s.map(l=>l.unregister()))}}catch{}const a=new URL(window.location.href);a.searchParams.set("v",Date.now().toString()),window.location.replace(a.toString())},[]),Be=`-- BIOMEDIC — SCHEMA + MIGRARE (se poate rula de mai multe ori, in siguranta)
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
`;t.useEffect(()=>{(async()=>{const s=await Ua();ia(s.count);try{const l=localStorage.getItem("meditrack_devices");Le(l?JSON.parse(l).length:0)}catch{Le(0)}})()},[i]);const Na=t.useCallback(async()=>{Ie(!0);try{const a=localStorage.getItem("meditrack_devices");if(a){const s=JSON.parse(a);Array.isArray(s)&&s.length>0&&(await h(s),be(`S-au recuperat ${s.length} dispozitive din datele vechi.`,"success"))}else be("Nu s-au gasit date vechi de recuperat.","info")}catch(a){be("Recuperarea a esuat: "+a.message,"error")}finally{Ie(!1)}},[h]),[ze,Pe]=t.useState(!1),fa=t.useCallback(()=>{navigator.clipboard.writeText(We),Pe(!0),setTimeout(()=>Pe(!1),2e3)},[]),[_e,$e]=t.useState(!1),ga=t.useCallback(()=>{navigator.clipboard.writeText(ta),$e(!0),setTimeout(()=>$e(!1),2e3)},[]),ja=t.useCallback(()=>{navigator.clipboard.writeText(Be),Ae(!0),setTimeout(()=>Ae(!1),2e3)},[]),Aa=t.useCallback(async()=>{G(!0),le(null);try{le(await Oa())}catch(a){le({ok:!1,stage:"blocked",title:"Verificare eșuată",detail:(a==null?void 0:a.message)||String(a),hint:"Reincearca sau verifica conexiunea la internet."})}finally{G(!1)}},[]),[Sa,xe]=t.useState(!1);return e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 px-4",children:[e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-start sm:items-center justify-between gap-3 mb-8 sm:mb-10",children:[e.jsxs("div",{className:"flex items-center gap-3 sm:gap-5 min-w-0",children:[e.jsx("div",{className:`p-3 sm:p-5 rounded-2xl sm:rounded-3xl shrink-0 ${ae?"bg-green-100 text-green-600":"bg-blue-100 text-blue-600"}`,children:e.jsx(Ve,{className:"w-7 h-7 sm:w-10 sm:h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Supabase Core"}),e.jsx("p",{className:"text-[12px] sm:text-sm text-slate-500 font-bold uppercase sm:tracking-widest mt-1",children:"Infrastructura globala de date"})]})]}),e.jsxs("button",{onClick:Aa,disabled:S||!ae,className:"p-4 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-2xl transition flex items-center gap-3 border border-slate-100 disabled:opacity-30",children:[S?e.jsx(y,{className:"w-5 h-5 animate-spin"}):e.jsx(Ke,{className:"w-5 h-5"}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest hidden sm:inline",children:"Verifica conexiunea"})]})]}),I&&e.jsx("div",{className:`mb-8 p-5 sm:p-6 rounded-3xl border animate-fade-in ${I.ok?"bg-green-50 border-green-200 text-green-700":I.stage==="schema"?"bg-amber-50 border-amber-200 text-amber-800":"bg-red-50 border-red-200 text-red-700"}`,children:e.jsxs("div",{className:"flex gap-4",children:[I.ok?e.jsx(se,{className:"w-6 h-6 shrink-0"}):e.jsx(Ze,{className:"w-6 h-6 shrink-0"}),e.jsxs("div",{className:"min-w-0 space-y-2",children:[e.jsx("p",{className:"font-black text-xs uppercase tracking-widest",children:I.title}),e.jsx("p",{className:"text-sm font-bold leading-relaxed break-words",children:I.detail}),I.hint&&e.jsx("p",{className:"text-[11px] font-medium leading-relaxed bg-black/5 p-3 rounded-xl",children:I.hint})]})]})}),e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"URL Endpoint Proiect"}),e.jsx("input",{type:"text",value:H,onChange:a=>c(a.target.value),placeholder:"https://abc.supabase.co",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-[11px] sm:text-sm font-mono"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block",children:"Cheie Anon/Secret"}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:L?"text":"password",value:x,onChange:a=>b(a.target.value),placeholder:"eyJhbG...",className:"w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-mono pr-24"}),e.jsx("button",{onClick:()=>E(!L),className:"absolute right-2 top-1/2 -translate-y-1/2 px-3 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 rounded-lg",children:L?"Ascunde":"Arata"})]})]})]}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 pt-4",children:[e.jsx("button",{onClick:()=>Da(H,x),className:"flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-700 transition active:scale-95",children:"Conecteaza Instanta Cloud"}),ae&&e.jsxs("button",{onClick:()=>xe(!0),className:"px-8 py-5 bg-red-50 text-red-700 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition hover:bg-red-100 flex items-center justify-center gap-2 shrink-0","aria-label":"Deconecteaza cloud-ul de pe acest aparat",children:[e.jsx(Fa,{className:"w-5 h-5 shrink-0"})," Deconecteaza"]})]})]})]}),e.jsxs("div",{className:"bg-slate-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-10 pointer-events-none",children:e.jsx(Ba,{className:"w-40 h-40 text-blue-400"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-600 text-white rounded-2xl shadow-lg",children:e.jsx(za,{className:"w-6 h-6"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Instalare Schema Baza de Date"}),e.jsx("p",{className:"text-[10px] text-blue-400 font-bold uppercase tracking-widest",children:"Executa acest script in Supabase SQL Editor"})]})]}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 mb-6 shadow-inner relative group border border-white/5",children:[e.jsx("pre",{className:"text-xs font-mono text-blue-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:Be}),e.jsxs("button",{onClick:ja,className:"absolute top-4 right-4 px-3 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",children:[je?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),je?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-emerald-600 text-white rounded-2xl shadow-lg",children:e.jsx(Ke,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Conturi si acces"}),e.jsx("p",{className:"text-[11px] text-emerald-300 font-bold",children:"Ruleaza al doilea, dupa scriptul de schema"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Pana rulezi acest script, tabelele nu au nicio politica de acces, deci sincronizarea nu functioneaza. Dupa ce il rulezi, primul cont inregistrat devine automat Administrator aprobat — inregistreaza-te tu primul."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-emerald-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:We}),e.jsxs("button",{onClick:fa,className:"sticky top-0 float-right -mt-2 z-10 px-3 py-3 bg-slate-900 hover:bg-slate-800 border border-white/20 shadow-lg text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[ze?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),ze?"Copiat":"Copiaza SQL"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mb-6 pt-4 border-t border-white/10",children:[e.jsx("div",{className:"p-3 bg-indigo-600 text-white rounded-2xl shadow-lg",children:e.jsx(Pa,{className:"w-6 h-6"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-xl font-black text-white uppercase tracking-tight",children:"Referate, fundamentare, comenzi si contracte"}),e.jsx("p",{className:"text-[11px] text-indigo-300 font-bold",children:"Ruleaza al treilea, dupa cel de conturi"})]})]}),e.jsx("div",{className:"p-4 mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl",children:e.jsx("p",{className:"text-[13px] text-amber-200 font-semibold leading-relaxed",children:"Cele patru tabele nu sunt create de scripturile de mai sus. Pana rulezi acest script, referatele, documentele de fundamentare, comenzile si contractele se salveaza doar pe aparatul pe care le faci: nu ajung pe telefon, si nu le vede nimeni altcineva. Tot el adauga pe facturi numarul comenzii, cel dupa care se leaga singure de comanda."})}),e.jsxs("div",{className:"bg-black/50 rounded-2xl p-6 shadow-inner relative border border-white/5 max-h-[420px] overflow-y-auto custom-scrollbar",children:[e.jsx("pre",{className:"text-xs font-mono text-indigo-100 break-all whitespace-pre-wrap leading-relaxed pt-12 sm:pt-0 sm:pr-36",children:ta}),e.jsxs("button",{onClick:ga,className:"sticky top-0 float-right -mt-2 z-10 px-3 py-3 bg-slate-900 hover:bg-slate-800 border border-white/20 shadow-lg text-white rounded-xl transition-all flex items-center gap-2 text-[11px] font-bold",children:[_e?e.jsx(te,{className:"w-4 h-4"}):e.jsx(Ne,{className:"w-4 h-4"}),_e?"Copiat":"Copiaza SQL"]})]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-4 mb-6",children:[e.jsxs("div",{className:"flex items-center gap-5 min-w-0",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Qe,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Spatiu pentru fisiere"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat ocupa documentele si cat a mai ramas"})]})]}),e.jsxs("button",{onClick:re,disabled:Se,className:"px-5 py-3 bg-slate-50 border-2 border-slate-200 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition disabled:opacity-50 flex items-center gap-2",children:[Se?e.jsx(z,{className:"w-4 h-4 animate-spin"}):e.jsx(y,{className:"w-4 h-4"}),"Masoara din nou"]})]}),(()=>{const a=!!ie&&!ie.eroare,s=a?ie:V,l=s.octeti;return e.jsxs("div",{className:"space-y-6",children:[!a&&e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-4 h-4 text-slate-500 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-600 leading-relaxed",children:["Socotit din evidenta aplicatiei",V.faraMarime>0&&e.jsxs(e.Fragment,{children:[" — ",V.faraMarime," document",V.faraMarime===1?"":"e"," urcate inainte ca marimea sa fie retinuta nu intra in total"]}),'. Pentru cifra exacta din stocare, ruleaza din nou scriptul "Conturi si acces" de mai sus.']})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsxs("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:["In cloud · vazut de toti",a?" · masurat exact":""]}),e.jsxs("p",{className:"text-2xl font-black text-slate-900 tabular-nums mt-0.5",children:[B(l),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",O," GB"]})]})]}),e.jsxs("p",{className:`text-sm font-black tabular-nums ${l>O*1024**3*.9?"text-red-600":"text-emerald-700"}`,children:["mai ai ",B(Math.max(0,O*1024**3-l))]})]}),e.jsx("div",{className:"h-3 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:`h-full rounded-full transition-all ${l>O*1024**3*.9?"bg-red-600":l>O*1024**3*.7?"bg-amber-500":"bg-blue-600"}`,style:{width:`${Math.min(100,l/(O*1024**3)*100)}%`}})}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500 mt-2",children:[`${s.fisiere} fisiere`,s.peFeluri.length?` · ${s.peFeluri.map(n=>`${qa[n.fel]||n.fel} ${B(n.octeti)}`).join(" · ")}`:""]})]}),e.jsxs("div",{className:"p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3",children:[e.jsx("label",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:"Limita abonamentului"}),e.jsx("input",{type:"number",min:"0.1",step:"0.1",value:O,onChange:n=>{const T=parseFloat(n.target.value)||et;ve(T),at(T)},"aria-label":"Limita de stocare, in gigaocteti",className:"w-28 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none"}),e.jsx("span",{className:"text-[11px] font-bold text-slate-500",children:"GB — Supabase nu spune cat da planul vostru, asa ca se scrie aici. Gratuit e 1 GB. Se salveaza pentru toata lumea: scrisa o data, o stiu si telefoanele."})]}),C&&C.limita>0&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-end justify-between gap-3 mb-2",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[11px] font-black text-slate-500 uppercase tracking-widest",children:"Pe aparatul acesta · copiile pentru offline"}),e.jsxs("p",{className:"text-lg font-black text-slate-900 tabular-nums mt-0.5",children:[B(C.octeti),e.jsxs("span",{className:"text-sm font-bold text-slate-500",children:[" din ",B(C.limita)]})]})]}),e.jsxs("p",{className:"text-sm font-black text-emerald-700 tabular-nums",children:["mai ai ",B(Math.max(0,C.limita-C.octeti))]})]}),e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-slate-400 rounded-full",style:{width:`${Math.min(100,C.octeti/C.limita*100)}%`}})}),e.jsx("p",{className:"text-[11px] font-bold text-slate-500 mt-2 leading-relaxed",children:"Copiile aparatului acesta: documentele deschise, aplicatia pentru offline si, daca s-a citit vreun document scanat, motorul de recunoastere a textului. Limita o pune browserul, dupa cat loc liber are aparatul — de-aia e alta pe telefon decat pe calculator, si nu are legatura cu spatiul din cloud de mai sus."})]})]})})()]}),Y&&e.jsx(ct,{devices:i,tasks:f,onUneste:Y,canEdit:A}),k&&(()=>{const a=Date.now(),s=$.filter(l=>Ra(l,a)).sort((l,n)=>(n.deletedAt||"").localeCompare(l.deletedAt||""));return e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-amber-100 text-amber-600 rounded-3xl",children:e.jsx(_a,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Cosul de stergeri"}),e.jsxs("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:["Ce s-a sters in ultimele ",he," de zile se poate pune la loc"]})]})]}),s.length===0?e.jsxs("div",{className:"p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3",children:[e.jsx(fe,{className:"w-5 h-5 text-slate-500 shrink-0 mt-0.5"}),e.jsxs("p",{className:"text-sm font-semibold text-slate-600 leading-relaxed",children:["Cosul e gol. Ce se sterge de-acum incolo ajunge aici si se poate pune la loc timp de ",he," de zile."]})]}):e.jsx("div",{className:"space-y-3",children:s.map(l=>{const n=Math.max(0,he-Math.floor((a-Date.parse(l.deletedAt))/864e5));return e.jsxs("div",{className:"flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl",children:[e.jsxs("div",{className:"min-w-0 flex-1",children:[e.jsxs("p",{className:"text-[14px] font-black text-slate-900 truncate",children:[e.jsx("span",{className:"text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2",children:ya[l.entity]}),l.entityName||l.entityId]}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500 mt-0.5",children:["sters ",l.deletedAt.slice(0,10),l.deletedBy?` de ${l.deletedBy}`:""," · ",e.jsx("span",{className:n<=5?"text-red-600":"",children:n===0?"expira azi":`mai poate fi pus la loc ${n} ${dt(n)}`})]})]}),e.jsxs("button",{onClick:()=>k(l),disabled:!j,title:j?void 0:"Doar un administrator poate pune la loc",className:"px-5 py-3 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0",children:[e.jsx(y,{className:"w-4 h-4"})," Pune la loc"]})]},l.id)})})]})})(),g&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-emerald-100 text-emerald-600 rounded-3xl",children:e.jsx(Qe,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Documente in Storage"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Scoate fisierele din interiorul randurilor"})]})]}),D.count===0?e.jsxs("div",{className:"p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3",children:[e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0 mt-0.5"}),e.jsx("p",{className:"text-sm font-semibold text-emerald-800 leading-relaxed",children:"Toate documentele sunt deja in Storage. Sincronizarea nu le mai transporta la fiecare rulare."})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"p-5 bg-amber-50 border border-amber-100 rounded-2xl mb-5",children:e.jsxs("p",{className:"text-sm font-semibold text-amber-900 leading-relaxed",children:[e.jsx("span",{className:"font-black",children:D.count===1?"Un document":`${D.count} documente`}),D.mb>=.1?` (~${D.mb.toFixed(1)} MB)`:"",D.count===1?" este":" sunt"," inca salvat",D.count===1?"":"e"," in interiorul randurilor, nu in Storage. Fiecare telefon le descarca integral la fiecare sincronizare. Mutarea lor in Storage lasa in rand doar o referinta."]})}),e.jsxs("button",{onClick:xa,disabled:Q,className:"w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3",children:[Q?e.jsx(z,{className:"w-5 h-5 animate-spin"}):e.jsx($a,{className:"w-5 h-5"}),Q?"Se muta...":"Muta documentele in Storage"]})]}),Q&&M.total>0&&e.jsxs("div",{className:"mt-5 space-y-2",children:[e.jsx("div",{className:"h-2 bg-slate-100 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-emerald-500 transition-all",style:{width:`${Math.round(M.done/M.total*100)}%`}})}),e.jsxs("p",{className:"text-xs font-semibold text-slate-500 truncate",children:[M.done," / ",M.total," · ",M.label]})]}),Ue&&e.jsx("p",{className:"mt-5 text-sm font-semibold text-slate-700",children:Ue})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-6",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ya,{className:"w-10 h-10"})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Calitatea scanarilor"}),e.jsx("p",{className:"text-sm text-slate-500 font-semibold mt-1",children:"Cat de mult se comprima paginile scanate"})]})]}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-3",children:aa.map(a=>{const s=a.id===ma;return e.jsxs("button",{onClick:()=>pa(a.id),className:`text-left p-5 rounded-2xl border-2 transition ${s?"border-blue-600 bg-blue-50":"border-slate-200 bg-white hover:border-slate-300"}`,children:[e.jsxs("div",{className:"flex items-center justify-between gap-2 mb-2",children:[e.jsx("span",{className:`text-[15px] font-bold ${s?"text-blue-700":"text-slate-900"}`,children:a.label}),s&&e.jsx(te,{className:"w-4 h-4 text-blue-600 shrink-0"})]}),e.jsx("p",{className:"text-xs font-medium text-slate-500 leading-relaxed mb-3",children:a.description}),e.jsxs("p",{className:"text-[11px] font-bold text-slate-500",children:["~",a.approxKb," KB / pagina"]})]},a.id)})}),e.jsxs("p",{className:"mt-5 text-[13px] font-medium text-slate-500 leading-relaxed",children:["Cu 1 GB de spatiu, alegerea inseamna aproximativ"," ",e.jsx("span",{className:"font-bold text-slate-700",children:aa.map(a=>`${a.label}: ${Math.round(1024*1024/a.approxKb/3).toLocaleString("ro-RO")}`).join(" · ")})," ","documente de cate 3 pagini. Setarea se aplica scanarilor viitoare; cele existente raman neschimbate."]})]}),pe&&e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-indigo-100 text-indigo-600 rounded-3xl",children:e.jsx(qe,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Utilizatori & Roluri"}),e.jsx("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:"Controlul accesului in aplicatie"})]})]}),Fe&&e.jsx("div",{className:"mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl",children:e.jsx("p",{className:"text-xs font-bold text-red-600",children:Fe})}),e.jsxs("div",{className:"space-y-3 mb-8",children:[Me.length===0&&e.jsx("p",{className:"text-sm font-semibold text-slate-500 py-6 text-center",children:"Niciun cont inca. Utilizatorii se inregistreaza singuri din ecranul de autentificare."}),Me.map(a=>e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100",children:[e.jsx("div",{className:`p-2.5 rounded-xl border shrink-0 self-start ${a.approved?"bg-white text-indigo-600 border-slate-200":"bg-amber-50 text-amber-700 border-amber-200"}`,children:e.jsx(qe,{className:"w-4 h-4"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("p",{className:"text-[15px] font-bold text-slate-900 truncate",children:[a.name,a.id===(r==null?void 0:r.id)&&e.jsx("span",{className:"ml-2 text-[11px] text-blue-600 font-bold",children:"(tu)"})]}),e.jsx("p",{className:"text-xs font-semibold text-slate-500 truncate",children:a.email}),!a.approved&&e.jsx("p",{className:"text-[11px] font-bold text-amber-600 mt-0.5",children:"Asteapta aprobare"})]}),e.jsx("select",{value:a.role,onChange:s=>ba(a,s.target.value),disabled:a.id===(r==null?void 0:r.id),title:a.id===(r==null?void 0:r.id)?"Nu iti poti schimba propriul rol":"Schimba rolul",className:"px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none disabled:opacity-50",children:Object.keys(He).map(s=>e.jsx("option",{value:s,children:He[s]},s))}),e.jsx("button",{onClick:()=>ha(a),disabled:a.id===(r==null?void 0:r.id),className:`px-4 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 disabled:opacity-50 whitespace-nowrap ${a.approved?"bg-white text-slate-500 border-2 border-slate-200 hover:text-red-600 hover:border-red-200":"bg-emerald-600 text-white hover:bg-emerald-700"}`,children:a.approved?"Suspenda":"Aproba"})]},a.id))]}),e.jsxs("div",{className:"p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3",children:[e.jsx("p",{className:"text-[13px] font-bold text-slate-500",children:"Cum se adauga un utilizator"}),e.jsxs("p",{className:"text-sm font-medium text-slate-600 leading-relaxed",children:["Persoana isi creeaza singura cont din ecranul de autentificare, cu emailul si o parola proprie. Contul apare aici imediat, marcat ",e.jsx("span",{className:"font-bold text-amber-600",children:"Asteapta aprobare"}),", si nu vede niciun fel de date pana cand nu ii alegi un rol si apesi ",e.jsx("span",{className:"font-bold",children:"Aproba"}),"."]}),e.jsxs("p",{className:"text-[13px] font-semibold text-slate-500 leading-relaxed pt-1",children:["Roluri: ",e.jsx("span",{className:"text-slate-700",children:"Administrator"})," (tot, inclusiv stergeri) ·",e.jsx("span",{className:"text-slate-700",children:" Tehnician"})," (fara Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Contabil"})," (cu Financiar) ·",e.jsx("span",{className:"text-slate-700",children:" Vizualizare"})," (doar citire)"]})]})]}),e.jsxs("div",{className:"bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100",children:[e.jsxs("div",{className:"flex items-center gap-5 mb-8",children:[e.jsx("div",{className:"p-5 bg-blue-100 text-blue-600 rounded-3xl",children:e.jsx(Ja,{className:"w-10 h-10"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none",children:"Jurnal Activitate"}),e.jsxs("p",{className:"text-sm text-slate-500 font-bold uppercase tracking-widest mt-1",children:["Cine a modificat ce si cand · ultimele ",Math.min(o.length,50)," actiuni"]})]})]}),o.length===0?e.jsx("p",{className:"py-10 text-center text-xs font-bold text-slate-500 uppercase tracking-widest",children:"Nicio actiune inregistrata inca"}):e.jsx("div",{className:"space-y-2 max-h-96 overflow-y-auto pr-1",children:o.slice(0,50).map(a=>e.jsxs("div",{className:"flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100",children:[e.jsx("span",{className:`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${a.action==="delete"?"bg-red-50 text-red-500":a.action==="create"?"bg-emerald-50 text-emerald-600":"bg-blue-50 text-blue-600"}`,children:a.action==="create"?"Creat":a.action==="delete"?"Sters":"Modif."}),e.jsx("span",{className:"shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500",children:a.entity==="device"?"Dispozitiv":a.entity==="task"?"Tichet":"Factura"}),e.jsx("p",{className:"flex-1 min-w-0 text-xs font-bold text-slate-700 truncate",children:a.entityName}),e.jsx("p",{className:"shrink-0 text-[10px] font-black text-blue-600",children:a.userName}),e.jsx("p",{className:"shrink-0 text-[10px] font-mono font-bold text-slate-500",children:new Date(a.timestamp).toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})]},a.id))})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-6",children:[e.jsxs("div",{className:"bg-blue-900 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-blue-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full",children:[e.jsx("div",{className:"absolute top-0 right-0 p-8 opacity-5 pointer-events-none",children:e.jsx(Wa,{className:"w-40 h-40 text-white"})}),e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-blue-500 text-white rounded-2xl shadow-lg",children:e.jsx(y,{className:`w-5 h-5 ${ne?"animate-spin":""}`})}),e.jsx("h2",{className:"text-lg font-black text-white uppercase tracking-tight",children:"Scanare Date Vechi"})]}),e.jsx("p",{className:"text-xs text-blue-100 mb-8 leading-relaxed font-medium",children:"Forteaza o scanare a datelor vechi din browser pentru a recupera dispozitive din versiuni anterioare ale aplicatiei."}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("button",{onClick:Na,disabled:ne,className:"w-full py-4 bg-white text-blue-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50",children:[ne?e.jsx(z,{className:"w-5 h-5 animate-spin"}):e.jsx(y,{className:"w-5 h-5"}),"Ruleaza Recuperarea"]}),e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-blue-800/30 rounded-lg text-[10px] font-black text-blue-300 uppercase",children:[e.jsx("span",{children:"Inregistrari vechi gasite"}),e.jsx("span",{className:"text-white",children:ca??"0"})]})]})]})]}),e.jsxs("div",{className:"bg-slate-50 p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full",children:[e.jsxs("div",{className:"relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-4 mb-6",children:[e.jsx("div",{className:"p-3 bg-slate-900 text-white rounded-2xl shadow-lg",children:e.jsx(ea,{className:"w-5 h-5"})}),e.jsx("h2",{className:"text-lg font-black text-slate-900 uppercase tracking-tight",children:"Diagnosticare Sincronizare"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in stocarea locala"}),e.jsx("span",{className:"text-sm font-black text-slate-900",children:la??"..."})]}),e.jsxs("div",{className:"flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Dispozitive active in aplicatie"}),e.jsx("span",{className:"text-sm font-black text-blue-600",children:i.length})]}),e.jsxs("div",{className:`flex items-center justify-between p-4 rounded-2xl border ${w!==null&&w<i.length?"bg-amber-50 border-amber-200":"bg-white border-slate-100"}`,children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase",children:"Echipamente in cloud"}),e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`text-sm font-black ${w!==null&&w<i.length?"text-amber-600":"text-emerald-600"}`,children:de?"...":ce?"—":w??"?"}),e.jsx("button",{onClick:U,disabled:de,className:"p-1.5 text-slate-500 hover:text-blue-600 transition",title:"Verifica din nou","aria-label":"Verifica din nou",children:e.jsx(y,{className:`w-3.5 h-3.5 ${de?"animate-spin":""}`})})]})]}),ce&&e.jsxs("p",{className:"text-[10px] font-bold text-red-600 px-1 leading-relaxed",children:["Cloud inaccesibil: ",ce]}),w!==null&&w<i.length&&e.jsxs("div",{className:"p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3",children:[e.jsxs("p",{className:"text-[11px] font-bold text-amber-800 leading-relaxed",children:["In cloud lipsesc ",e.jsx("strong",{children:i.length-w})," echipamente. Pe alt telefon vor aparea doar cele ",w," existente in cloud. Apasa mai jos pentru a urca toate dispozitivele."]}),e.jsxs("button",{onClick:da,disabled:K,className:"w-full py-3.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[K?e.jsx(z,{className:"w-4 h-4 animate-spin"}):e.jsx(Ve,{className:"w-4 h-4"}),K?`Se urca ${Oe}...`:"Urca toate dispozitivele in cloud"]}),K&&e.jsx("div",{className:"h-2 bg-white rounded-full overflow-hidden",children:e.jsx("div",{className:"h-full bg-amber-500 transition-all duration-300",style:{width:`${i.length?Oe/i.length*100:0}%`}})})]}),e.jsxs("button",{onClick:oa,disabled:me,className:"w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60",children:[me?e.jsx(z,{className:"w-4 h-4 animate-spin"}):e.jsx(ea,{className:"w-4 h-4"}),me?"Se compara...":"Compara local cu cloud"]}),v&&e.jsx("div",{className:"p-4 bg-white border border-slate-200 rounded-2xl space-y-3",children:v.localOnly.length===0&&v.cloudOnly.length===0?e.jsx("p",{className:"text-[11px] font-bold text-emerald-700",children:"Identice — fiecare echipament local exista si in cloud."}):e.jsxs(e.Fragment,{children:[v.localOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1",children:["Doar pe acest dispozitiv (",v.localOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:v.localOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Urca toate dispozitivele" ca sa ajunga si in cloud.'})]}),v.cloudOnly.length>0&&e.jsxs("div",{children:[e.jsxs("p",{className:"text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1",children:["Doar in cloud (",v.cloudOnly.length,")"]}),e.jsx("ul",{className:"space-y-0.5 max-h-28 overflow-y-auto",children:v.cloudOnly.slice(0,20).map(a=>e.jsx("li",{className:"text-[10px] font-mono text-slate-600 truncate",children:a},a))}),e.jsx("p",{className:"text-[10px] text-slate-500 font-bold mt-1",children:'Apasa "Re-sincronizare" ca sa le aduci aici.'})]})]})}),P&&e.jsxs("div",{className:`p-4 rounded-2xl border flex items-start gap-3 ${P.ok?"bg-emerald-50 border-emerald-200":"bg-red-50 border-red-200"}`,children:[P.ok?e.jsx(se,{className:"w-5 h-5 text-emerald-600 shrink-0"}):e.jsx(Ze,{className:"w-5 h-5 text-red-600 shrink-0"}),e.jsx("p",{className:`text-[11px] font-bold leading-relaxed ${P.ok?"text-emerald-700":"text-red-700"}`,children:P.message})]})]})]}),e.jsxs("div",{className:"mt-6 pt-4 border-t border-slate-200 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("span",{className:"text-[10px] font-black text-slate-500 uppercase tracking-widest",children:"Versiune aplicatie"}),e.jsx("span",{className:"text-[10px] font-mono font-bold text-slate-600",children:ot})]}),e.jsxs("button",{onClick:Ea,className:"w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center justify-center gap-2",children:[e.jsx(y,{className:"w-3.5 h-3.5"})," Forteaza reincarcarea aplicatiei"]})]})]})]}),e.jsx(sa,{open:Sa,tone:"neutral",title:"Deconectezi cloud-ul?",icon:e.jsx(Ha,{className:"w-8 h-8 sm:w-10 sm:h-10"}),body:e.jsx(e.Fragment,{children:"Aplicatia trece in modul doar local pe acest dispozitiv. Datele salvate raman, dar nu se mai sincronizeaza pana la o reconectare."}),confirmLabel:"Deconecteaza",cancelLabel:"Ramai conectat",onCancel:()=>xe(!1),onConfirm:()=>{ka(),xe(!1)}})]})};export{ft as default};
