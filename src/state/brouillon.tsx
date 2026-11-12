/**
 * Repas en cours (entre le scan et l'enregistrement). Partagé par Résultat, Détail et Choisir un plat.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { trouverAliment } from '../lib/aliments.ts';
import { appliquerPortion, cleJour, facteursPortion, heure, type Huile, type Portion } from '../lib/nutrition.ts';
import { nommerRepas, type LigneRepas } from '../lib/plats.ts';
import { creneauPourHeure, nouvelId, type Creneau, type Repas } from './store';

export type Brouillon = {
  /** Défini quand on modifie un repas déjà enregistré */
  repasId?: string;
  jour: string;
  heure: string;
  nom: string;
  /** Le nom vient-il de la reconnaissance (true) ou doit-il suivre les aliments (false) ? */
  nomFixe: boolean;
  /** Grammes pour une portion Moyenne */
  lignesBase: LigneRepas[];
  portion: Portion;
  huile: Huile;
  creneau: Creneau;
  photoUri?: string;
  reconnu: boolean;
  mode: 'serveur' | 'demo' | 'manuel';
};

type Valeur = {
  brouillon: Brouillon | null;
  setBrouillon: (b: Brouillon | null | ((b: Brouillon | null) => Brouillon | null)) => void;
};

const Contexte = createContext<Valeur | null>(null);

export function BrouillonProvider({ children }: { children: ReactNode }) {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  return <Contexte.Provider value={{ brouillon, setBrouillon }}>{children}</Contexte.Provider>;
}

export function useBrouillon(): Valeur {
  const v = useContext(Contexte);
  if (!v) throw new Error('useBrouillon doit être utilisé dans BrouillonProvider');
  return v;
}

export function nouveauBrouillon(p: {
  nom: string;
  lignes: LigneRepas[];
  reconnu: boolean;
  mode: Brouillon['mode'];
  photoUri?: string;
  creneau?: Creneau;
}): Brouillon {
  const maintenant = new Date();
  return {
    jour: cleJour(maintenant),
    heure: heure(maintenant),
    nom: p.nom,
    nomFixe: p.mode !== 'manuel',
    lignesBase: p.lignes,
    portion: 'M',
    huile: 'normal',
    creneau: p.creneau ?? creneauPourHeure(maintenant),
    photoUri: p.photoUri,
    reconnu: p.reconnu,
    mode: p.mode,
  };
}

export function brouillonDepuisRepas(r: Repas): Brouillon {
  return {
    repasId: r.id,
    jour: r.jour,
    heure: r.heure,
    nom: r.nom,
    nomFixe: true,
    lignesBase: r.lignes,
    portion: 'M',
    huile: r.huile,
    creneau: r.creneau,
    photoUri: r.photoUri,
    reconnu: true,
    mode: 'manuel',
  };
}

export function lignesEffectives(b: Brouillon): LigneRepas[] {
  return appliquerPortion(b.lignesBase, b.portion);
}

export function nomBrouillon(b: Brouillon): string {
  if (b.nomFixe && b.nom) return b.nom;
  return nommerRepas(b.lignesBase.map((l) => trouverAliment(l.alimentId).nom));
}

/** Fixe la quantité réelle d'un aliment (écran Détail), en tenant compte de la portion choisie. */
export function avecGrammes(b: Brouillon, index: number, grammesReels: number): Brouillon {
  const ligne = b.lignesBase[index];
  const f = trouverAliment(ligne.alimentId).suitPortion ? facteursPortion[b.portion] : 1;
  const lignesBase = b.lignesBase.map((l, i) => (i === index ? { ...l, grammes: Math.max(5, grammesReels / f) } : l));
  return { ...b, lignesBase };
}

export function ajouterAliment(b: Brouillon, alimentId: string): Brouillon {
  const a = trouverAliment(alimentId);
  const existe = b.lignesBase.findIndex((l) => l.alimentId === alimentId);
  const lignesBase =
    existe >= 0
      ? b.lignesBase.map((l, i) => (i === existe ? { ...l, grammes: l.grammes + a.uniteG } : l))
      : [...b.lignesBase, { alimentId, grammes: a.uniteG }];
  return { ...b, lignesBase, nomFixe: false };
}

export function retirerAliment(b: Brouillon, index: number): Brouillon {
  return { ...b, lignesBase: b.lignesBase.filter((_, i) => i !== index), nomFixe: false };
}

export function versRepas(b: Brouillon): Repas {
  return {
    id: b.repasId ?? nouvelId(),
    jour: b.jour,
    heure: b.heure,
    creneau: b.creneau,
    nom: nomBrouillon(b),
    lignes: lignesEffectives(b),
    huile: b.huile,
    photoUri: b.photoUri,
  };
}
