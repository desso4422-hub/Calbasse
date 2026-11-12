import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icone } from '../../components/Icone';
import { T } from '../../components/T';
import { Bouton, Ecran, Etiquette } from '../../components/ui';
import { calculerBilan } from '../../lib/bilan.ts';
import { additionner, ajouterJours, arrondirNutriments, formater, joursCourts, lundi, periode, totalRepas, zero } from '../../lib/nutrition.ts';
import { estPremium, repasDuJour, useStore } from '../../state/store';
import { couleurs } from '../../theme';

const HAUTEUR = 186;

export default function Bilan() {
  const { etat } = useStore();
  const [decalage, setDecalage] = useState(0); // 0 = cette semaine, -1 = la précédente…
  if (!etat.profil) return null;
  const cibles = etat.profil.cibles;
  const premium = estPremium(etat);

  const aujourdhui = new Date();
  const debut = ajouterJours(lundi(aujourdhui), 7 * decalage);
  const fin = ajouterJours(debut, 6);
  const bilan = calculerBilan(debut, aujourdhui, cibles, (cle) => {
    const repas = repasDuJour(etat, cle);
    const t = arrondirNutriments(repas.map((r) => totalRepas(r.lignes, r.huile)).reduce(additionner, zero));
    return { prot: t.prot, kcal: t.kcal, repas: repas.length };
  });

  // Échelle : l'objectif à ~80 % de la hauteur, sauf si un jour dépasse
  const max = Math.max(cibles.prot * 1.2, ...bilan.jours.map((j) => j.prot));
  const hauteurBarre = (v: number) => Math.max(4, Math.round((v / max) * (HAUTEUR - 22)));
  const ligneObjectif = hauteurBarre(cibles.prot);

  // En gratuit, seul le bilan de la semaine en cours est ouvert
  const verrouille = !premium && decalage < 0;

  return (
    <Ecran espaceBas={28}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <T g={500} taille={13} couleur={couleurs.encre2}>
            {decalage === 0 ? `Cette semaine · ${periode(debut, fin)}` : `Bilan du dimanche · ${periode(debut, fin)}`}
          </T>
          <T g={800} taille={28} espacement={-0.02} accessibilityRole="header">
            Ta semaine
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Fleche icone="gauche" label="Semaine précédente" onPress={() => setDecalage(decalage - 1)} />
          <Fleche icone="droite" label="Semaine suivante" onPress={() => setDecalage(decalage + 1)} desactive={decalage >= 0} />
        </View>
      </View>

      {verrouille ? (
        <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 24, padding: 20, gap: 12, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: couleurs.terreDouce, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="cadenas" couleur={couleurs.terreFoncee} />
          </View>
          <T g={800} taille={17} centre>
            Ton historique complet est dans Premium
          </T>
          <T taille={14} couleur={couleurs.encre2} centre interligne={1.45}>
            Retrouve le bilan de chaque semaine passée, chaque dimanche.
          </T>
          <Bouton titre="Voir Premium" onPress={() => router.push('/premium')} hauteur={50} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 24, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ gap: 2 }}>
                <T g={700} taille={12} couleur={couleurs.terreFoncee}>
                  Protéines moyennes
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <T g={800} taille={38}>
                    {bilan.protMoyenne}
                  </T>
                  <T g={700} taille={14} couleur={couleurs.encre2}>
                    g / jour
                  </T>
                </View>
              </View>
              <Etiquette texte={`${bilan.joursAtteints} jour${bilan.joursAtteints > 1 ? 's' : ''} sur ${bilan.jours.filter((j) => !j.futur).length} dans l'objectif`} ton="feuille" icone="coche" />
            </View>

            <View accessible accessibilityLabel={`Protéines par jour : ${bilan.jours.filter((j) => !j.futur).map((j) => `${j.prot} grammes`).join(', ')}. Objectif ${cibles.prot} grammes.`}>
              <View style={{ height: HAUTEUR, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: ligneObjectif, borderTopWidth: 2, borderStyle: 'dashed', borderColor: couleurs.encre, opacity: 0.55 }}
                />
                {bilan.jours.map((j) => {
                  const atteint = j.prot >= cibles.prot;
                  return (
                    <View key={j.cle} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {!j.futur && j.repas > 0 ? (
                        <>
                          <T g={700} taille={11}>
                            {j.prot}
                          </T>
                          <View
                            style={{
                              width: 28,
                              height: hauteurBarre(j.prot),
                              borderTopLeftRadius: 8,
                              borderTopRightRadius: 8,
                              borderBottomLeftRadius: 4,
                              borderBottomRightRadius: 4,
                              backgroundColor: atteint ? couleurs.terreCuite : '#F6DCC8',
                              borderWidth: atteint ? 0 : 2,
                              borderColor: couleurs.terreCuite,
                            }}
                          />
                        </>
                      ) : (
                        <View style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: couleurs.piste }} />
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {joursCourts.map((l, i) => (
                  <T key={i} g={600} taille={12} couleur={couleurs.encre2} centre style={{ flex: 1 }}>
                    {l}
                  </T>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Legende>
                <View style={{ width: 18, borderTopWidth: 2, borderStyle: 'dashed', borderColor: couleurs.encre }} />
                <T g={600} taille={12} couleur={couleurs.encre2}>
                  Objectif {cibles.prot} g
                </T>
              </Legende>
              <Legende>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: couleurs.terreCuite }} />
                <T g={600} taille={12} couleur={couleurs.encre2}>
                  Atteint
                </T>
              </Legende>
              <Legende>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F6DCC8', borderWidth: 2, borderColor: couleurs.terreCuite }} />
                <T g={600} taille={12} couleur={couleurs.encre2}>
                  Pas encore
                </T>
              </Legende>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Chiffre titre="Calories moyennes" valeur={formater(bilan.kcalMoyenne)} unite="kcal" />
            <Chiffre titre="Repas notés" valeur={String(bilan.repasNotes)} unite={`sur ${bilan.repasAttendus}`} />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, backgroundColor: couleurs.sable, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'flex-start' }}>
            <Icone nom="coeur" taille={20} couleur={couleurs.terreFoncee} />
            <T taille={14} interligne={1.45} style={{ flex: 1 }}>
              {bilan.message}
            </T>
          </View>
        </>
      )}
    </Ecran>
  );
}

function Fleche({ icone, label, onPress, desactive }: { icone: 'gauche' | 'droite'; label: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: couleurs.sable, alignItems: 'center', justifyContent: 'center', opacity: desactive ? 0.35 : 1 }}
    >
      <Icone nom={icone} taille={20} epaisseur={2.4} />
    </Pressable>
  );
}

function Legende({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{children}</View>;
}

function Chiffre({ titre, valeur, unite }: { titre: string; valeur: string; unite: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 2 }}>
      <T g={600} taille={12} couleur={couleurs.encre2}>
        {titre}
      </T>
      <T g={800} taille={18}>
        {valeur}{' '}
        <T g={600} taille={12} couleur={couleurs.encre2}>
          {unite}
        </T>
      </T>
    </View>
  );
}
