/**
 * Mode coach : données de démonstration.
 * À terme, ces clients viendront du serveur (comptes reliés coach ↔ client).
 */
import { appliquerPortion, arrondirNutriments, totalRepas, type Huile, type Portion } from './nutrition.ts';
import type { LigneRepas } from './plats.ts';

export type StatutRepasClient = 'aCorriger' | 'valide';

export type ClientCoach = {
  id: string;
  nom: string;
  initiales: string;
  /** Repas le plus récent envoyé par le client, ou null s'il est inactif */
  repas: null | {
    nom: string;
    creneau: string;
    heure: string;
    lignes: LigneRepas[];
    /** Estimation de l'IA au moment de l'envoi */
    huileEstimee: Huile;
    statut: StatutRepasClient;
    correction?: { portion: Portion; huile: Huile; message?: string };
  };
  joursSansRepas?: number;
};

export const clientsDemo: ClientCoach[] = [
  {
    id: 'aicha',
    nom: 'Aïcha K.',
    initiales: 'AK',
    repas: {
      nom: 'Riz au gras, poulet frit',
      creneau: 'Déjeuner',
      heure: '13:10',
      lignes: [
        { alimentId: 'riz-au-gras', grammes: 300 },
        { alimentId: 'poulet-frit', grammes: 140 },
        { alimentId: 'sauce-tomate', grammes: 60 },
      ],
      huileEstimee: 'normal',
      statut: 'aCorriger',
    },
  },
  {
    id: 'romaric',
    nom: 'Romaric D.',
    initiales: 'RD',
    repas: {
      nom: 'Pâte rouge, poisson frit',
      creneau: 'Déjeuner',
      heure: '12:40',
      lignes: [
        { alimentId: 'pate-rouge', grammes: 300 },
        { alimentId: 'poisson-frit', grammes: 150 },
        { alimentId: 'sauce-tomate', grammes: 60 },
      ],
      huileEstimee: 'normal',
      statut: 'aCorriger',
    },
  },
  {
    id: 'flore',
    nom: 'Flore S.',
    initiales: 'FS',
    repas: {
      nom: 'Attiéké, poisson braisé',
      creneau: 'Déjeuner',
      heure: '12:05',
      lignes: [
        { alimentId: 'attieke', grammes: 240 },
        { alimentId: 'poisson-braise', grammes: 150 },
      ],
      huileEstimee: 'normal',
      statut: 'valide',
    },
  },
  {
    id: 'ulrich',
    nom: 'Ulrich M.',
    initiales: 'UM',
    repas: {
      nom: 'Pain-omelette',
      creneau: 'Petit-déjeuner',
      heure: '08:15',
      lignes: [
        { alimentId: 'pain', grammes: 125 },
        { alimentId: 'omelette', grammes: 120 },
      ],
      huileEstimee: 'normal',
      statut: 'valide',
    },
  },
  {
    id: 'nadege',
    nom: 'Nadège H.',
    initiales: 'NH',
    repas: {
      nom: 'Spaghetti, œuf',
      creneau: 'Dîner',
      heure: 'hier, 20:30',
      lignes: [
        { alimentId: 'spaghetti', grammes: 300 },
        { alimentId: 'oeuf', grammes: 100 },
        { alimentId: 'sauce-tomate', grammes: 60 },
      ],
      huileEstimee: 'normal',
      statut: 'aCorriger',
    },
  },
  {
    id: 'jonas',
    nom: 'Jonas A.',
    initiales: 'JA',
    repas: {
      nom: 'Akassa, sauce graine, poisson',
      creneau: 'Dîner',
      heure: 'hier, 19:50',
      lignes: [
        { alimentId: 'akassa', grammes: 300 },
        { alimentId: 'sauce-graine', grammes: 160 },
        { alimentId: 'poisson-frit', grammes: 100 },
      ],
      huileEstimee: 'normal',
      statut: 'aCorriger',
    },
  },
  {
    id: 'koffi',
    nom: 'Koffi B.',
    initiales: 'KB',
    repas: {
      nom: 'Haricots, gari, alloco',
      creneau: 'Petit-déjeuner',
      heure: 'hier, 09:00',
      lignes: [
        { alimentId: 'haricots', grammes: 250 },
        { alimentId: 'gari', grammes: 40 },
        { alimentId: 'alloco', grammes: 100 },
      ],
      huileEstimee: 'normal',
      statut: 'aCorriger',
    },
  },
  {
    id: 'sena',
    nom: 'Sèna P.',
    initiales: 'SP',
    repas: null,
    joursSansRepas: 3,
  },
  {
    id: 'mariam',
    nom: 'Mariam T.',
    initiales: 'MT',
    repas: null,
    joursSansRepas: 5,
  },
];

export const reponsesRapides = ["Réduis le riz d'un tiers", 'Ajoute 2 œufs', 'Moins d’huile la prochaine fois', 'Bravo, assiette équilibrée'];

/** Total du dernier repas d'un client, correction du coach comprise. */
export function totalClient(c: ClientCoach) {
  if (!c.repas) return null;
  const corr = c.repas.correction;
  const lignes = corr ? appliquerPortion(c.repas.lignes, corr.portion) : c.repas.lignes;
  return arrondirNutriments(totalRepas(lignes, corr ? corr.huile : c.repas.huileEstimee));
}
