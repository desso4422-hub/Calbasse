/**
 * Bilan de la semaine : moyennes et message d'encouragement (sans culpabiliser).
 */
import { ajouterJours, cleJour, type Cibles } from './nutrition.ts';

export type JourBilan = { cle: string; date: Date; prot: number; kcal: number; repas: number; futur: boolean };

export type Bilan = {
  jours: JourBilan[];
  /** Jours passés avec au moins un repas noté */
  joursNotes: JourBilan[];
  protMoyenne: number;
  kcalMoyenne: number;
  joursAtteints: number;
  repasNotes: number;
  repasAttendus: number;
  message: string;
};

const nomsJours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function calculerBilan(
  debut: Date,
  aujourdhui: Date,
  cibles: Cibles,
  totaux: (cle: string) => { prot: number; kcal: number; repas: number },
): Bilan {
  const cleAuj = cleJour(aujourdhui);
  const jours: JourBilan[] = Array.from({ length: 7 }, (_, i) => {
    const date = ajouterJours(debut, i);
    const cle = cleJour(date);
    const t = totaux(cle);
    return { cle, date, ...t, futur: cle > cleAuj };
  });
  const joursNotes = jours.filter((j) => !j.futur && j.repas > 0);
  const n = joursNotes.length;
  const protMoyenne = n ? Math.round(joursNotes.reduce((s, j) => s + j.prot, 0) / n) : 0;
  const kcalMoyenne = n ? Math.round(joursNotes.reduce((s, j) => s + j.kcal, 0) / n) : 0;
  const joursAtteints = joursNotes.filter((j) => j.prot >= cibles.prot).length;
  const repasNotes = jours.reduce((s, j) => s + j.repas, 0);
  const joursEcoules = jours.filter((j) => !j.futur).length;
  const repasAttendus = joursEcoules * 3;

  return {
    jours,
    joursNotes,
    protMoyenne,
    kcalMoyenne,
    joursAtteints,
    repasNotes,
    repasAttendus,
    message: messageBilan(joursNotes, joursAtteints, protMoyenne, cibles),
  };
}

function messageBilan(notes: JourBilan[], atteints: number, moyenne: number, cibles: Cibles): string {
  if (notes.length === 0) return 'Pas encore de repas cette semaine. Scanne ton prochain plat pour démarrer ton bilan.';
  const plusBas = notes.reduce((a, b) => (b.prot < a.prot ? b : a));
  const jourBas = nomsJours[plusBas.date.getDay()];
  const ecart = cibles.prot - plusBas.prot;
  const conseil =
    ecart > 0
      ? ` ${jourBas.charAt(0).toUpperCase()}${jourBas.slice(1)} était plus bas (${plusBas.prot} g) : un dîner plus riche en protéines (œufs, poisson, haricots) comblerait l'écart.`
      : '';
  if (atteints === notes.length) return `Objectif atteint tous les jours notés. Superbe semaine, garde ce rythme.`;
  if (moyenne >= cibles.prot * 0.9) return `Bonne semaine, tu y es presque.${conseil}`;
  if (moyenne >= cibles.prot * 0.7) return `Tu progresses : ${atteints} jour${atteints > 1 ? 's' : ''} dans l'objectif.${conseil}`;
  return `Chaque repas noté compte. Pour remonter tes protéines, ajoute une source à chaque repas : œuf, poisson, viande, haricots ou wagashi.`;
}
