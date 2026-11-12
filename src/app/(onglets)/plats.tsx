import { router } from 'expo-router';
import { View } from 'react-native';
import { ListeAliments } from '../../components/ListeAliments';
import { T } from '../../components/T';
import { Ecran } from '../../components/ui';
import { nouveauBrouillon, useBrouillon } from '../../state/brouillon';
import { couleurs } from '../../theme';

export default function Plats() {
  const { setBrouillon } = useBrouillon();
  return (
    <Ecran espaceBas={28}>
      <View style={{ gap: 3 }}>
        <T g={800} taille={28} espacement={-0.02} accessibilityRole="header">
          Plats locaux
        </T>
        <T taille={13} interligne={1.4} couleur={couleurs.encre2}>
          Chaque plat est chiffré à partir de ses ingrédients, huile comprise. Touche un plat pour l’ajouter à ta journée.
        </T>
      </View>
      <ListeAliments
        onChoisir={(a) => {
          setBrouillon(nouveauBrouillon({ nom: a.nom, lignes: [{ alimentId: a.id, grammes: a.uniteG }], reconnu: true, mode: 'manuel' }));
          router.push('/resultat');
        }}
      />
    </Ecran>
  );
}
