import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { categories, rechercherAliments, type Aliment, type Categorie } from '../lib/aliments.ts';
import { couleurs, polices } from '../theme';
import { Icone } from './Icone';
import { T } from './T';
import { Puce } from './ui';

/** Recherche + filtres + tableau « pour 100 g » (maquette Plats locaux). */
export function ListeAliments({ onChoisir, entete }: { onChoisir: (a: Aliment) => void; entete?: React.ReactNode }) {
  const [requete, setRequete] = useState('');
  const [categorie, setCategorie] = useState<Categorie | 'tous'>('tous');
  const resultats = useMemo(() => rechercherAliments(requete, categorie), [requete, categorie]);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 14, zIndex: 1 }} pointerEvents="none">
          <Icone nom="loupe" taille={20} couleur={couleurs.encre2} />
        </View>
        <TextInput
          value={requete}
          onChangeText={setRequete}
          placeholder="Rechercher un plat (attiéké, pâte rouge…)"
          placeholderTextColor="#9C8670"
          accessibilityLabel="Rechercher un plat"
          autoCorrect={false}
          style={{
            height: 50,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: couleurs.traits,
            backgroundColor: couleurs.blanc,
            fontFamily: polices[500],
            fontSize: 14,
            color: couleurs.encre,
            paddingLeft: 44,
            paddingRight: 14,
          }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
        <View style={{ width: 12 }} />
        {categories.map((c) => (
          <Puce key={c.id} titre={c.nom} actif={categorie === c.id} onPress={() => setCategorie(c.id)} />
        ))}
        <View style={{ width: 12 }} />
      </ScrollView>

      {entete}

      <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 22, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: couleurs.sable }}>
          <T g={700} taille={12}>
            Plat
          </T>
          <T g={700} taille={12}>
            Pour 100 g
          </T>
        </View>
        {resultats.length === 0 ? (
          <View style={{ padding: 20, gap: 4 }}>
            <T g={700} taille={14} centre>
              Aucun plat trouvé
            </T>
            <T taille={13} couleur={couleurs.encre2} centre>
              Ce plat manque ? Dis-le-nous, on l’ajoute à la base.
            </T>
          </View>
        ) : null}
        {resultats.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => onChoisir(a)}
            accessibilityRole="button"
            accessibilityLabel={`${a.nom}, ${a.kcal} kilocalories et ${a.prot} grammes de protéines pour 100 grammes`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 16,
              borderBottomWidth: i === resultats.length - 1 ? 0 : 1,
              borderBottomColor: '#F0E4CC',
              backgroundColor: pressed ? couleurs.fond : couleurs.blanc,
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: a.couleur, borderWidth: 2, borderColor: a.contour }} />
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T g={700} taille={15} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {a.nom}
                </T>
                {a.source === 'FAO/INFOODS' ? (
                  <Icone nom="coche" taille={14} couleur={couleurs.feuille} epaisseur={3} />
                ) : null}
              </View>
              <T taille={12} couleur={couleurs.encre2}>
                {a.unite} ≈ {a.uniteG} g{a.uniteNote ? ` ${a.uniteNote}` : ''}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 1 }}>
              <T g={800} taille={14}>
                {a.kcal} kcal
              </T>
              <T g={700} taille={12} couleur={couleurs.terreFoncee}>
                {Math.round(a.prot)} g prot.
              </T>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icone nom="coche" taille={14} couleur={couleurs.feuille} epaisseur={3} />
        <T taille={12} couleur={couleurs.encre2}>
          Sourcé FAO/INFOODS · les autres valeurs sont estimées
        </T>
      </View>
    </View>
  );
}
