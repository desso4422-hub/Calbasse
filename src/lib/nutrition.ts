/**
 * Calculs nutritionnels de Calbasse : fonctions pures, testées dans nutrition.test.ts.
 */
import { trouverAliment } from './aliments.ts';
import type { LigneRepas } from './plats.ts';

export type Nutriments = { kcal: number; prot: number; gluc: number; lip: number };

export type Portion = 'S' | 'M' | 'L';
export type Huile = 'peu' | 'normal' | 'beaucoup';

export const facteursPortion: Record<Portion, number> = { S: 0.7, M: 1, L: 1.35 };

/**
 * Écart d'huile par rapport à la « quantité habituelle » déjà comptée dans la base.
 * ≈ 1 cuillère à soupe d'huile = 9 g de lipides ≈ 80 kcal.
 */
export const ajustementsHuile: Record<Huile, { kcal: number; lip: number }> = {
  peu: { kcal: -80, lip: -9 },
  normal: { kcal: 0, lip: 0 },
  beaucoup: { kcal: 150, lip: 17 },
};

export const zero: Nutriments = { kcal: 0, prot: 0, gluc: 0, lip: 0 };

export function additionner(a: Nutriments, b: Nutriments): Nutriments {
  return { kcal: a.kcal + b.kcal, prot: a.prot + b.prot, gluc: a.gluc + b.gluc, lip: a.lip + b.lip };
}

export function nutrimentsLigne(ligne: LigneRepas): Nutriments {
  const a = trouverAliment(ligne.alimentId);
  const f = ligne.grammes / 100;
  return { kcal: a.kcal * f, prot: a.prot * f, gluc: a.gluc * f, lip: a.lip * f };
}

/** Applique la taille de portion aux aliments qui la suivent (riz, pâte, sauce), pas aux pièces (cuisse, œuf). */
export function appliquerPortion(lignes: LigneRepas[], portion: Portion): LigneRepas[] {
  const f = facteursPortion[portion];
  return lignes.map((l) =>
    trouverAliment(l.alimentId).suitPortion ? { ...l, grammes: arrondir(l.grammes * f, 5) } : l,
  );
}

export function totalRepas(lignes: LigneRepas[], huile: Huile = 'normal'): Nutriments {
  const brut = lignes.map(nutrimentsLigne).reduce(additionner, zero);
  const h = ajustementsHuile[huile];
  return {
    kcal: Math.max(0, brut.kcal + h.kcal),
    prot: brut.prot,
    gluc: brut.gluc,
    lip: Math.max(0, brut.lip + h.lip),
  };
}

export function arrondirNutriments(n: Nutriments): Nutriments {
  return { kcal: Math.round(n.kcal), prot: Math.round(n.prot), gluc: Math.round(n.gluc), lip: Math.round(n.lip) };
}

/** Une photo ne permet pas d'être exact : on affiche une fourchette honnête. */
export function fourchette(kcal: number): { bas: number; haut: number } {
  return { bas: arrondir(kcal * 0.93, 10), haut: arrondir(kcal * 1.08, 10) };
}

export function arrondir(n: number, pas: number): number {
  return Math.round(n / pas) * pas;
}

/** 1385 → « 1 385 » (espace insécable, comme dans les maquettes). */
export function formater(n: number): string {
  const r = Math.round(n);
  const signe = r < 0 ? '−' : '';
  return signe + String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ——— Objectifs journaliers ———

export type Objectif = 'masse' | 'perte' | 'forme';
export type Sexe = 'homme' | 'femme';
export type Activite = 'sedentaire' | 'leger' | 'actif' | 'tresActif';

export type Mesures = {
  sexe: Sexe;
  age: number;
  poidsKg: number;
  tailleCm: number;
  activite: Activite;
  objectif: Objectif;
};

export type Cibles = Nutriments;

export const facteursActivite: Record<Activite, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  actif: 1.55,
  tresActif: 1.725,
};

const ecartCalories: Record<Objectif, number> = { masse: 350, perte: -450, forme: 0 };
const proteinesParKg: Record<Objectif, number> = { masse: 2, perte: 1.8, forme: 1.4 };

/**
 * Métabolisme de base (Mifflin-St Jeor) × activité, puis ajusté à l'objectif.
 * Ces repères sont généraux : ils ne remplacent pas l'avis d'un professionnel de santé.
 */
export function calculerCibles(m: Mesures): Cibles {
  const base = 10 * m.poidsKg + 6.25 * m.tailleCm - 5 * m.age + (m.sexe === 'homme' ? 5 : -161);
  const plancher = m.sexe === 'homme' ? 1500 : 1200;
  const kcal = arrondir(Math.max(plancher, base * facteursActivite[m.activite] + ecartCalories[m.objectif]), 50);
  const prot = arrondir(m.poidsKg * proteinesParKg[m.objectif], 5);
  const lip = arrondir((kcal * 0.27) / 9, 5);
  const gluc = arrondir(Math.max(0, kcal - prot * 4 - lip * 9) / 4, 5);
  return { kcal, prot, gluc, lip };
}

// ——— Dates ———

/** Date locale au format AAAA-MM-JJ. */
export function cleJour(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

export function depuisCle(cle: string): Date {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function ajouterJours(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Lundi de la semaine de d. */
export function lundi(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const decalage = (r.getDay() + 6) % 7;
  return ajouterJours(r, -decalage);
}

export const joursCourts = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const joursLongs = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « Mercredi 11 novembre » */
export function dateLongue(d: Date): string {
  const j = joursLongs[d.getDay()];
  return `${j.charAt(0).toUpperCase()}${j.slice(1)} ${d.getDate()} ${mois[d.getMonth()]}`;
}

/** « du 2 au 8 novembre » / « du 27 octobre au 2 novembre » */
export function periode(debut: Date, fin: Date): string {
  const md = mois[debut.getMonth()];
  const mf = mois[fin.getMonth()];
  return md === mf ? `du ${debut.getDate()} au ${fin.getDate()} ${mf}` : `du ${debut.getDate()} ${md} au ${fin.getDate()} ${mf}`;
}

export function heure(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
