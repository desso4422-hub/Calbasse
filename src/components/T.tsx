import { Text, type TextProps, type TextStyle } from 'react-native';
import { couleurs, polices, type Graisse } from '../theme';

type Props = TextProps & {
  g?: Graisse;
  taille?: number;
  couleur?: string;
  centre?: boolean;
  /** Interligne relatif, ex. 1.4 */
  interligne?: number;
  espacement?: number;
};

/** Texte Calbasse : Plus Jakarta Sans, couleur encre par défaut. */
export function T({ g = 400, taille = 15, couleur = couleurs.encre, centre, interligne, espacement, style, ...reste }: Props) {
  const base: TextStyle = {
    fontFamily: polices[g],
    fontSize: taille,
    color: couleur,
    textAlign: centre ? 'center' : undefined,
    lineHeight: interligne ? Math.round(taille * interligne) : undefined,
    letterSpacing: espacement !== undefined ? espacement * taille : undefined,
  };
  return <Text {...reste} style={[base, style]} />;
}
