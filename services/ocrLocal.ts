/**
 * De unde isi ia OCR-ul fisierele de care are nevoie.
 *
 * tesseract.js aduce, la prima folosire, trei lucruri de pe internet: firul de
 * lucru, motorul WebAssembly si datele de limba — vreo cinci megaocteti, de pe
 * un CDN. Intr-un spital, unde reteaua trece printr-un proxy care lasa afara ce
 * nu e pe lista, incercarea esueaza, si tot ce se vedea era "PDF-ul nu a putut
 * fi citit" — un mesaj care nu spune nimic despre ce s-a intamplat.
 *
 * Asa ca fisierele stau acum in aplicatie, in public/ocr, si se cer de pe
 * acelasi server ca restul ei. Trebuie sa isi pastreze numele exacte: tesseract
 * alcatuieste singur adresele, pornind de la folder — "<corePath>/tesseract-
 * core-simd-lstm.wasm", "<langPath>/ron.traineddata.gz" — deci nu pot trece
 * prin build, care le-ar pune o amprenta in nume.
 *
 * Nu se precacheaza: se descarca doar cand cineva chiar deschide un document
 * scanat, si raman apoi in cache-ul browserului.
 */

const folder = `${import.meta.env.BASE_URL}ocr`;

export const optiuniOcr = () => ({
  workerPath: `${folder}/worker.min.js`,
  // Folder, nu fisier: motorul potrivit procesorului il alege tesseract.
  corePath: folder,
  langPath: folder,
  // Fara asta, firul de lucru s-ar incarca tot de pe internet.
  workerBlobURL: false,
});

/** Adresele, ca sa se poata spune in ecran de unde s-a incercat. */
export const adreseOcr = { folder };
