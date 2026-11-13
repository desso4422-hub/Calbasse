/**
 * État de l'app, gardé sur le téléphone (AsyncStorage). Pas de compte ni de serveur pour l'instant.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { clientsDemo, type ClientCoach } from '../lib/coach.ts';
import type { EtatCompteServeur } from '../services/api';
import { ajouterJours, calculerCibles, cleJour, heure, type Cibles, type Huile, type Mesures, type Portion } from '../lib/nutrition.ts';
import { trouverPlat, type LigneRepas } from '../lib/plats.ts';

export type Creneau = 'petitDej' | 'dejeuner' | 'collation' | 'diner';

export const nomsCreneaux: Record<Creneau, string> = {
  petitDej: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  collation: 'Collation',
  diner: 'Dîner',
};

export const ordreCreneaux: Creneau[] = ['petitDej', 'dejeuner', 'collation', 'diner'];

export function creneauPourHeure(d: Date): Creneau {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 10.5) return 'petitDej';
  if (h < 15.5) return 'dejeuner';
  if (h < 18) return 'collation';
  return 'diner';
}

export type Repas = {
  id: string;
  jour: string; // AAAA-MM-JJ
  heure: string; // HH:MM
  creneau: Creneau;
  nom: string;
  /** Grammes réels (portion déjà appliquée) */
  lignes: LigneRepas[];
  huile: Huile;
  photoUri?: string;
};

export type Profil = {
  prenom: string;
  mesures: Mesures;
  cibles: Cibles;
};

export type Abonnement = { plan: 'mensuel' | 'annuel'; jusquau: string };

export type Signalement = { jour: string; alimentId: string; repasNom: string };

export type Etat = {
  version: 1;
  profil: Profil | null;
  repas: Repas[];
  scans: { jour: string; nombre: number };
  abonnement: Abonnement | null;
  clients: ClientCoach[];
  signalements: Signalement[];
  /** Dernier état du compte renvoyé par le serveur (il fait foi pour Premium et les scans) */
  serveur?: { jour: string; scansRestants: number; limite: number; telephone?: string | null };
};

export const SCANS_GRATUITS = 2;
export const SCANS_PREMIUM = 30;

const etatInitial: Etat = {
  version: 1,
  profil: null,
  repas: [],
  scans: { jour: '', nombre: 0 },
  abonnement: null,
  clients: clientsDemo,
  signalements: [],
};

type Action =
  | { type: 'hydrater'; etat: Etat }
  | { type: 'definirProfil'; prenom: string; mesures: Mesures }
  | { type: 'enregistrerRepas'; repas: Repas }
  | { type: 'supprimerRepas'; id: string }
  | { type: 'compterScan' }
  | { type: 'activerAbonnement'; abonnement: Abonnement }
  | { type: 'majCompteServeur'; compte: EtatCompteServeur }
  | { type: 'annulerAbonnement' }
  | { type: 'corrigerClient'; id: string; portion: Portion; huile: Huile; message?: string }
  | { type: 'relancerClient'; id: string }
  | { type: 'signaler'; signalement: Signalement }
  | { type: 'chargerDemo' }
  | { type: 'reinitialiser' };

function reducteur(etat: Etat, action: Action): Etat {
  switch (action.type) {
    case 'hydrater':
      return action.etat;
    case 'definirProfil':
      return {
        ...etat,
        profil: { prenom: action.prenom, mesures: action.mesures, cibles: calculerCibles(action.mesures) },
      };
    case 'enregistrerRepas': {
      const autres = etat.repas.filter((r) => r.id !== action.repas.id);
      return { ...etat, repas: [...autres, action.repas] };
    }
    case 'supprimerRepas':
      return { ...etat, repas: etat.repas.filter((r) => r.id !== action.id) };
    case 'compterScan': {
      const jour = cleJour(new Date());
      const nombre = etat.scans.jour === jour ? etat.scans.nombre + 1 : 1;
      return { ...etat, scans: { jour, nombre } };
    }
    case 'activerAbonnement':
      return { ...etat, abonnement: action.abonnement };
    case 'majCompteServeur':
      return {
        ...etat,
        abonnement: action.compte.premium,
        serveur: {
          jour: cleJour(new Date()),
          scansRestants: action.compte.scansRestants,
          limite: action.compte.limite,
          telephone: action.compte.telephone ?? null,
        },
      };
    case 'annulerAbonnement':
      return { ...etat, abonnement: null };
    case 'corrigerClient':
      return {
        ...etat,
        clients: etat.clients.map((c) =>
          c.id === action.id && c.repas
            ? {
                ...c,
                repas: {
                  ...c.repas,
                  statut: 'valide',
                  correction: { portion: action.portion, huile: action.huile, message: action.message },
                },
              }
            : c,
        ),
      };
    case 'relancerClient':
      return { ...etat, clients: etat.clients.map((c) => (c.id === action.id ? { ...c, joursSansRepas: 0 } : c)) };
    case 'signaler':
      return { ...etat, signalements: [...etat.signalements, action.signalement] };
    case 'chargerDemo':
      return { ...etat, repas: [...etat.repas.filter((r) => !r.id.startsWith('demo-')), ...repasDemo(new Date())] };
    case 'reinitialiser':
      return { ...etatInitial };
  }
}

const CLE = 'calbasse:etat:v1';

type Valeur = {
  etat: Etat;
  pret: boolean;
  dispatch: (a: Action) => void;
};

const Contexte = createContext<Valeur | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [etat, dispatch] = useReducer(reducteur, etatInitial);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLE)
      .then((brut) => {
        if (brut) {
          const lu = JSON.parse(brut) as Etat;
          if (lu.version === 1) dispatch({ type: 'hydrater', etat: { ...etatInitial, ...lu } });
        }
      })
      .catch(() => {})
      .finally(() => setPret(true));
  }, []);

  useEffect(() => {
    if (!pret) return;
    AsyncStorage.setItem(CLE, JSON.stringify(etat)).catch(() => {});
  }, [etat, pret]);

  const valeur = useMemo(() => ({ etat, pret, dispatch }), [etat, pret]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useStore(): Valeur {
  const v = useContext(Contexte);
  if (!v) throw new Error('useStore doit être utilisé dans StoreProvider');
  return v;
}

// ——— Sélecteurs ———

export function estPremium(etat: Etat, maintenant = new Date()): boolean {
  return !!etat.abonnement && etat.abonnement.jusquau >= cleJour(maintenant);
}

export function scansRestants(etat: Etat, maintenant = new Date()): number {
  // Avec un serveur, son décompte fait foi (il est mis à jour à chaque scan et à l'ouverture de l'app)
  if (etat.serveur && etat.serveur.jour === cleJour(maintenant)) return etat.serveur.scansRestants;
  const limite = estPremium(etat, maintenant) ? SCANS_PREMIUM : SCANS_GRATUITS;
  const utilises = etat.scans.jour === cleJour(maintenant) ? etat.scans.nombre : 0;
  return Math.max(0, limite - utilises);
}

export function repasDuJour(etat: Etat, jour: string): Repas[] {
  return etat.repas
    .filter((r) => r.jour === jour)
    .sort((a, b) => ordreCreneaux.indexOf(a.creneau) - ordreCreneaux.indexOf(b.creneau) || a.heure.localeCompare(b.heure));
}

export function nouvelId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ——— Données d'exemple (pour tester Bilan et Aujourd'hui) ———

function repasDemo(aujourdhui: Date): Repas[] {
  const menus: [Creneau, string, string, number][][] = [
    [['petitDej', '07:40', 'pain-omelette', 1], ['dejeuner', '13:10', 'riz-gras-poulet', 1], ['diner', '20:00', 'akassa-graine', 1]],
    [['petitDej', '08:00', 'haricots-gari', 1], ['dejeuner', '12:30', 'attieke-poisson', 1.2], ['diner', '19:45', 'igname-arachide', 1]],
    [['petitDej', '07:20', 'pain-omelette', 1], ['dejeuner', '13:00', 'pate-rouge-poisson', 1], ['diner', '20:10', 'spaghetti-oeuf', 1]],
    [['dejeuner', '12:50', 'riz-gras-poulet', 1.2], ['diner', '19:30', 'alloco-poisson', 1]],
    [['petitDej', '08:10', 'pain-omelette', 1], ['dejeuner', '13:20', 'pate-gombo', 1], ['diner', '20:30', 'attieke-poisson', 1]],
  ];
  const repas: Repas[] = [];
  // Les 13 jours précédents (aujourd'hui reste à remplir par l'utilisateur)
  for (let i = 13; i >= 1; i--) {
    const jour = cleJour(ajouterJours(aujourdhui, -i));
    const menu = menus[i % menus.length];
    for (const [creneau, h, platId, f] of menu) {
      const plat = trouverPlat(platId)!;
      repas.push({
        id: `demo-${jour}-${creneau}`,
        jour,
        heure: h,
        creneau,
        nom: plat.nom,
        lignes: plat.lignes.map((l) => ({ ...l, grammes: Math.round(l.grammes * f) })),
        huile: 'normal',
      });
    }
  }
  return repas;
}

export function maintenantHeure(): string {
  return heure(new Date());
}
