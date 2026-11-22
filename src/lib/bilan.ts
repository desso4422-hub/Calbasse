/**
 * Bilan de la semaine : moyennes et message d'encouragement (sans culpabiliser).
 *
 * Tout est lu à travers les calories et les trois nutriments, à poids égal :
 * un jour est « dans l'objectif » quand ses calories tombent à moins de 10 % de la cible,
 * au-dessus comme en dessous — ça vaut pour qui veut perdre comme pour qui veut prendre.
 */
import { ajouterJours, cleJour, zero, type Cibles, type Nutriments } from './nutrition.ts';

export type JourBilan = Nutriments & { cle: string; date: Date; repas: number; futur: boolean };

export type Bilan = {
  jours: JourBilan[];
  /** Jours passés avec au moins un repas noté */
  joursNotes: JourBilan[];
  /** Moyennes par jour noté : calories et les trois nutriments */
  moyennes: Nutriments;
  joursAtteints: number;
  repasNotes: number;
  repasAttendus: number;
  message: string;
};

/** Marge acceptée autour de la cible de calories pour considérer un jour dans l'objectif. */
export const MARGE = 0.1;

const nomsJours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const nomsNutriments: Record<'prot' | 'gluc' | 'lip', string> = { prot: 'protéines', gluc: 'glucides', lip: 'lipides' };

export function dansObjectif(kcal: number, cible: number): boolean {
  return cible > 0 && Math.abs(kcal - cible) <= cible * MARGE;
}

export function calculerBilan(
  debut: Date,
  aujourdhui: Date,
  cibles: Cibles,
  totaux: (cle: string) => Nutriments & { repas: number },
): Bilan {
  const cleAuj = cleJour(aujourdhui);
  const jours: JourBilan[] = Array.from({ length: 7 }, (_, i) => {
    const date = ajouterJours(debut, i);
    const cle = cleJour(date);
    return { cle, date, ...totaux(cle), futur: cle > cleAuj };
  });
  const joursNotes = jours.filter((j) => !j.futur && j.repas > 0);
  const n = joursNotes.length;
  const moyenne = (f: (j: JourBilan) => number) => (n ? Math.round(joursNotes.reduce((s, j) => s + f(j), 0) / n) : 0);
  const moyennes: Nutriments = n
    ? { kcal: moyenne((j) => j.kcal), prot: moyenne((j) => j.prot), gluc: moyenne((j) => j.gluc), lip: moyenne((j) => j.lip) }
    : zero;
  const joursAtteints = joursNotes.filter((j) => dansObjectif(j.kcal, cibles.kcal)).length;
  const repasNotes = jours.reduce((s, j) => s + j.repas, 0);
  const repasAttendus = jours.filter((j) => !j.futur).length * 3;

  return { jours, joursNotes, moyennes, joursAtteints, repasNotes, repasAttendus, message: messageBilan(joursNotes, joursAtteints, moyennes, cibles) };
}

/** Le nutriment le plus éloigné de sa cible, en écart relatif. */
export function nutrimentLePlusEloigne(moyennes: Nutriments, cibles: Cibles): { cle: 'prot' | 'gluc' | 'lip'; nom: string; ecart: number } | null {
  const candidats = (['prot', 'gluc', 'lip'] as const)
    .filter((c) => cibles[c] > 0)
    .map((c) => ({ cle: c, nom: nomsNutriments[c], ecart: (moyennes[c] - cibles[c]) / cibles[c] }));
  if (!candidats.length) return null;
  return candidats.reduce((a, b) => (Math.abs(b.ecart) > Math.abs(a.ecart) ? b : a));
}

function messageBilan(notes: JourBilan[], atteints: number, moyennes: Nutriments, cibles: Cibles): string {
  if (notes.length === 0) return 'Pas encore de repas cette semaine. Scanne ton prochain plat pour démarrer ton bilan.';

  const loin = nutrimentLePlusEloigne(moyennes, cibles);
  const conseil =
    loin && Math.abs(loin.ecart) >= 0.15
      ? ` Tes ${loin.nom} sont en moyenne ${loin.ecart > 0 ? 'au-dessus' : 'en dessous'} de ta cible (${moyennes[loin.cle]} g pour ${cibles[loin.cle]} g).`
      : '';

  if (atteints === notes.length) return `Tes calories sont dans ta cible tous les jours notés. Superbe semaine, garde ce rythme.${conseil}`;

  const ecartKcal = cibles.kcal ? (moyennes.kcal - cibles.kcal) / cibles.kcal : 0;
  const plusLoin = notes.reduce((a, b) => (Math.abs(b.kcal - cibles.kcal) > Math.abs(a.kcal - cibles.kcal) ? b : a));
  const jour = nomsJours[plusLoin.date.getDay()];
  const jourMaj = `${jour.charAt(0).toUpperCase()}${jour.slice(1)}`;

  if (Math.abs(ecartKcal) <= MARGE) return `Bonne semaine, tu tournes autour de ta cible. ${jourMaj} s'écarte le plus (${plusLoin.kcal} kcal).${conseil}`;
  if (ecartKcal > 0) return `Tu es au-dessus de ta cible en moyenne (${moyennes.kcal} kcal pour ${cibles.kcal}). ${jourMaj} pèse le plus lourd.${conseil}`;
  return `Tu es en dessous de ta cible en moyenne (${moyennes.kcal} kcal pour ${cibles.kcal}). ${jourMaj} est le plus bas.${conseil}`;
}
