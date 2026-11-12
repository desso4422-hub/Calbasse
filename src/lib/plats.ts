/**
 * Plats composés courants : ce que la reconnaissance propose quand elle identifie une assiette.
 * Grammes pour une portion « Moyenne ». Valeurs d'illustration (voir aliments.ts).
 */
import { normaliser } from './aliments.ts';

export type Confiance = 'haute' | 'moyenne' | 'basse';

export type LigneRepas = {
  alimentId: string;
  grammes: number;
  /** Renseignés quand la ligne vient de la reconnaissance photo */
  confiance?: Confiance;
  alternatives?: string[];
};

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
    noms: [],
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
  {
    id: 'garba',
    nom: 'Garba (attiéké, thon frit)',
    lignes: [
      { alimentId: 'attieke', grammes: 250 },
      { alimentId: 'thon-frit', grammes: 120 },
      { alimentId: 'piment', grammes: 20 },
    ],
    noms: ['garba'],
    composants: [['attieke'], ['thon']],
  },
  {
    id: 'thieboudienne',
    nom: 'Thiéboudienne',
    lignes: [
      { alimentId: 'riz-thieb', grammes: 300 },
      { alimentId: 'poisson-frit', grammes: 120 },
      { alimentId: 'legumes-cuits', grammes: 120 },
    ],
    noms: ['thieboudienne', 'ceebu jen', 'thieb', 'tieb'],
    composants: [['riz au poisson']],
  },
  {
    id: 'yassa-poulet',
    nom: 'Yassa poulet',
    lignes: [
      { alimentId: 'riz-blanc', grammes: 250 },
      { alimentId: 'poulet-braise', grammes: 140 },
      { alimentId: 'sauce-yassa', grammes: 150 },
    ],
    noms: ['yassa', 'yassa poulet'],
    composants: [['riz'], ['oignon'], ['poulet']],
  },
  {
    id: 'mafe',
    nom: 'Mafé, riz blanc',
    lignes: [
      { alimentId: 'riz-blanc', grammes: 250 },
      { alimentId: 'sauce-arachide', grammes: 160 },
      { alimentId: 'boeuf', grammes: 100 },
      { alimentId: 'legumes-cuits', grammes: 80 },
    ],
    noms: ['mafe', 'mafé', 'domoda'],
    composants: [['riz'], ['arachide']],
  },
  {
    id: 'ndole-plantain',
    nom: 'Ndolè, plantain, crevettes',
    lignes: [
      { alimentId: 'ndole', grammes: 200 },
      { alimentId: 'banane-plantain', grammes: 180 },
      { alimentId: 'crevettes', grammes: 50 },
    ],
    noms: ['ndole', 'ndolè', 'ndolé'],
    composants: [],
  },
  {
    id: 'eru-fufu',
    nom: 'Eru, water fufu',
    lignes: [
      { alimentId: 'eru', grammes: 200 },
      { alimentId: 'foufou', grammes: 250 },
      { alimentId: 'peau-boeuf', grammes: 60 },
    ],
    noms: ['eru', 'okok'],
    composants: [],
  },
  {
    id: 'egusi-eba',
    nom: 'Egusi, eba',
    lignes: [
      { alimentId: 'sauce-egusi', grammes: 160 },
      { alimentId: 'eba', grammes: 250 },
      { alimentId: 'boeuf', grammes: 80 },
    ],
    noms: ['egusi'],
    composants: [],
  },
  {
    id: 'waakye-complet',
    nom: 'Waakye complet',
    lignes: [
      { alimentId: 'waakye', grammes: 300 },
      { alimentId: 'spaghetti', grammes: 60 },
      { alimentId: 'oeuf', grammes: 50 },
      { alimentId: 'sauce-tomate', grammes: 60 },
      { alimentId: 'gari', grammes: 20 },
    ],
    noms: ['waakye', 'ayimolou'],
    composants: [],
  },
  {
    id: 'placali-sauce-claire',
    nom: 'Placali, sauce claire',
    lignes: [
      { alimentId: 'placali', grammes: 250 },
      { alimentId: 'sauce-claire', grammes: 200 },
      { alimentId: 'poisson-fume', grammes: 50 },
    ],
    noms: ['placali'],
    composants: [],
  },
  {
    id: 'foutou-graine',
    nom: 'Foutou banane, sauce graine',
    lignes: [
      { alimentId: 'foutou-banane', grammes: 250 },
      { alimentId: 'sauce-graine', grammes: 160 },
      { alimentId: 'poulet-braise', grammes: 100 },
    ],
    noms: [],
    composants: [['foutou'], ['graine']],
  },
  {
    id: 'attieke-kedjenou',
    nom: 'Kedjenou, attiéké',
    lignes: [
      { alimentId: 'attieke', grammes: 250 },
      { alimentId: 'kedjenou', grammes: 250 },
    ],
    noms: ['kedjenou', 'kédjénou'],
    composants: [],
  },
  {
    id: 'ablo-poisson',
    nom: 'Ablo, poisson frit',
    lignes: [
      { alimentId: 'ablo', grammes: 150 },
      { alimentId: 'poisson-frit', grammes: 120 },
      { alimentId: 'piment', grammes: 20 },
    ],
    noms: ['ablo'],
    composants: [],
  },
  {
    id: 'kenkey-poisson',
    nom: 'Kenkey, poisson frit',
    lignes: [
      { alimentId: 'kenkey', grammes: 200 },
      { alimentId: 'poisson-frit', grammes: 120 },
      { alimentId: 'piment', grammes: 20 },
    ],
    noms: ['kenkey', 'dokounou'],
    composants: [],
  },
  {
    id: 'banku-okro',
    nom: 'Banku, sauce gombo',
    lignes: [
      { alimentId: 'banku', grammes: 250 },
      { alimentId: 'sauce-gombo', grammes: 160 },
      { alimentId: 'poisson-fume', grammes: 50 },
    ],
    noms: ['banku', 'akple'],
    composants: [],
  },
  {
    id: 'to-feuilles',
    nom: 'Tô, sauce feuilles',
    lignes: [
      { alimentId: 'to-mil', grammes: 300 },
      { alimentId: 'sauce-feuilles', grammes: 160 },
    ],
    noms: ['to', 'tô', 'tuo zaafi'],
    composants: [],
  },
  {
    id: 'bouillie-beignets',
    nom: 'Bouillie, beignets',
    lignes: [
      { alimentId: 'bouillie', grammes: 300 },
      { alimentId: 'beignets', grammes: 90 },
    ],
    noms: [],
    composants: [['bouillie', 'koko'], ['beignet', 'beignets', 'puff puff']],
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
    const tousComposants = groupes.length > 0 && groupes.every((g) => g.length > 0);
    if (parNom.length === 0 && !tousComposants) continue;
    const score = [...parNom, ...(tousComposants ? groupes.flat() : [])].reduce((s, m) => s + m.length, 0);
    if (!meilleur || score > meilleur.score) meilleur = { plat, score };
  }
  return meilleur?.plat;
}
