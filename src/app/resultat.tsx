import { Redirect, router } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlimentsReconnus } from '../components/AlimentsReconnus';
import { Assiette } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Segment } from '../components/ui';
import { trouverAliment } from '../lib/aliments.ts';
import { arrondirNutriments, formater, fourchette, totalRepas, type Huile, type Portion } from '../lib/nutrition.ts';
import { supprimerPhoto } from '../services/photosEnAttente';
import { envoyerCorrection } from '../services/reconnaissance';
import { lignesEffectives, nomBrouillon, useBrouillon, versRepas } from '../state/brouillon';
import { nomsCreneaux, ordreCreneaux, useStore } from '../state/store';
import { couleurs } from '../theme';

export default function Resultat() {
  const insets = useSafeAreaInsets();
  const { etat, dispatch } = useStore();
  const { brouillon, setBrouillon } = useBrouillon();
  if (!brouillon) return <Redirect href="/(onglets)" />;
  const b = brouillon;

  const lignes = lignesEffectives(b);
  const total = arrondirNutriments(totalRepas(lignes, b.huile));
  const f = fourchette(total.kcal);
  const vide = lignes.length === 0;

  const feculent = lignes.find((l) => trouverAliment(l.alimentId).suitPortion);
  const aidePortion = feculent ? `≈ ${feculent.grammes} g de ${trouverAliment(feculent.alimentId).nom.toLowerCase()}` : '';
  const aideHuile = b.huile === 'peu' ? '−80 kcal' : b.huile === 'beaucoup' ? '+150 kcal' : 'Quantité habituelle';

  const sousTitre = vide
    ? "On n'a pas reconnu ce plat. Ajoute ses aliments un par un."
    : b.mode === 'demo'
      ? 'Mode démo : vérifie bien les aliments, puis ajuste la portion et l’huile.'
      : b.mode === 'manuel'
        ? 'Ajuste la portion et l’huile.'
        : b.remarque
          ? b.remarque
          : 'Plat reconnu. Vérifie, puis ajuste la portion et l’huile.';

  const changerCreneau = () => {
    const i = ordreCreneaux.indexOf(b.creneau);
    setBrouillon({ ...b, creneau: ordreCreneaux[(i + 1) % ordreCreneaux.length] });
  };

  const enregistrer = () => {
    const repas = versRepas(b);
    if (b.scanId && b.lignesProposees) envoyerCorrection(b.scanId, b.lignesProposees, lignes);
    dispatch({ type: 'enregistrerRepas', repas });
    if (b.cleAttente) {
      // Le repas mis de côté est enregistré : on libère sa photo
      supprimerPhoto(etat.scansEnAttente?.find((x) => x.cle === b.cleAttente)?.photoUri);
      dispatch({ type: 'retirerScanAttente', cle: b.cleAttente });
    }
    setBrouillon(null);
    router.dismissTo('/(onglets)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 196 + insets.top, backgroundColor: '#3A2516', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
          {b.photoUri ? (
            <Image source={{ uri: b.photoUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityLabel="Photo du repas" />
          ) : (
            <Assiette lignes={lignes} taille={168} fond="#EBDDBE" />
          )}
          <View style={{ position: 'absolute', left: 20, top: insets.top + 14 }}>
            <BoutonRond icone="gauche" label="Retour" fond={couleurs.nuit2} couleur={couleurs.sable} onPress={() => router.back()} />
          </View>
          <Pressable
            onPress={changerCreneau}
            accessibilityRole="button"
            accessibilityLabel={`Repas : ${nomsCreneaux[b.creneau]}. Toucher pour changer`}
            style={{ position: 'absolute', right: 20, top: insets.top + 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: couleurs.sable, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}
          >
            <T g={700} taille={13}>
              {nomsCreneaux[b.creneau]}
            </T>
            <Icone nom="droite" taille={14} couleur={couleurs.encre} epaisseur={2.6} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
          <View style={{ gap: 3 }}>
            <T g={800} taille={23} interligne={1.15} espacement={-0.02} accessibilityRole="header">
              {vide ? 'Plat à préciser' : nomBrouillon(b)}
            </T>
            <T taille={13} couleur={couleurs.encre2} interligne={1.4}>
              {sousTitre}
            </T>
          </View>

          <AlimentsReconnus b={b} setBrouillon={setBrouillon} />

          {!vide ? (
            <>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T g={800} taille={15}>
                    Portion
                  </T>
                  <T g={600} taille={12} couleur={couleurs.encre2}>
                    {aidePortion}
                  </T>
                </View>
                <Segment<Portion>
                  options={[
                    { valeur: 'S', titre: 'Petite' },
                    { valeur: 'M', titre: 'Moyenne' },
                    { valeur: 'L', titre: 'Grande' },
                  ]}
                  valeur={b.portion}
                  onChange={(portion) => setBrouillon({ ...b, portion })}
                />
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T g={800} taille={15}>
                    Huile de cuisson
                  </T>
                  <T g={600} taille={12} couleur={couleurs.encre2}>
                    {aideHuile}
                  </T>
                </View>
                <Segment<Huile>
                  icone="goutte"
                  options={[
                    { valeur: 'peu', titre: 'Peu' },
                    { valeur: 'normal', titre: 'Normal' },
                    { valeur: 'beaucoup', titre: 'Beaucoup' },
                  ]}
                  valeur={b.huile}
                  onChange={(huile) => setBrouillon({ ...b, huile })}
                />
              </View>

              <View style={{ backgroundColor: couleurs.encre, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <View style={{ gap: 2 }}>
                    <T g={700} taille={12} couleur={couleurs.sableClair}>
                      Protéines
                    </T>
                    <T g={800} taille={42} couleur={couleurs.peche}>
                      {total.prot}
                      <T g={700} taille={18} couleur={couleurs.peche}>
                        {' '}g
                      </T>
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <T g={700} taille={12} couleur={couleurs.sableClair}>
                      Calories
                    </T>
                    <T g={800} taille={28} couleur={couleurs.sable}>
                      {formater(total.kcal)}
                      <T g={700} taille={14} couleur={couleurs.sable}>
                        {' '}kcal
                      </T>
                    </T>
                    <T g={500} taille={12} couleur={couleurs.sableClair}>
                      Entre {formater(f.bas)} et {formater(f.haut)}
                    </T>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#4A3322', paddingTop: 10 }}>
                  <T g={500} taille={12} couleur={couleurs.sableClair}>
                    Glucides {total.gluc} g · Lipides {total.lip} g
                  </T>
                  <Pressable onPress={() => router.push('/detail')} accessibilityRole="link" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <T g={700} taille={12} couleur={couleurs.peche}>
                      Détail et sources
                    </T>
                    <Icone nom="droite" taille={14} couleur={couleurs.peche} epaisseur={2.6} />
                  </Pressable>
                </View>
              </View>

              <Bouton titre={`Enregistrer dans ${nomsCreneaux[b.creneau]}`} onPress={enregistrer} hauteur={54} />
            </>
          ) : (
            <Bouton titre="Choisir dans la liste" icone="liste" onPress={() => router.push({ pathname: '/choisir', params: { mode: 'ajouter' } })} hauteur={54} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
