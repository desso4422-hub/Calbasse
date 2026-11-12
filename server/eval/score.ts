/**
 * Notation d'un scan par rapport à l'étiquette d'une photo (fonctions pures, testées).
 */
import type { ResultatScan } from '../src/reconnaissance.ts';

export type Etiquette = {
  /** Indice qu'un utilisateur aurait tapé (facultatif) */
  indice?: string;
  /** Aliments réellement présents (identifiants de la base) */
  aliments: string[];
  /** Grammes pesés, si on les connaît */
  grammes?: Record<string, number>;
};

export type NoteScan = {
  vrais: string[];
  manques: string[];
  enTrop: string[];
  /** Aliments manqués mais proposés en alternative (corrigeables en un geste) */
  rattrapables: string[];
  exact: boolean;
  /** Écarts relatifs de grammes, pour les aliments pesés et trouvés */
  ecartsGrammes: number[];
};

export function noter(scan: ResultatScan, etiquette: Etiquette): NoteScan {
  const attendus = new Set(etiquette.aliments);
  const trouves = new Set(scan.lignes.map((l) => l.alimentId));
  const vrais = [...trouves].filter((id) => attendus.has(id));
  const manques = [...attendus].filter((id) => !trouves.has(id));
  const enTrop = [...trouves].filter((id) => !attendus.has(id));
  const alternatives = new Set(scan.lignes.flatMap((l) => l.alternatives));
  const rattrapables = manques.filter((id) => alternatives.has(id));
  const ecartsGrammes = Object.entries(etiquette.grammes ?? {})
    .map(([id, g]) => {
      const l = scan.lignes.find((x) => x.alimentId === id);
      return l && g > 0 ? Math.abs(l.grammes - g) / g : null;
    })
    .filter((x): x is number => x !== null);
  return { vrais, manques, enTrop, rattrapables, exact: manques.length === 0 && enTrop.length === 0, ecartsGrammes };
}

export type Bilan = {
  photos: number;
  precision: number;
  rappel: number;
  rappelAvecAlternatives: number;
  assiettesExactes: number;
  ecartGrammesMedian: number | null;
  confusions: Record<string, number>;
};

export function resumer(notes: NoteScan[]): Bilan {
  const somme = (f: (n: NoteScan) => number) => notes.reduce((s, n) => s + f(n), 0);
  const vrais = somme((n) => n.vrais.length);
  const trouves = vrais + somme((n) => n.enTrop.length);
  const attendus = vrais + somme((n) => n.manques.length);
  const ecarts = notes.flatMap((n) => n.ecartsGrammes).sort((a, b) => a - b);
  const confusions: Record<string, number> = {};
  for (const n of notes) {
    for (const m of n.manques) {
      for (const t of n.enTrop.length ? n.enTrop : ['(rien)']) {
        const cle = `${m} → ${t}`;
        confusions[cle] = (confusions[cle] ?? 0) + 1;
      }
    }
  }
  return {
    photos: notes.length,
    precision: trouves ? vrais / trouves : 0,
    rappel: attendus ? vrais / attendus : 0,
    rappelAvecAlternatives: attendus ? (vrais + somme((n) => n.rattrapables.length)) / attendus : 0,
    assiettesExactes: notes.length ? notes.filter((n) => n.exact).length / notes.length : 0,
    ecartGrammesMedian: ecarts.length ? ecarts[Math.floor(ecarts.length / 2)] : null,
    confusions,
  };
}
