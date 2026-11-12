import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Assiette } from '../components/Graphiques';
import { ListeAliments } from '../components/ListeAliments';
import { T } from '../components/T';
import { BoutonRond, Ecran } from '../components/ui';
import { arrondirNutriments, formater, totalRepas } from '../lib/nutrition.ts';
import { platsComposes, type LigneRepas } from '../lib/plats.ts';
import { trouverAliment } from '../lib/aliments.ts';
import { ajouterAliment, nouveauBrouillon, remplacerAliment, retirerInconnu, useBrouillon, type Brouillon } from '../state/brouillon';
import { couleurs } from '../theme';

/**
 * Choisir un plat sans photo.
 * mode=nouveau : démarre un nouveau repas (depuis le scanner ou un jour passé, via ?jour=AAAA-MM-JJ)
 * mode=ajouter : ajoute un aliment au repas en cours (&inconnu=i : identifie un aliment non reconnu de la photo)
 * mode=remplacer&index=i : remplace un aliment proposé par la reconnaissance
 */
export default function Choisir() {
  const { mode, jour, index, inconnu } = useLocalSearchParams<{ mode?: string; jour?: string; index?: string; inconnu?: string }>();
  const { brouillon, setBrouillon } = useBrouillon();
  const remplacement = mode === 'remplacer' && !!brouillon && index !== undefined && !!brouillon.lignesBase[Number(index)];
  const ajout = (mode === 'ajouter' || remplacement) && !!brouillon;
  const descriptionInconnu = inconnu !== undefined ? brouillon?.inconnus?.[Number(inconnu)]?.description : undefined;

  const demarrer = (nom: string, lignes: LigneRepas[], nomFixe: boolean) => {
    let b: Brouillon = { ...nouveauBrouillon({ nom, lignes, reconnu: true, mode: 'manuel', creneau: jour ? 'dejeuner' : undefined }), nomFixe };
    if (jour) b = { ...b, jour, heure: '12:30' };
    setBrouillon(b);
    router.replace('/resultat');
  };

  return (
    <Ecran espaceBas={28}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <T g={800} taille={26} espacement={-0.02} accessibilityRole="header">
            {remplacement ? 'Remplacer par…' : ajout ? 'Ajouter un aliment' : 'Choisir un plat'}
          </T>
          <T taille={13} couleur={couleurs.encre2}>
            {remplacement
              ? `À la place de : ${trouverAliment(brouillon!.lignesBase[Number(index)].alimentId).nom.toLowerCase()}.`
              : descriptionInconnu
                ? `Sur la photo : ${descriptionInconnu}.`
                : ajout
                  ? 'Il sera ajouté à ton repas.'
                  : 'Sans photo, ça ne compte pas dans tes scans.'}
          </T>
        </View>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
      </View>

      {!ajout ? (
        <View style={{ gap: 10 }}>
          <T g={800} taille={17}>
            Plats complets
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {platsComposes.map((p) => {
              const t = arrondirNutriments(totalRepas(p.lignes));
              return (
                <Pressable
                  key={p.id}
                  onPress={() => demarrer(p.nom, p.lignes, true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.nom}, ${t.kcal} kilocalories`}
                  style={({ pressed }) => ({
                    width: 148,
                    backgroundColor: couleurs.blanc,
                    borderWidth: 1,
                    borderColor: couleurs.traits,
                    borderRadius: 18,
                    padding: 12,
                    gap: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Assiette lignes={p.lignes} taille={56} />
                  <T g={700} taille={14} numberOfLines={2} interligne={1.25} style={{ minHeight: 36 }}>
                    {p.nom}
                  </T>
                  <T g={700} taille={12} couleur={couleurs.terreFoncee}>
                    {formater(t.kcal)} kcal · {t.prot} g
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
          <T g={800} taille={17} style={{ marginTop: 4 }}>
            Ou aliment par aliment
          </T>
        </View>
      ) : null}

      <ListeAliments
        onChoisir={(a) => {
          if (remplacement && brouillon) {
            setBrouillon(remplacerAliment(brouillon, Number(index), a.id));
            router.back();
          } else if (ajout && brouillon) {
            const dejaLa = brouillon.lignesBase.find((l) => l.alimentId === a.id)?.grammes ?? 0;
            let b = ajouterAliment(brouillon, a.id);
            // Un aliment « non reconnu » identifié par l'utilisateur garde le poids estimé sur la photo
            const inc = inconnu !== undefined ? brouillon.inconnus?.[Number(inconnu)] : undefined;
            if (inc) {
              const i = b.lignesBase.findIndex((l) => l.alimentId === a.id);
              b = { ...retirerInconnu(b, Number(inconnu)), lignesBase: b.lignesBase.map((l, j) => (j === i ? { ...l, grammes: dejaLa + inc.grammes } : l)) };
            }
            setBrouillon(b);
            router.back();
          } else {
            demarrer(a.nom, [{ alimentId: a.id, grammes: a.uniteG }], false);
          }
        }}
      />
    </Ecran>
  );
}
