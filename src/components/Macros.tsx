import { View } from 'react-native';
import type { Nutriments } from '../lib/nutrition.ts';
import { couleurs } from '../theme';
import { T } from './T';

/**
 * Les trois nutriments, présentés à poids égal : protéines, glucides, lipides.
 * Aucun des trois n'est mis en avant ; les calories se lisent à côté, dans l'écran.
 */
export const MACROS = [
  { cle: 'prot', nom: 'Protéines', court: 'P', couleur: couleurs.terreCuite },
  { cle: 'gluc', nom: 'Glucides', court: 'G', couleur: couleurs.feuille },
  { cle: 'lip', nom: 'Lipides', court: 'L', couleur: couleurs.terreFoncee },
] as const;

/** Barre fine d'avancement vers la cible du jour. */
function Barre({ progression, couleur, piste }: { progression: number; couleur: string; piste: string }) {
  const p = Math.max(0, Math.min(1, progression));
  return (
    <View style={{ height: 5, borderRadius: 5, backgroundColor: piste, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: couleur, borderRadius: 5 }} />
    </View>
  );
}

/**
 * `cibles` : affiche aussi l'objectif du jour et une barre par nutriment.
 * `ton` : « sombre » sur les cartes couleur encre.
 */
export function Macros({ n, cibles, ton = 'clair' }: { n: Nutriments; cibles?: Nutriments; ton?: 'clair' | 'sombre' }) {
  const sombre = ton === 'sombre';
  const etiquette = sombre ? couleurs.sableClair : couleurs.encre2;
  const valeur = sombre ? couleurs.sable : couleurs.encre;
  const piste = sombre ? '#4A3322' : couleurs.piste;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {MACROS.map((m) => (
        <View key={m.cle} style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${m.nom} ${n[m.cle]} grammes${cibles ? ` sur ${cibles[m.cle]} grammes` : ''}`}>
          <T g={700} taille={12} couleur={etiquette}>
            {m.nom}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <T g={800} taille={20} couleur={valeur}>
              {n[m.cle]}
            </T>
            <T g={700} taille={12} couleur={etiquette}>
              g{cibles ? ` / ${cibles[m.cle]}` : ''}
            </T>
          </View>
          {cibles ? <Barre progression={cibles[m.cle] ? n[m.cle] / cibles[m.cle] : 0} couleur={sombre ? couleurs.peche : m.couleur} piste={piste} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Version d'une ligne, pour les listes de repas : « P 32 · G 88 · L 14 ». */
export function MacrosCourt({ n, couleur = couleurs.encre2, taille = 12 }: { n: Nutriments; couleur?: string; taille?: number }) {
  return (
    <T g={600} taille={taille} couleur={couleur} accessibilityLabel={`${n.prot} grammes de protéines, ${n.gluc} grammes de glucides, ${n.lip} grammes de lipides`}>
      {MACROS.map((m) => `${m.court} ${n[m.cle]}`).join(' · ')}
    </T>
  );
}
