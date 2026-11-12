/**
 * Plats composés courants : ce que la reconnaissance propose quand elle identifie une assiette.
 * Grammes pour une portion « Moyenne ». Valeurs d'illustration (voir aliments.ts).
 */
import { normaliser } from './aliments.ts';

export type LigneRepas = { alimentId: string; grammes: number };

export type PlatCompose = {
  id: string;
  nom: string;
  lignes: LigneRepas[];
  /** Noms complets du plat : un seul suffit (« garba », « abobo ») */
  noms: string[];
  /** Composants : il faut les retrouver tous (chaque groupe liste des variantes) */
  composants: string[][];
};

export const platsComposes: PlatCompose[] = [
  {
    id: 'riz-gras-poulet',
    nom: 'Riz au gras, poulet frit',
    lignes: [
      { alimentId: 'riz-au-gras', grammes: 300 },
      { alimentId: 'poulet-frit', grammes: 140 },
      { alimentId: 'sauce-tomate', grammes: 60 },
    ],
    noms: [],
    composants: [['riz au gras', 'riz gras', 'jollof'], ['poulet']],
  },
  {
    id: 'pain-omelette',
    nom: 'Pain-omelette',
    lignes: [
      { alimentId: 'pain', grammes: 125 },
      { alimentId: 'omelette', grammes: 120 },
    ],
    noms: ['pain omelette'],
    composants: [['pain'], ['omelette']],
  },
  {
    id: 'attieke-poisson',
    nom: 'Attiéké, poisson braisé',
    lignes: [
      { alimentId: 'attieke', grammes: 240 },
      { alimentId: 'poisson-braise', grammes: 150 },
    ],
    noms: ['garba'],
    composants: [['attieke'], ['poisson']],
  },
  {
    id: 'pate-rouge-poisson',
    nom: 'Pâte rouge, poisson frit',
    lignes: [
      { alimentId: 'pate-rouge', grammes: 300 },
      { alimentId: 'poisson-frit', grammes: 150 },
      { alimentId: 'sauce-tomate', grammes: 60 },
    ],
    noms: [],
    composants: [['pate rouge', 'amiwo'], ['poisson']],
  },
  {
    id: 'akassa-graine',
    nom: 'Akassa, sauce graine, poisson',
    lignes: [
      { alimentId: 'akassa', grammes: 300 },
      { alimentId: 'sauce-graine', grammes: 160 },
      { alimentId: 'poisson-frit', grammes: 100 },
    ],
    noms: [],
    composants: [['akassa'], ['graine'], ['poisson']],
  },
  {
    id: 'pate-gombo',
    nom: 'Pâte, sauce gombo, viande',
    lignes: [
      { alimentId: 'pate-blanche', grammes: 300 },
      { alimentId: 'sauce-gombo', grammes: 160 },
      { alimentId: 'boeuf', grammes: 100 },
    ],
    noms: [],
    composants: [['pate', 'owo', 'wo'], ['gombo'], ['viande', 'boeuf']],
  },
  {
    id: 'igname-arachide',
    nom: 'Igname pilée, sauce arachide',
    lignes: [
      { alimentId: 'igname-pilee', grammes: 300 },
      { alimentId: 'sauce-arachide', grammes: 160 },
      { alimentId: 'boeuf', grammes: 80 },
    ],
    noms: [],
    composants: [['igname'], ['arachide']],
  },
  {
    id: 'haricots-gari',
    nom: 'Haricots, gari, alloco',
    lignes: [
      { alimentId: 'haricots', grammes: 250 },
      { alimentId: 'gari', grammes: 40 },
      { alimentId: 'alloco', grammes: 100 },
    ],
    noms: ['abobo', 'atassi', 'waakye'],
    composants: [['haricot', 'niebe'], ['gari'], ['alloco']],
  },
  {
    id: 'spaghetti-oeuf',
    nom: 'Spaghetti, œuf',
    lignes: [
      { alimentId: 'spaghetti', grammes: 300 },
      { alimentId: 'oeuf', grammes: 100 },
      { alimentId: 'sauce-tomate', grammes: 60 },
    ],
    noms: [],
    composants: [['spaghetti'], ['oeuf', 'oeufs']],
  },
  {
    id: 'alloco-poisson',
    nom: 'Alloco, poisson braisé',
    lignes: [
      { alimentId: 'alloco', grammes: 200 },
      { alimentId: 'poisson-braise', grammes: 150 },
    ],
    noms: [],
    composants: [['alloco', 'dodo'], ['poisson']],
  },
];

export function trouverPlat(id: string): PlatCompose | undefined {
  return platsComposes.find((p) => p.id === id);
}

/** Nom lisible d'une liste d'aliments : « Riz au gras, poulet frit ». */
export function nommerRepas(noms: string[]): string {
  if (noms.length === 0) return 'Repas';
  const [premier, ...reste] = noms;
  return [premier, ...reste.map((n) => n.charAt(0).toLowerCase() + n.slice(1))].join(', ');
}

export function chercherPlatParTexte(texte: string): PlatCompose | undefined {
  const t = ` ${normaliser(texte)} `;
  if (!t.trim()) return undefined;
  const contient = (mot: string) => t.includes(` ${normaliser(mot)} `);
  let meilleur: { plat: PlatCompose; score: number } | undefined;
  for (const plat of platsComposes) {
    const parNom = plat.noms.filter(contient);
    const groupes = plat.composants.map((g) => g.filter(contient));
    const tousComposants = groupes.every((g) => g.length > 0);
    if (parNom.length === 0 && !tousComposants) continue;
    const score = [...parNom, ...(tousComposants ? groupes.flat() : [])].reduce((s, m) => s + m.length, 0);
    if (!meilleur || score > meilleur.score) meilleur = { plat, score };
  }
  return meilleur?.plat;
}
