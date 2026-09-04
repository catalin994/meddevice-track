/**
 * Indreptarea unei pagini fotografiate.
 *
 * Pana acum, ce vedea camera ajungea direct in JPEG. Iar camera vede altceva
 * decat scannerul: mana care tine telefonul isi lasa umbra peste jumatate de
 * foaie, lampa din tavan face un colt mai luminos decat celalalt, iar becul
 * cald ingalbeneste hartia. Documentul se citeste, dar arata a poza a unei
 * hartii, nu a scan — si OCR-ul se impiedica exact in partea umbrita.
 *
 * Reteta e cea folosita de orice scanner de buzunar, si sta in trei pasi:
 *
 *   1. Se masoara lumina, nu documentul. Pagina se imparte in patrate, si in
 *      fiecare se ia o valoare din partea luminoasa — adica hartia, nu cerneala.
 *      Iese o harta grosiera a iluminarii: unde bate lampa e mare, sub umbra e
 *      mica. Se face pe fiecare canal in parte, ca sa se duca odata cu umbra si
 *      culoarea becului.
 *   2. Se imparte imaginea la harta asta. Unde lumina a fost putina se
 *      inmulteste mai tare, unde a fost multa mai putin — si hartia iese la fel
 *      de alba peste tot. Cerneala, fiind mult mai inchisa decat hartia din
 *      jurul ei, ramane inchisa.
 *   3. Se intinde contrastul intre negrul cel mai adanc si alb, ca literele sa
 *      fie negre, nu gri.
 *
 * Ce nu face, si de ce:
 *
 *   - Nu binarizeaza. O pagina adusa la alb si negru pierde stampila albastra,
 *     semnatura cu pix albastru si orice poza din raportul de service. Ramane
 *     color; cine vrea alb-negru o cere din setarea de calitate.
 *   - Nu forteaza. Toate pragurile sunt limitate, ca o pagina care e de fapt o
 *     fotografie — un aparat fotografiat pentru fisa lui — sa iasa mai luminoasa,
 *     nu arsa.
 */

/** Cat de mare e un patrat din harta luminii, ca parte din latura lunga. */
const PATRAT = 1 / 24;
/** Din ce parte a patratului se ia "hartia": 80% din pixeli sunt sub ea. */
const CUANTILA_HARTIE = 0.8;
/** Sub atat nu se coboara punctul de negru — altfel o poza intreaga s-ar arde. */
const NEGRU_MAXIM = 145;

/** Harta luminii, un canal, la rezolutia grosiera a patratelor. */
const hartaLuminii = (
  date: Uint8ClampedArray, w: number, h: number, canal: number,
  gw: number, gh: number, pasX: number, pasY: number,
): Float32Array => {
  const harta = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * pasX, x1 = Math.min(w, x0 + pasX);
      const y0 = gy * pasY, y1 = Math.min(h, y0 + pasY);
      hist.fill(0);
      let n = 0;
      // Se sare din doi in doi pixeli: harta e grosiera oricum, iar la o pagina
      // de opt megapixeli asta injumatateste de doua ori munca.
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          hist[date[(y * w + x) * 4 + canal]]++;
          n++;
        }
      }
      if (n === 0) { harta[gy * gw + gx] = 255; continue; }
      let vazut = 0, val = 255;
      const prag = n * CUANTILA_HARTIE;
      for (let t = 0; t < 256; t++) {
        vazut += hist[t];
        if (vazut >= prag) { val = t; break; }
      }
      // Sub 8 nu se coboara: altfel impartirea de mai jos ar exploda intr-un
      // patrat care s-a nimerit sa fie numai cerneala.
      harta[gy * gw + gx] = Math.max(8, val);
    }
  }
  return harta;
};

/** Netezeste harta, ca trecerea de la un patrat la altul sa nu se vada. */
const netezeste = (harta: Float32Array, gw: number, gh: number, treceri = 2): Float32Array => {
  let a: Float32Array = harta;
  let b: Float32Array = new Float32Array(harta.length);
  for (let t = 0; t < treceri; t++) {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= gh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= gw) continue;
            s += a[yy * gw + xx]; n++;
          }
        }
        b[y * gw + x] = s / n;
      }
    }
    const tmp = a; a = b; b = tmp;
  }
  return a;
};

/** Valoarea hartii intr-un punct oarecare, interpolata intre patrate. */
const laPunct = (harta: Float32Array, gw: number, gh: number, fx: number, fy: number): number => {
  const x = Math.min(gw - 1, Math.max(0, fx - 0.5));
  const y = Math.min(gh - 1, Math.max(0, fy - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  const a = harta[y0 * gw + x0], b = harta[y0 * gw + x1];
  const c = harta[y1 * gw + x0], d = harta[y1 * gw + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
};

/**
 * Cat din imagine e hartie.
 *
 * Asta deosebeste o pagina de o poza, si e singurul lucru care conteaza aici:
 * o foaie e aproape numai fond luminos, cu cateva procente de cerneala pe el.
 * Un aparat fotografiat pentru fisa lui — carcasa gri pe un birou inchis, cu un
 * afisaj — n-are fond luminos aproape deloc.
 *
 * Se ia nivelul celui mai luminos sfert din imagine ca reper si se numara cati
 * pixeli ajung macar pana la o treime din el. Pe o pagina umbrita, chiar si
 * coltul cel mai intunecat trece pragul: umbra injumatateste lumina, nu o
 * stinge. Pe poza aparatului, fundalul si afisajul raman mult sub el.
 *
 * Prima incercare masura altceva — cat de aproape e fiecare pixel de fondul din
 * patratul lui — si carcasa uniforma a aparatului trecea drept hartie tocmai
 * fiindca era uniforma. Masurat pe poza de proba, indreptarea scotea 41% din
 * pixeli complet negri sau complet albi.
 */
const parteDeHartie = (d: Uint8ClampedArray, w: number, h: number): number => {
  const hist = new Uint32Array(256);
  let n = 0;
  // Din trei in trei pixeli pe fiecare directie: se cauta o proportie, nu un
  // numar exact, si asta e de noua ori mai ieftin.
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++;
      n++;
    }
  }
  if (n === 0) return 0;

  let vazut = 0, luminos = 255;
  for (let t = 255; t >= 0; t--) {
    vazut += hist[t];
    if (vazut >= n * 0.25) { luminos = t; break; }
  }
  const prag = Math.max(24, luminos / 3);

  let peste = 0;
  for (let t = Math.ceil(prag); t < 256; t++) peste += hist[t];
  return peste / n;
};

/** Sub atat nu mai e o pagina de hartie, si nu se atinge nimic. */
const HARTIE_MINIM = 0.7;

/**
 * Indreapta lumina pe o pagina deja decupata. Lucreaza pe loc, in canvas.
 *
 * Nu face nimic daca ce s-a fotografiat nu pare o hartie.
 *
 * @param canvas pagina, asa cum a iesit din camera
 * @returns adevarat daca a schimbat imaginea
 */
export const indreaptaLumina = (canvas: HTMLCanvasElement): boolean => {
  const w = canvas.width, h = canvas.height;
  if (w < 64 || h < 64) return false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Hartie sau nu — intrebarea se pune prima, ca sa nu se calculeze hartile
  // luminii degeaba pentru o poza care oricum nu se atinge.
  if (parteDeHartie(d, w, h) < HARTIE_MINIM) return false;

  const pas = Math.max(16, Math.round(Math.max(w, h) * PATRAT));
  const gw = Math.max(2, Math.ceil(w / pas));
  const gh = Math.max(2, Math.ceil(h / pas));

  // Cate o harta pe canal: umbra pleaca odata cu culoarea becului, si hartia
  // iese alba, nu galbena sub tungsten sau albastra la umbra de la fereastra.
  const harti = [0, 1, 2].map(c =>
    netezeste(hartaLuminii(d, w, h, c, gw, gh, pas, pas), gw, gh));

  /*
   * Intai impartirea, apoi masurarea negrului.
   *
   * Se strange si histograma luminantei de dupa impartire, ca punctul de negru
   * sa fie ales pe imaginea indreptata, nu pe cea cu umbra — altfel umbra ar
   * trage negrul in sus si literele din partea luminata ar ramane gri.
   */
  const histL = new Uint32Array(256);
  for (let y = 0; y < h; y++) {
    const fy = (y + 0.5) / pas;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / pas;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const fond = laPunct(harti[c], gw, gh, fx, fy);
        // 250, nu 255: hartia curata ajunge chiar sub alb, si mai ramane loc
        // pentru sclipirea unei folii sau a unei stampile umede.
        d[i + c] = Math.min(255, (d[i + c] / fond) * 250);
      }
      histL[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++;
    }
  }

  /*
   * Punctul de negru: sub cat sta 2% din pagina.
   *
   * Media ar fi tot hartie — cerneala e cateva procente dintr-o foaie scrisa.
   * Iar plafonul de mai jos e pentru cazul in care "pagina" e de fapt o poza:
   * acolo cele 2% de jos sunt deja intunecate, si fara plafon s-ar innegri tot.
   */
  const total = w * h;
  let vazut = 0, negru = 0;
  for (let t = 0; t < 256; t++) {
    vazut += histL[t];
    if (vazut >= total * 0.02) { negru = t; break; }
  }
  negru = Math.min(negru, NEGRU_MAXIM);

  // Intinderea contrastului. Se face doar daca mai e loc de intins: pe o pagina
  // care are deja negru adanc, curba ar fi o inmultire cu unu.
  if (negru > 12) {
    const scala = 255 / (250 - negru);
    const tabel = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) tabel[v] = Math.min(255, Math.max(0, (v - negru) * scala));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = tabel[d[i]];
      d[i + 1] = tabel[d[i + 1]];
      d[i + 2] = tabel[d[i + 2]];
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
};
