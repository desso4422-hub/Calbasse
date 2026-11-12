import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Assiette } from '../../components/Graphiques';
import { Icone } from '../../components/Icone';
import { T } from '../../components/T';
import { Bouton, BoutonRond, Ecran, Segment } from '../../components/ui';
import { reponsesRapides } from '../../lib/coach.ts';
import { appliquerPortion, arrondirNutriments, formater, totalRepas, type Huile, type Portion } from '../../lib/nutrition.ts';
import { useStore } from '../../state/store';
import { couleurs } from '../../theme';

export default function CoachCorriger() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { etat, dispatch } = useStore();
  const client = etat.clients.find((c) => c.id === id);
  const [portion, setPortion] = useState<Portion>(client?.repas?.correction?.portion ?? 'M');
  const [huile, setHuile] = useState<Huile>(client?.repas?.correction?.huile ?? client?.repas?.huileEstimee ?? 'normal');
  const [reponse, setReponse] = useState<string | undefined>(client?.repas?.correction?.message);
  if (!client || !client.repas) return <Redirect href="/coach" />;
  const repas = client.repas;
  const prenom = client.nom.split(' ')[0];

  const estime = arrondirNutriments(totalRepas(repas.lignes, repas.huileEstimee));
  const corrige = arrondirNutriments(totalRepas(appliquerPortion(repas.lignes, portion), huile));
  const ecart = corrige.kcal - estime.kcal;
  const delta = ecart === 0 ? 'Identique' : `${ecart > 0 ? '+' : '−'}${formater(Math.abs(ecart))} kcal`;

  const valider = () => {
    dispatch({ type: 'corrigerClient', id: client.id, portion, huile, message: reponse });
    router.back();
  };

  return (
    <Ecran bas={<Bouton titre={reponse ? 'Valider et envoyer' : 'Valider'} icone="envoyer" onPress={valider} hauteur={54} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BoutonRond icone="gauche" label="Retour aux clients" taille={40} onPress={() => router.back()} />
        <View style={{ gap: 1 }}>
          <T g={800} taille={20} espacement={-0.01} accessibilityRole="header">
            {client.nom}
          </T>
          <T taille={12} couleur={couleurs.encre2}>
            {repas.creneau} · photo reçue à {repas.heure}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
        <View style={{ width: 128, height: 128, borderRadius: 20, backgroundColor: '#3A2516', alignItems: 'center', justifyContent: 'center' }}>
          <Assiette lignes={repas.lignes} taille={108} fond="#EBDDBE" />
        </View>
        <View style={{ flex: 1, backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center', gap: 4 }}>
          <T g={700} taille={12} couleur={couleurs.terreFoncee}>
            Estimation de l’IA
          </T>
          <T g={800} taille={15} interligne={1.2}>
            {repas.nom}
          </T>
          <T g={700} taille={13} couleur={couleurs.encre2}>
            {formater(estime.kcal)} kcal · {estime.prot} g prot.
          </T>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T g={800} taille={15}>
          Portion
        </T>
        <Segment<Portion>
          options={[
            { valeur: 'S', titre: 'Petite' },
            { valeur: 'M', titre: 'Moyenne' },
            { valeur: 'L', titre: 'Grande' },
          ]}
          valeur={portion}
          onChange={setPortion}
        />
      </View>

      <View style={{ gap: 8 }}>
        <T g={800} taille={15}>
          Huile de cuisson
        </T>
        <Segment<Huile>
          options={[
            { valeur: 'peu', titre: 'Peu' },
            { valeur: 'normal', titre: 'Normal' },
            { valeur: 'beaucoup', titre: 'Beaucoup' },
          ]}
          valeur={huile}
          onChange={setHuile}
        />
      </View>

      <View style={{ backgroundColor: couleurs.encre, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T g={700} taille={12} couleur={couleurs.sableClair}>
            Après ta correction
          </T>
          <T g={800} taille={26} couleur={couleurs.sable}>
            {formater(corrige.kcal)}
            <T g={700} taille={13} couleur={couleurs.sable}>
              {' '}kcal
            </T>
          </T>
          <T g={700} taille={13} couleur={couleurs.peche}>
            {corrige.prot} g de protéines
          </T>
        </View>
        <View style={{ backgroundColor: couleurs.sable, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}>
          <T g={800} taille={13}>
            {delta}
          </T>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <T g={800} taille={15}>
          Réponse rapide à {prenom}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {reponsesRapides.map((r) => {
            const actif = reponse === r;
            return (
              <Pressable
                key={r}
                onPress={() => setReponse(actif ? undefined : r)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                style={{
                  backgroundColor: actif ? couleurs.encre : couleurs.blanc,
                  borderWidth: 1.5,
                  borderColor: actif ? couleurs.encre : couleurs.traits,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                }}
              >
                <T g={700} taille={13} couleur={actif ? couleurs.blanc : couleurs.encre}>
                  {r}
                </T>
              </Pressable>
            );
          })}
          <View
            accessibilityLabel="Message vocal, bientôt disponible"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: couleurs.terreDouce, borderWidth: 1.5, borderColor: couleurs.terreCuite, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, opacity: 0.6 }}
          >
            <Icone nom="micro" taille={16} couleur={couleurs.terreFoncee} />
            <T g={700} taille={13} couleur={couleurs.terreFoncee}>
              Vocal · bientôt
            </T>
          </View>
        </View>
      </View>
    </Ecran>
  );
}
