import { router } from 'expo-router';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Logo } from '../../components/Graphiques';
import { Icone, type NomIcone } from '../../components/Icone';
import { T } from '../../components/T';
import { Ecran, Etiquette, TitreSection } from '../../components/ui';
import { formater } from '../../lib/nutrition.ts';
import { modeReconnaissance } from '../../services/reconnaissance';
import { estPremium, scansRestants, useStore } from '../../state/store';
import { couleurs } from '../../theme';

const nomsObjectifs = { masse: 'Prendre de la masse', perte: 'Perdre du poids', forme: 'Garder la forme' };

function confirmer(titre: string, message: string, bouton: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${titre}\n\n${message}`)) action();
    return;
  }
  Alert.alert(titre, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: bouton, style: 'destructive', onPress: action },
  ]);
}

export default function Profil() {
  const { etat, dispatch } = useStore();
  const p = etat.profil;
  if (!p) return null;
  const premium = estPremium(etat);
  const aCorriger = etat.clients.filter((c) => c.repas?.statut === 'aCorriger').length;

  return (
    <Ecran espaceBas={28}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Logo taille={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <T g={800} taille={26} espacement={-0.02} accessibilityRole="header">
            {p.prenom || 'Mon profil'}
          </T>
          <T taille={13} couleur={couleurs.encre2}>
            {nomsObjectifs[p.mesures.objectif]} · {p.mesures.poidsKg} kg · {p.mesures.tailleCm} cm
          </T>
        </View>
      </View>

      <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 22, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TitreSection>Mes repères du jour</TitreSection>
          <Pressable onPress={() => router.push('/onboarding')} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icone nom="crayon" taille={14} couleur={couleurs.terreCuite} />
            <T g={700} taille={13} couleur={couleurs.terreCuite}>
              Modifier
            </T>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Repere titre="Protéines" valeur={`${p.cibles.prot} g`} fort />
          <Repere titre="Calories" valeur={formater(p.cibles.kcal)} />
          <Repere titre="Glucides" valeur={`${p.cibles.gluc} g`} />
          <Repere titre="Lipides" valeur={`${p.cibles.lip} g`} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Ligne
          icone="appareil"
          titre={premium ? 'Premium actif' : 'Passer à Premium'}
          texte={premium ? `${scansRestants(etat)} scans restants aujourd'hui` : `${scansRestants(etat)} scans gratuits restants aujourd'hui`}
          onPress={() => router.push('/premium')}
        />
        <Ligne
          icone="groupe"
          titre="Mode coach"
          texte={aCorriger > 0 ? `${aCorriger} repas de tes clients à corriger` : 'Suis et corrige les repas de tes clients'}
          onPress={() => router.push('/coach')}
        />
        <Ligne icone="barres" titre="Charger des repas d'exemple" texte="Remplit les deux dernières semaines pour essayer le Bilan" onPress={() => dispatch({ type: 'chargerDemo' })} />
      </View>

      <View style={{ backgroundColor: couleurs.sable, borderRadius: 18, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icone nom="info" taille={18} couleur={couleurs.terreFoncee} />
          <T g={800} taille={14}>
            À propos des chiffres
          </T>
        </View>
        <T taille={13} interligne={1.45}>
          Les valeurs nutritionnelles de cette version sont des exemples. Elles seront remplacées par une base sourcée (FAO/INFOODS) validée par un nutritionniste. Calbasse ne remplace pas un avis médical.
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Etiquette texte={modeReconnaissance === 'demo' ? 'Reconnaissance : démo' : 'Reconnaissance : serveur'} ton="encre" petite />
          {etat.signalements.length > 0 ? <Etiquette texte={`${etat.signalements.length} signalement(s) envoyés`} ton="feuille" petite /> : null}
        </View>
      </View>

      <Pressable
        onPress={() =>
          confirmer('Tout effacer ?', 'Ton profil et tes repas seront supprimés de ce téléphone.', 'Effacer', () => {
            dispatch({ type: 'reinitialiser' });
            router.replace('/onboarding');
          })
        }
        accessibilityRole="button"
        style={{ paddingVertical: 10 }}
      >
        <T g={700} taille={14} couleur={couleurs.encre2} centre>
          Effacer mes données
        </T>
      </Pressable>
    </Ecran>
  );
}

function Repere({ titre, valeur, fort }: { titre: string; valeur: string; fort?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: fort ? couleurs.terreDouce : couleurs.fond, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 2 }}>
      <T g={600} taille={11} couleur={fort ? couleurs.terreFoncee : couleurs.encre2}>
        {titre}
      </T>
      <T g={800} taille={16}>
        {valeur}
      </T>
    </View>
  );
}

function Ligne({ icone, titre, texte, onPress }: { icone: NomIcone; titre: string; texte: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: couleurs.blanc,
        borderWidth: 1,
        borderColor: couleurs.traits,
        borderRadius: 18,
        padding: 12,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: couleurs.encre, alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={icone} taille={22} couleur={couleurs.sable} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T g={700} taille={15}>
          {titre}
        </T>
        <T taille={12} couleur={couleurs.encre2}>
          {texte}
        </T>
      </View>
      <Icone nom="droite" taille={18} couleur={couleurs.encre2} />
    </Pressable>
  );
}
