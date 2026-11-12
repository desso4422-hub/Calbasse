import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { couleurs } from '../theme';

export type NomIcone =
  | 'appareil'
  | 'maison'
  | 'barres'
  | 'grille'
  | 'personne'
  | 'plus'
  | 'moins'
  | 'croix'
  | 'eclair'
  | 'image'
  | 'liste'
  | 'coche'
  | 'gauche'
  | 'droite'
  | 'goutte'
  | 'hausse'
  | 'baisse'
  | 'coeur'
  | 'drapeau'
  | 'micro'
  | 'envoyer'
  | 'loupe'
  | 'cloche'
  | 'info'
  | 'groupe'
  | 'cadenas'
  | 'carte'
  | 'telephone'
  | 'poubelle'
  | 'crayon';

type Props = { nom: NomIcone; taille?: number; couleur?: string; epaisseur?: number };

/** Icônes au trait (style Feather), comme dans les maquettes. */
export function Icone({ nom, taille = 24, couleur = couleurs.encre, epaisseur = 2.2 }: Props) {
  const p = { stroke: couleur, strokeWidth: epaisseur, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none">
      {formes(nom, p)}
    </Svg>
  );
}

function formes(nom: NomIcone, p: object) {
  switch (nom) {
    case 'appareil':
      return (
        <>
          <Path {...p} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <Circle {...p} cx="12" cy="13" r="4" />
        </>
      );
    case 'maison':
      return (
        <>
          <Path {...p} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline {...p} points="9 22 9 12 15 12 15 22" />
        </>
      );
    case 'barres':
      return (
        <>
          <Line {...p} x1="18" y1="20" x2="18" y2="10" />
          <Line {...p} x1="12" y1="20" x2="12" y2="4" />
          <Line {...p} x1="6" y1="20" x2="6" y2="14" />
        </>
      );
    case 'grille':
      return (
        <>
          <Rect {...p} x="3" y="3" width="7" height="7" />
          <Rect {...p} x="14" y="3" width="7" height="7" />
          <Rect {...p} x="14" y="14" width="7" height="7" />
          <Rect {...p} x="3" y="14" width="7" height="7" />
        </>
      );
    case 'personne':
      return (
        <>
          <Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle {...p} cx="12" cy="7" r="4" />
        </>
      );
    case 'groupe':
      return (
        <>
          <Path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle {...p} cx="9" cy="7" r="4" />
          <Path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <Path {...p} d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case 'plus':
      return (
        <>
          <Line {...p} x1="12" y1="5" x2="12" y2="19" />
          <Line {...p} x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case 'moins':
      return <Line {...p} x1="5" y1="12" x2="19" y2="12" />;
    case 'croix':
      return (
        <>
          <Line {...p} x1="18" y1="6" x2="6" y2="18" />
          <Line {...p} x1="6" y1="6" x2="18" y2="18" />
        </>
      );
    case 'eclair':
      return <Polygon {...p} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;
    case 'image':
      return (
        <>
          <Rect {...p} x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <Circle {...p} cx="8.5" cy="8.5" r="1.5" />
          <Polyline {...p} points="21 15 16 10 5 21" />
        </>
      );
    case 'liste':
      return (
        <>
          <Line {...p} x1="8" y1="6" x2="21" y2="6" />
          <Line {...p} x1="8" y1="12" x2="21" y2="12" />
          <Line {...p} x1="8" y1="18" x2="21" y2="18" />
          <Line {...p} x1="3" y1="6" x2="3.01" y2="6" />
          <Line {...p} x1="3" y1="12" x2="3.01" y2="12" />
          <Line {...p} x1="3" y1="18" x2="3.01" y2="18" />
        </>
      );
    case 'coche':
      return <Polyline {...p} points="20 6 9 17 4 12" />;
    case 'gauche':
      return <Polyline {...p} points="15 18 9 12 15 6" />;
    case 'droite':
      return <Polyline {...p} points="9 18 15 12 9 6" />;
    case 'goutte':
      return <Path {...p} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />;
    case 'hausse':
      return (
        <>
          <Polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <Polyline {...p} points="17 6 23 6 23 12" />
        </>
      );
    case 'baisse':
      return (
        <>
          <Polyline {...p} points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <Polyline {...p} points="17 18 23 18 23 12" />
        </>
      );
    case 'coeur':
      return <Path {...p} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />;
    case 'drapeau':
      return (
        <>
          <Path {...p} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <Line {...p} x1="4" y1="22" x2="4" y2="15" />
        </>
      );
    case 'micro':
      return (
        <>
          <Path {...p} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <Path {...p} d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <Line {...p} x1="12" y1="19" x2="12" y2="23" />
          <Line {...p} x1="8" y1="23" x2="16" y2="23" />
        </>
      );
    case 'envoyer':
      return (
        <>
          <Line {...p} x1="22" y1="2" x2="11" y2="13" />
          <Polygon {...p} points="22 2 15 22 11 13 2 9 22 2" />
        </>
      );
    case 'loupe':
      return (
        <>
          <Circle {...p} cx="11" cy="11" r="8" />
          <Line {...p} x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
    case 'cloche':
      return (
        <>
          <Path {...p} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path {...p} d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      );
    case 'info':
      return (
        <>
          <Circle {...p} cx="12" cy="12" r="10" />
          <Line {...p} x1="12" y1="16" x2="12" y2="12" />
          <Line {...p} x1="12" y1="8" x2="12.01" y2="8" />
        </>
      );
    case 'cadenas':
      return (
        <>
          <Rect {...p} x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <Path {...p} d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      );
    case 'carte':
      return (
        <>
          <Rect {...p} x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <Line {...p} x1="1" y1="10" x2="23" y2="10" />
        </>
      );
    case 'telephone':
      return (
        <>
          <Rect {...p} x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <Line {...p} x1="12" y1="18" x2="12.01" y2="18" />
        </>
      );
    case 'poubelle':
      return (
        <>
          <Polyline {...p} points="3 6 5 6 21 6" />
          <Path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <Path {...p} d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </>
      );
    case 'crayon':
      return <Path {...p} d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />;
  }
}
