import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { couleurs } from '../theme';
import { Icone, type NomIcone } from './Icone';
import { T } from './T';

/** Fond crème + marges de sécurité. `defile` pour un écran qui scrolle. */
export function Ecran({
  children,
  fond = couleurs.fond,
  defile = true,
  bas,
  padding = 20,
  espaceBas = 24,
}: {
  children: ReactNode;
  fond?: string;
  defile?: boolean;
  /** Élément collé en bas (bouton principal) */
  bas?: ReactNode;
  padding?: number;
  espaceBas?: number;
}) {
  const insets = useSafeAreaInsets();
  const contenu: ViewStyle = { paddingTop: insets.top + 18, paddingHorizontal: padding, paddingBottom: espaceBas, gap: 14 };
  return (
    <View style={{ flex: 1, backgroundColor: fond }}>
      {defile ? (
        <ScrollView contentContainerStyle={contenu} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[contenu, { flex: 1 }]}>{children}</View>
      )}
      {bas ? <View style={{ paddingHorizontal: padding, paddingTop: 10, paddingBottom: insets.bottom + 16, gap: 12 }}>{bas}</View> : null}
    </View>
  );
}

export function Bouton({
  titre,
  onPress,
  variante = 'plein',
  icone,
  desactive,
  chargement,
  hauteur = 56,
  style,
}: {
  titre: string;
  onPress?: () => void;
  variante?: 'plein' | 'lien' | 'contour';
  icone?: NomIcone;
  desactive?: boolean;
  chargement?: boolean;
  hauteur?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (variante === 'lien') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ paddingVertical: 8, opacity: pressed ? 0.6 : 1 }, style]}>
        <T g={700} taille={14} couleur={couleurs.encre2} centre>
          {titre}
        </T>
      </Pressable>
    );
  }
  const plein = variante === 'plein';
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive || chargement}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: hauteur,
          borderRadius: 16,
          backgroundColor: plein ? couleurs.terreCuite : couleurs.blanc,
          borderWidth: plein ? 0 : 1.5,
          borderColor: couleurs.terreCuite,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: desactive ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={plein ? couleurs.blanc : couleurs.terreCuite} />
      ) : (
        <>
          {icone ? <Icone nom={icone} taille={20} couleur={plein ? couleurs.blanc : couleurs.terreFoncee} /> : null}
          <T g={700} taille={hauteur >= 56 ? 17 : 16} couleur={plein ? couleurs.blanc : couleurs.terreFoncee}>
            {titre}
          </T>
        </>
      )}
    </Pressable>
  );
}

/** Bouton rond (retour, fermer). */
export function BoutonRond({
  icone,
  onPress,
  label,
  fond = couleurs.sable,
  couleur = couleurs.encre,
  taille = 44,
}: {
  icone: NomIcone;
  onPress?: () => void;
  label: string;
  fond?: string;
  couleur?: string;
  taille?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: taille,
        height: taille,
        borderRadius: taille / 2,
        backgroundColor: fond,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icone nom={icone} taille={22} couleur={couleur} epaisseur={2.4} />
    </Pressable>
  );
}

/** Sélecteur segmenté (Petite / Moyenne / Grande). */
export function Segment<V extends string>({
  options,
  valeur,
  onChange,
  icone,
}: {
  options: { valeur: V; titre: string }[];
  valeur: V;
  onChange: (v: V) => void;
  icone?: NomIcone;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: couleurs.sable, borderRadius: 15, padding: 4 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={o.valeur}
            onPress={() => onChange(o.valeur)}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 11,
              backgroundColor: actif ? couleurs.encre : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {icone ? <Icone nom={icone} taille={15} couleur={actif ? couleurs.blanc : couleurs.encre} epaisseur={2.4} /> : null}
            <T g={700} taille={14} couleur={actif ? couleurs.blanc : couleurs.encre}>
              {o.titre}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carte à choix unique avec pastille ronde (objectif, abonnement). */
export function Choix({
  actif,
  onPress,
  gauche,
  children,
  droite,
}: {
  actif: boolean;
  onPress: () => void;
  gauche?: ReactNode;
  children: ReactNode;
  droite?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: actif ? couleurs.terreCuite : couleurs.traits,
        backgroundColor: actif ? couleurs.terreDouce : couleurs.blanc,
      }}
    >
      {gauche}
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
      {droite ?? <PastilleRadio actif={actif} />}
    </Pressable>
  );
}

export function PastilleRadio({ actif }: { actif: boolean }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: actif ? couleurs.terreCuite : couleurs.traitsFonces,
        backgroundColor: actif ? couleurs.terreCuite : couleurs.blanc,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {actif ? <Icone nom="coche" taille={14} couleur={couleurs.blanc} epaisseur={3.2} /> : null}
    </View>
  );
}

export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 18, padding: 14 }, style]}>
      {children}
    </View>
  );
}

/** Petite étiquette arrondie. */
export function Etiquette({
  texte,
  ton = 'terre',
  icone,
  petite,
}: {
  texte: string;
  ton?: 'terre' | 'feuille' | 'sable' | 'encre';
  icone?: NomIcone;
  petite?: boolean;
}) {
  const tons = {
    terre: { fond: couleurs.terreDouce, texte: couleurs.terreFoncee },
    feuille: { fond: couleurs.feuilleDouce, texte: couleurs.feuille },
    sable: { fond: couleurs.sable, texte: couleurs.encre },
    encre: { fond: couleurs.encre, texte: couleurs.sable },
  }[ton];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: tons.fond,
        borderRadius: 999,
        paddingVertical: petite ? 3 : 6,
        paddingHorizontal: petite ? 9 : 11,
        alignSelf: 'flex-start',
      }}
    >
      {icone ? <Icone nom={icone} taille={petite ? 12 : 14} couleur={tons.texte} epaisseur={2.8} /> : null}
      <T g={700} taille={petite ? 11 : 12} couleur={tons.texte}>
        {texte}
      </T>
    </View>
  );
}

/** Puce de filtre (Tous, Sauces…). */
export function Puce({ titre, actif, onPress, couleurActive = couleurs.encre }: { titre: string; actif: boolean; onPress: () => void; couleurActive?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={{
        backgroundColor: actif ? couleurActive : couleurs.blanc,
        borderWidth: 1.5,
        borderColor: actif ? couleurActive : couleurs.traits,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
    >
      <T g={700} taille={13} couleur={actif ? couleurs.blanc : couleurs.encre}>
        {titre}
      </T>
    </Pressable>
  );
}

export function TitreSection({ children }: { children: ReactNode }) {
  return (
    <T g={800} taille={13} couleur={couleurs.terreFoncee} espacement={0.08} style={{ textTransform: 'uppercase' }}>
      {children}
    </T>
  );
}
