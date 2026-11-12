import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone, type NomIcone } from '../../components/Icone';
import { T } from '../../components/T';
import { Ecran, Etiquette, Puce } from '../../components/ui';
import { totalClient } from '../../lib/coach.ts';
import { formater } from '../../lib/nutrition.ts';
import { useStore } from '../../state/store';
import { couleurs } from '../../theme';

type Filtre = 'aCorriger' | 'tous' | 'inactifs';

export default function CoachClients() {
  const insets = useSafeAreaInsets();
  const { etat, dispatch } = useStore();
  const [filtre, setFiltre] = useState<Filtre>('aCorriger');
  const clients = etat.clients;
  const aCorriger = clients.filter((c) => c.repas?.statut === 'aCorriger');
  const inactifs = clients.filter((c) => !c.repas && (c.joursSansRepas ?? 0) > 0);
  const liste = filtre === 'aCorriger' ? aCorriger : filtre === 'inactifs' ? inactifs : clients;

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.fond }}>
      <Ecran espaceBas={20}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <T g={500} taille={13} couleur={couleurs.encre2}>
              {clients.length} clients suivis
            </T>
            <T g={800} taille={28} espacement={-0.02} accessibilityRole="header">
              Mes clients
            </T>
          </View>
          <View style={{ marginTop: 4 }}>
            <Etiquette texte="Mode coach" ton="encre" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: couleurs.encre, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: couleurs.terreCuite, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom={aCorriger.length ? 'crayon' : 'coche'} couleur={couleurs.blanc} />
          </View>
          <View style={{ gap: 2, flex: 1 }}>
            <T g={800} taille={20} couleur={couleurs.sable}>
              {aCorriger.length ? `${aCorriger.length} repas à corriger` : 'Tout est à jour'}
            </T>
            <T taille={13} couleur={couleurs.sableClair}>
              L’app a déjà estimé. Tu valides ou tu ajustes.
            </T>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Puce titre={`À corriger · ${aCorriger.length}`} actif={filtre === 'aCorriger'} onPress={() => setFiltre('aCorriger')} couleurActive={couleurs.terreCuite} />
          <Puce titre={`Tous · ${clients.length}`} actif={filtre === 'tous'} onPress={() => setFiltre('tous')} couleurActive={couleurs.terreCuite} />
          <Puce titre={`Inactifs · ${inactifs.length}`} actif={filtre === 'inactifs'} onPress={() => setFiltre('inactifs')} couleurActive={couleurs.terreCuite} />
        </View>

        <View style={{ gap: 8 }}>
          {liste.length === 0 ? (
            <T taille={14} couleur={couleurs.encre2} centre style={{ paddingVertical: 20 }}>
              Rien ici pour le moment.
            </T>
          ) : null}
          {liste.map((c) => {
            const t = totalClient(c);
            const statut = c.repas?.statut;
            const fondAvatar = statut === 'aCorriger' ? couleurs.terreDouce : statut === 'valide' ? couleurs.feuilleDouce : couleurs.sable;
            const texteAvatar = statut === 'aCorriger' ? couleurs.terreFoncee : statut === 'valide' ? couleurs.feuille : couleurs.encre;
            return (
              <Pressable
                key={c.id}
                disabled={!c.repas}
                onPress={() => router.push({ pathname: '/coach/[id]', params: { id: c.id } })}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: couleurs.blanc,
                  borderWidth: 1,
                  borderColor: couleurs.traits,
                  borderRadius: 18,
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: fondAvatar, alignItems: 'center', justifyContent: 'center' }}>
                  <T g={800} taille={14} couleur={texteAvatar}>
                    {c.initiales}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <T g={700} taille={15}>
                    {c.nom}
                  </T>
                  <T taille={12} couleur={couleurs.encre2} numberOfLines={1}>
                    {c.repas ? `${c.repas.nom} · ${c.repas.heure}` : `Aucun repas depuis ${c.joursSansRepas} jours`}
                  </T>
                </View>
                {c.repas && t ? (
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T g={800} taille={12}>
                      {formater(t.kcal)} kcal · {t.prot} g
                    </T>
                    {statut === 'aCorriger' ? <Etiquette texte="À corriger" ton="terre" petite /> : <Etiquette texte="Validé" ton="feuille" icone="coche" petite />}
                  </View>
                ) : (c.joursSansRepas ?? 0) > 0 ? (
                  <Pressable
                    onPress={() => dispatch({ type: 'relancerClient', id: c.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Relancer ${c.nom}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: couleurs.terreCuite, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}
                  >
                    <Icone nom="cloche" taille={14} couleur={couleurs.terreFoncee} />
                    <T g={700} taille={12} couleur={couleurs.terreFoncee}>
                      Relancer
                    </T>
                  </Pressable>
                ) : (
                  <Etiquette texte="Relancé" ton="feuille" icone="coche" petite />
                )}
              </Pressable>
            );
          })}
        </View>
      </Ecran>

      <View style={{ flexDirection: 'row', backgroundColor: couleurs.blanc, borderTopWidth: 1, borderTopColor: couleurs.traits, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) }}>
        <Onglet icone="groupe" titre="Clients" actif />
        <Onglet icone="grille" titre="Plats" onPress={() => router.navigate('/(onglets)/plats')} />
        <Onglet icone="maison" titre="Mon suivi" onPress={() => router.navigate('/(onglets)')} />
      </View>
    </View>
  );
}

function Onglet({ icone, titre, actif, onPress }: { icone: NomIcone; titre: string; actif?: boolean; onPress?: () => void }) {
  const couleur = actif ? couleurs.terreCuite : couleurs.encre2;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: !!actif }} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Icone nom={icone} couleur={couleur} />
      <T g={actif ? 700 : 600} taille={11} couleur={couleur}>
        {titre}
      </T>
    </Pressable>
  );
}
