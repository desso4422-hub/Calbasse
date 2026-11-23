import { router } from 'expo-router';
import { View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { T } from '../components/T';
import { Bouton, BoutonRond, Ecran } from '../components/ui';
import { conditions, confidentialite, MISE_A_JOUR, type Section } from '../lib/mentions.ts';
import { couleurs } from '../theme';

function Bloc({ sections }: { sections: Section[] }) {
  return (
    <View style={{ gap: 18 }}>
      {sections.map((s) => (
        <View key={s.titre} style={{ gap: 6 }}>
          <T g={800} taille={16} accessibilityRole="header">
            {s.titre}
          </T>
          {s.paragraphes.map((p, i) => (
            <T key={i} taille={14} interligne={1.5} couleur={couleurs.encre2}>
              {p}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Politique de confidentialité et conditions d'utilisation (texte : src/lib/mentions.ts). */
export default function Confidentialite() {
  return (
    <Ecran padding={24} espaceBas={28} bas={<Bouton titre="Fermer" onPress={() => router.back()} />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
        <Logo />
      </View>
      <View style={{ gap: 4 }}>
        <T g={800} taille={28} interligne={1.1} espacement={-0.02} accessibilityRole="header">
          Confidentialité et conditions
        </T>
        <T taille={13} couleur={couleurs.encre2}>
          Dernière mise à jour : {MISE_A_JOUR}
        </T>
      </View>
      <T g={800} taille={20} couleur={couleurs.terreFoncee}>
        Confidentialité
      </T>
      <Bloc sections={confidentialite} />
      <T g={800} taille={20} couleur={couleurs.terreFoncee} style={{ marginTop: 8 }}>
        Conditions d’utilisation
      </T>
      <Bloc sections={conditions} />
    </Ecran>
  );
}
