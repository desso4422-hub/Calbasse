import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Ecran, Etiquette } from '../components/ui';
import { trouverAliment } from '../lib/aliments.ts';
import { arrondirNutriments, cleJour, formater, nutrimentsLigne, totalRepas } from '../lib/nutrition.ts';
import { avecGrammes, lignesEffectives, nomBrouillon, retirerAliment, useBrouillon, versRepas } from '../state/brouillon';
import { nomsCreneaux, useStore } from '../state/store';
import { couleurs } from '../theme';

const textesHuile = { peu: 'peu', normal: 'quantité habituelle', beaucoup: 'beaucoup' } as const;

function confirmer(titre: string, message: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${titre}\n\n${message}`)) action();
    return;
  }
  Alert.alert(titre, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: action },
  ]);
}

export default function Detail() {
  const { dispatch } = useStore();
  const { brouillon, setBrouillon } = useBrouillon();
  const [signale, setSignale] = useState(false);
  if (!brouillon) return <Redirect href="/(onglets)" />;
  const b = brouillon;
  const lignes = lignesEffectives(b);
  const total = arrondirNutriments(totalRepas(lignes, b.huile));
  const enEdition = !!b.repasId;

  const valider = () => {
    if (enEdition) {
      dispatch({ type: 'enregistrerRepas', repas: versRepas(b) });
      setBrouillon(null);
      router.back();
    } else {
      router.back();
    }
  };

  const signaler = () => {
    for (const l of lignes) {
      dispatch({ type: 'signaler', signalement: { jour: cleJour(new Date()), alimentId: l.alimentId, repasNom: nomBrouillon(b) } });
    }
    setSignale(true);
  };

  return (
    <Ecran
      bas={
        <>
          <Bouton titre={enEdition ? 'Enregistrer les changements' : 'Valider ces valeurs'} onPress={valider} hauteur={54} desactive={lignes.length === 0} />
          {enEdition ? (
            <Bouton
              variante="lien"
              titre="Supprimer ce repas"
              onPress={() =>
                confirmer('Supprimer ce repas ?', 'Il sera retiré de ta journée.', () => {
                  dispatch({ type: 'supprimerRepas', id: b.repasId! });
                  setBrouillon(null);
                  router.back();
                })
              }
            />
          ) : null}
        </>
      }
    >
      <View style={{ gap: 10 }}>
        <BoutonRond icone="gauche" label="Retour" taille={40} onPress={() => router.back()} />
        <View style={{ gap: 2 }}>
          <T g={800} taille={26} espacement={-0.02} accessibilityRole="header">
            Détail du repas
          </T>
          <T taille={13} couleur={couleurs.encre2}>
            {nomBrouillon(b)} · {nomsCreneaux[b.creneau]}
          </T>
        </View>
      </View>

      {lignes.map((l, i) => {
        const a = trouverAliment(l.alimentId);
        const n = arrondirNutriments(nutrimentsLigne(l));
        const pas = Math.max(10, Math.round(a.uniteG / 10 / 10) * 10);
        return (
          <View key={`${l.alimentId}-${i}`} style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 18, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <T g={800} taille={15} style={{ flex: 1 }}>
                {a.nom}
                {!a.suitPortion && l.grammes === a.uniteG ? (
                  <T g={500} taille={15} couleur={couleurs.encre2}>
                    {' '}({a.unite})
                  </T>
                ) : null}
              </T>
              <T g={700} taille={13}>
                {formater(n.kcal)} kcal ·{' '}
                <T g={700} taille={13} couleur={couleurs.terreFoncee}>
                  {n.prot} g prot.
                </T>
              </T>
              {lignes.length > 1 ? (
                <Pressable onPress={() => setBrouillon(retirerAliment(b, i))} accessibilityRole="button" accessibilityLabel={`Retirer ${a.nom}`} hitSlop={10} style={{ alignSelf: 'center' }}>
                  <Icone nom="croix" taille={16} couleur={couleurs.encre2} epaisseur={2.4} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Rond icone="moins" label={`Diminuer la quantité de ${a.nom.toLowerCase()}`} onPress={() => setBrouillon(avecGrammes(b, i, Math.max(pas, l.grammes - pas)))} />
                <T g={800} taille={16} centre style={{ minWidth: 60 }}>
                  {l.grammes} g
                </T>
                <Rond icone="plus" label={`Augmenter la quantité de ${a.nom.toLowerCase()}`} onPress={() => setBrouillon(avecGrammes(b, i, l.grammes + pas))} />
              </View>
              <View>
                {a.source === 'FAO/INFOODS' ? <Etiquette texte="Sourcé · FAO/INFOODS" ton="feuille" icone="coche" /> : <Etiquette texte="Estimé · à vérifier" ton="terre" icone="info" />}
              </View>
            </View>
          </View>
        );
      })}

      <Pressable
        onPress={() => router.push({ pathname: '/choisir', params: { mode: 'ajouter' } })}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: couleurs.traitsFonces, borderRadius: 18, padding: 12 }}
      >
        <Icone nom="plus" taille={18} couleur={couleurs.terreCuite} epaisseur={2.6} />
        <T g={700} taille={14} couleur={couleurs.encre2}>
          Ajouter un aliment
        </T>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
        <Icone nom="goutte" taille={18} couleur={couleurs.terreCuite} />
        <T taille={13} interligne={1.4} couleur={couleurs.encre2} style={{ flex: 1 }}>
          Huile de cuisson :{' '}
          <T g={700} taille={13}>
            {textesHuile[b.huile]}
          </T>
          , déjà comptée dans les valeurs ci-dessus.
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: couleurs.encre, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18 }}>
        <T g={700} taille={14} couleur={couleurs.sable}>
          Total du repas
        </T>
        <T g={800} taille={15} couleur={couleurs.sable}>
          {formater(total.kcal)} kcal ·{' '}
          <T g={800} taille={15} couleur={couleurs.peche}>
            {total.prot} g prot.
          </T>
        </T>
      </View>

      <Pressable onPress={signaler} disabled={signale} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10, backgroundColor: couleurs.sable, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'flex-start' }}>
        <Icone nom={signale ? 'coche' : 'drapeau'} taille={20} couleur={signale ? couleurs.feuille : couleurs.terreFoncee} />
        {signale ? (
          <T taille={13} interligne={1.45} style={{ flex: 1 }}>
            <T g={700} taille={13}>
              Merci, c'est noté.
            </T>{' '}
            On vérifie ces valeurs avec un nutritionniste et on corrige la base pour tout le monde.
          </T>
        ) : (
        <T taille={13} interligne={1.45} style={{ flex: 1 }}>
          Un chiffre te semble faux ?{' '}
          <T g={700} taille={13}>
            Signale-le.
          </T>{' '}
          On le vérifie avec un nutritionniste et on corrige la base pour tout le monde.
        </T>
        )}
      </Pressable>
    </Ecran>
  );
}

function Rond({ icone, label, onPress }: { icone: 'plus' | 'moins'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: couleurs.traitsFonces,
        backgroundColor: pressed ? couleurs.sable : couleurs.blanc,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icone nom={icone} taille={18} couleur={couleurs.encre} epaisseur={2.6} />
    </Pressable>
  );
}
