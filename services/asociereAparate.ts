import { MedicalDevice } from '../types';

/**
 * Ce aparate din inventar sunt de fapt pe factura.
 *
 * Regula de pana acum cauta numarul de serie ca simplu sir in textul facturii,
 * de la trei caractere in sus. Doua feluri de greseli, amandoua tacute:
 *
 *   gasea ce nu trebuia — o serie "440" se potriveste in "1.440,00", deci
 *   factura primea un aparat pe care nu-l pomeneste nicaieri;
 *
 *   nu gasea ce trebuia — seria e scrisa pe factura altfel decat in inventar
 *   ("TR-825-CM18" fata de "TR825CM18"), sau nu e scrisa deloc, si atunci
 *   aparatul se recunoaste doar dupa denumire si model.
 *
 * Aici fiecare potrivire vine cu motivul ei, ca sa se vada ce a decis si sa
 * poata fi corectata. Nimic nu se leaga fara sa poata fi spus de ce.
 */

export interface Potrivire {
  deviceId: string;
  /** "seria 0265171026A007799", "model SN-50C6", "contract CTR-88" */
  motiv: string;
  /** Cat de sigura e: seria bate modelul, modelul bate contractul. */
  putere: 'serie' | 'model' | 'nume' | 'contract';
}

const PUTERI: Record<Potrivire['putere'], number> = { serie: 4, model: 3, nume: 2, contract: 1 };

/** Fara diacritice, litere mici. */
const fara = (s: string): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[șşȘŞ]/g, 's').replace(/[țţȚŢ]/g, 't').toLowerCase();

/** Doar litere si cifre — cum arata o serie cand ii scoti cratimele. */
const doarAlfaNum = (s: string): string => fara(s).replace(/[^a-z0-9]/g, '');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cauta un cod (serie, model) in text, ingaduind separatori intre caractere.
 *
 * "TR825CM18" trebuie sa se gaseasca si scris "TR-825-CM18" sau "TR 825 CM 18".
 * Marginile conteaza: fara ele, seria "2617" s-ar potrivi in mijlocul lui
 * "26173600" si ar lega un aparat strain.
 */
const contineCodul = (textNorm: string, cod: string): boolean => {
  const c = doarAlfaNum(cod);
  if (c.length < 3) return false;
  const corp = c.split('').map(escapeRe).join('[\\s.\\-\\/_]*');
  return new RegExp(`(^|[^a-z0-9])${corp}($|[^a-z0-9])`, 'i').test(textNorm);
};

/** Un cod bun de cautat: are si litere si cifre, sau e destul de lung. */
const codDeIncredere = (cod: string, minim = 5): boolean => {
  const c = doarAlfaNum(cod);
  if (c.length < 4) return false;
  const areLitera = /[a-z]/.test(c);
  const areCifra = /[0-9]/.test(c);
  // "SN50C6" — litere si cifre laolalta — e distinctiv de la patru caractere.
  // "12345" — numai cifre — se poate lovi de o suma sau de un numar de factura.
  return (areLitera && areCifra) || c.length >= minim;
};

/** Cuvintele care nu deosebesc nimic: apar pe jumatate din aparate. */
const CUVINTE_GENERICE = new Set([
  'aparat', 'aparatura', 'medical', 'medicala', 'sistem', 'echipament', 'set',
  'monitor', 'unitate', 'modul', 'mobil', 'portabil', 'digital', 'de', 'cu', 'si',
  'pentru', 'tip', 'model', 'seria', 'serie', 'nr', 'buc', 'noi', 'nou',
]);

const cuvinteDistinctive = (s: string): string[] =>
  fara(s).split(/[^a-z0-9]+/).filter(c => c.length >= 4 && !CUVINTE_GENERICE.has(c));

/**
 * Aparatele de pe o factura, fiecare cu motivul.
 *
 * `text` e factura intreaga; `denumire` e randul de marfa, care conteaza mai
 * mult — acolo scrie ce s-a reparat, in timp ce restul paginii are adrese,
 * conturi si coduri fiscale in care orice serie scurta s-ar putea nimeri.
 */
export const potrivesteAparate = (
  text: string,
  denumire: string,
  contractNumber: string,
  devices: MedicalDevice[],
): Potrivire[] => {
  const totul = fara(text);
  const marfa = fara(denumire);
  const gasite = new Map<string, Potrivire>();

  const pune = (deviceId: string, motiv: string, putere: Potrivire['putere']) => {
    const vechi = gasite.get(deviceId);
    if (!vechi || PUTERI[putere] > PUTERI[vechi.putere]) gasite.set(deviceId, { deviceId, motiv, putere });
  };

  for (const d of devices) {
    // Un aparat casat nu mai primeste facturi.
    if (d.status === 'Retired') continue;

    // ── seria, oriunde pe factura ──
    const serie = (d.serialNumber || '').trim();
    if (serie && serie.toUpperCase() !== 'N/A' && codDeIncredere(serie, 6) && contineCodul(totul, serie)) {
      pune(d.id, `seria ${serie}`, 'serie');
      continue;
    }

    // ── modelul, dar numai in randul de marfa ──
    // Pe restul paginii "C3" sau "SE-3" s-ar lovi de orice cod din antet.
    const model = (d.model || '').trim();
    if (model && codDeIncredere(model, 5) && marfa && contineCodul(marfa, model)) {
      pune(d.id, `model ${model}`, 'model');
      continue;
    }

    // ── denumirea: doua cuvinte distinctive, sau unul plus producatorul ──
    const aleAparatului = cuvinteDistinctive(`${d.name} ${d.manufacturer || ''}`);
    const potrivite = aleAparatului.filter(c => marfa.includes(c));
    const areProducator = !!d.manufacturer && cuvinteDistinctive(d.manufacturer).some(c => marfa.includes(c));
    if (potrivite.length >= 2 || (potrivite.length >= 1 && areProducator)) {
      pune(d.id, `denumire: ${potrivite.slice(0, 2).join(' + ')}`, 'nume');
    }
  }

  // ── contractul: acopera aparatele pe care e trecut ──
  const nrContract = (contractNumber || '').trim();
  if (nrContract) {
    for (const d of devices) {
      if (d.status === 'Retired') continue;
      if ((d.contracts || []).some(c => c.contractNumber
          && doarAlfaNum(c.contractNumber) === doarAlfaNum(nrContract))) {
        pune(d.id, `contract ${nrContract}`, 'contract');
      }
    }
  }

  /*
   * Cand factura numeste un aparat anume prin serie, gemenii lui nu au ce cauta
   * pe ea. Doua injectomate identice se potrivesc amandoua dupa denumire
   * ("Injectomat Sinomedical"), dar seria scrisa pe hartie spune care din ele a
   * fost reparat — celalalt ar intra pe tacute in dosarul altei interventii.
   *
   * Se scot doar gemenii: un aparat cu alta denumire, gasit tot dupa denumire,
   * ramane. O factura poate lista trei aparate, doua cu serie si unul fara.
   */
  const semnaturaGeamana = new Set(
    [...gasite.values()].filter(x => x.putere === 'serie')
      .map(x => devices.find(d => d.id === x.deviceId))
      .filter(Boolean)
      .map(d => `${fara(d!.name)}|${fara(d!.model || '')}`),
  );
  if (semnaturaGeamana.size > 0) {
    for (const [id, p] of [...gasite]) {
      if (p.putere !== 'nume' && p.putere !== 'model') continue;
      const d = devices.find(x => x.id === id);
      if (d && semnaturaGeamana.has(`${fara(d.name)}|${fara(d.model || '')}`)) gasite.delete(id);
    }
  }

  return [...gasite.values()].sort((a, b) => PUTERI[b.putere] - PUTERI[a.putere]);
};

/**
 * Potrivirile care se leaga singure.
 *
 * Seria si modelul sunt destul de sigure. Denumirea si contractul se propun,
 * dar nu se bifeaza: un contract de mentenanta acopera cincizeci de aparate,
 * si nu toate sunt pe factura de luna asta.
 */
export const deLegatSingur = (p: Potrivire[]): string[] =>
  p.filter(x => x.putere === 'serie' || x.putere === 'model').map(x => x.deviceId);
