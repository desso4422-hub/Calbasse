/**
 * Sauvegarde en ligne du profil et des repas (pour retrouver ses données sur un nouveau téléphone).
 * Fonctions pures, testées. Les appels réseau sont dans services/sauvegarde.ts.
 *
 * Ce qui part en ligne : le profil, les repas. Pas les photos (elles restent sur le téléphone), pas les scans
 * en attente, pas les repas d'exemple.
 */
import type { Profil, Repas } from '../state/store.tsx';

export type Donnees = { v: 1; profil: Profil | null; repas: Repas[] };

/** Ce qu'on sauvegarde à partir de l'état de l'app */
export function extraire(etat: { profil: Profil | null; repas: Repas[] }): Donnees {
  return {
    v: 1,
    profil: etat.profil,
    repas: etat.repas.filter((r) => !r.id.startsWith('demo-')).map(({ photoUri: _photo, ...r }) => r),
  };
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function repasValide(r: unknown): r is Repas {
  return (
    estObjet(r) &&
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.jour) &&
    typeof r.heure === 'string' &&
    typeof r.creneau === 'string' &&
    typeof r.nom === 'string' &&
    Array.isArray(r.lignes)
  );
}

function profilValide(p: unknown): p is Profil {
  return estObjet(p) && typeof p.prenom === 'string' && estObjet(p.mesures) && estObjet(p.cibles) && typeof p.cibles.kcal === 'number';
}

/** Relit ce que le serveur renvoie ; ce qui n'est pas exploitable est écarté plutôt que de faire planter l'app. */
export function lireDonnees(brut: unknown): Donnees | null {
  if (!estObjet(brut)) return null;
  const repas = Array.isArray(brut.repas) ? brut.repas.filter(repasValide) : [];
  const profil = profilValide(brut.profil) ? brut.profil : null;
  if (!profil && repas.length === 0) return null;
  return { v: 1, profil, repas };
}

/**
 * Réunit deux versions. Les repas sont additionnés (à identifiant égal, la version locale gagne : elle est la plus récente
 * sur ce téléphone). Le profil vient du serveur si `profilServeur`, sinon de ce téléphone ; s'il manque d'un côté, on prend l'autre.
 */
export function fusionner(local: Donnees, serveur: Donnees, profilServeur: boolean): Donnees {
  const parId = new Map<string, Repas>();
  for (const r of serveur.repas) parId.set(r.id, r);
  for (const r of local.repas) parId.set(r.id, r);
  const profil = profilServeur ? (serveur.profil ?? local.profil) : (local.profil ?? serveur.profil);
  return { v: 1, profil, repas: [...parId.values()] };
}

/** Petite signature d'un contenu : sert à savoir s'il a changé depuis la dernière sauvegarde. */
export function empreinte(x: unknown): string {
  const t = JSON.stringify(x) ?? '';
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return `${t.length.toString(36)}-${h.toString(36)}`;
}

/** Le contenu est-il identique, sans tenir compte de l'ordre des repas ? */
export function empreinteDonnees(d: Donnees): string {
  return empreinte({ p: d.profil, r: [...d.repas].sort((a, b) => a.id.localeCompare(b.id)) });
}

/** Décide quoi faire à la synchronisation, d'après la révision connue et celle du serveur. */
export type Decision = 'rien' | 'envoyer' | 'fusionner';
export function decider(p: { revisionServeur: number; revisionConnue: number; localChange: boolean }): Decision {
  if (p.revisionServeur > p.revisionConnue) return 'fusionner';
  return p.localChange ? 'envoyer' : 'rien';
}

/** Les mêmes codes e-mail sont valables 6 à 8 chiffres selon la configuration de Supabase. */
export const codeEmailValide = (code: string) => /^\d{6,8}$/.test(code.replace(/\s/g, ''));
export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
