import { Image, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { trouverAliment } from '../lib/aliments.ts';
import type { LigneRepas } from '../lib/plats.ts';
import { couleurs } from '../theme';

/** Anneau de progression (protéines). */
export function Anneau({ taille = 132, epaisseur = 14, progression, couleur = couleurs.terreCuite }: { taille?: number; epaisseur?: number; progression: number; couleur?: string }) {
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progression));
  return (
    <Svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
      <Circle cx={taille / 2} cy={taille / 2} r={r} stroke={couleurs.piste} strokeWidth={epaisseur} fill="none" />
      {p > 0 ? (
        <Circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          stroke={couleur}
          strokeWidth={epaisseur}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
        />
      ) : null}
    </Svg>
  );
}

/** Barre de progression fine (calories). */
export function Jauge({ progression, couleur = couleurs.encre }: { progression: number; couleur?: string }) {
  const p = Math.max(0, Math.min(1, progression));
  return (
    <View style={{ height: 8, borderRadius: 8, backgroundColor: couleurs.piste, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: couleur, borderRadius: 8 }} />
    </View>
  );
}

/**
 * Illustration d'assiette vue de dessus, composée à partir des aliments du repas :
 * féculent à gauche, viande ou poisson en haut à droite, sauce en bas à droite.
 */
export function Assiette({ lignes, taille = 52, fond = couleurs.sable }: { lignes: LigneRepas[]; taille?: number; fond?: string }) {
  const items = lignes.map((l) => trouverAliment(l.alimentId));
  const feculent = items.find((a) => a.categorie === 'cereales');
  const proteine = items.find((a) => a.categorie === 'viandes') ?? items.find((a) => a.categorie === 'autres');
  const sauce = items.find((a) => a.categorie === 'sauces') ?? items.find((a) => a !== feculent && a !== proteine);
  return (
    <Svg width={taille} height={taille} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="48" fill={fond} />
      <Circle cx="50" cy="50" r="39" fill={couleurs.blanc} />
      {feculent ? (
        <>
          <Ellipse cx={proteine || sauce ? 39 : 50} cy="55" rx={proteine || sauce ? 23 : 28} ry={proteine || sauce ? 19 : 24} fill={feculent.couleur} />
          <Path d="M26 58 C30 49 42 45 50 53" stroke={feculent.contour} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {proteine ? (
        <>
          <Ellipse cx="67" cy="41" rx="14" ry="10" fill={proteine.couleur} transform="rotate(-28 67 41)" />
          <Ellipse cx="65" cy="37" rx="6.5" ry="3.2" fill={proteine.contour} opacity={0.6} transform="rotate(-28 65 37)" />
        </>
      ) : null}
      {sauce ? (
        <>
          <Ellipse cx="63" cy="68" rx="12.5" ry="8.5" fill={sauce.couleur} />
          <Circle cx="60" cy="66" r="1.6" fill={couleurs.blanc} opacity={0.35} />
          <Circle cx="67" cy="70" r="1.6" fill={couleurs.blanc} opacity={0.35} />
        </>
      ) : null}
    </Svg>
  );
}

const logo = require('../../assets/images/logo-calbasse.jpg');

/** Logo rond, recadré comme dans les maquettes (zoom 138 %). */
export function Logo({ taille = 44 }: { taille?: number }) {
  const zoom = taille * 1.38;
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, overflow: 'hidden' }}>
      <Image source={logo} style={{ width: zoom, height: zoom, marginLeft: -(zoom - taille) / 2, marginTop: -(zoom - taille) / 2 }} accessibilityLabel="Logo Calbasse" />
    </View>
  );
}
