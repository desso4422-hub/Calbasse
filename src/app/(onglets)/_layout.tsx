import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone, type NomIcone } from '../../components/Icone';
import { T } from '../../components/T';
import { couleurs } from '../../theme';

const onglets: Record<string, { titre: string; icone: NomIcone }> = {
  index: { titre: "Aujourd'hui", icone: 'maison' },
  bilan: { titre: 'Bilan', icone: 'barres' },
  plats: { titre: 'Plats', icone: 'grille' },
  profil: { titre: 'Profil', icone: 'personne' },
};

/** Barre d'onglets des maquettes, avec le gros bouton Scanner au centre. */
function BarreOnglets({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => onglets[r.name]);
  const bouton = (nom: string) => {
    const route = state.routes.find((r) => r.name === nom);
    if (!route) return null;
    const actif = state.routes[state.index]?.name === nom;
    const o = onglets[nom];
    const couleur = actif ? couleurs.terreCuite : couleurs.encre2;
    return (
      <Pressable
        key={nom}
        accessibilityRole="tab"
        accessibilityState={{ selected: actif }}
        accessibilityLabel={o.titre}
        onPress={() => {
          if (!actif) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', gap: 4 }}
      >
        <Icone nom={o.icone} couleur={couleur} />
        <T g={actif ? 700 : 600} taille={11} couleur={couleur}>
          {o.titre}
        </T>
      </Pressable>
    );
  };
  const noms = routes.map((r) => r.name);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: couleurs.blanc,
        borderTopWidth: 1,
        borderTopColor: couleurs.traits,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {noms.slice(0, 2).map(bouton)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scanner un repas"
          onPress={() => router.push('/scanner')}
          style={({ pressed }) => ({
            marginTop: -30,
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: couleurs.terreCuite,
            borderWidth: 4,
            borderColor: couleurs.fond,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: couleurs.terreCuite,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Icone nom="appareil" taille={28} couleur={couleurs.blanc} />
        </Pressable>
      </View>
      {noms.slice(2).map(bouton)}
    </View>
  );
}

export default function LayoutOnglets() {
  return (
    <Tabs tabBar={(props) => <BarreOnglets {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: couleurs.fond } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bilan" />
      <Tabs.Screen name="plats" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
