import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { trouverAliment } from '../lib/aliments.ts';
import { confirmerAliment, remplacerAliment, retirerAliment, type Brouillon } from '../state/brouillon';
import { couleurs } from '../theme';
import { Icone } from './Icone';
import { T } from './T';

/**
 * Les aliments reconnus, sous forme de pastilles.
 * Vert : sûr. Orange : à vérifier — un toucher propose les alternatives du modèle, « Autre aliment » ou « Retirer ».
 */
export function AlimentsReconnus({ b, setBrouillon }: { b: Brouillon; setBrouillon: (b: Brouillon) => void }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const aVerifier = b.lignesBase.some((l) => l.confiance === 'moyenne' || l.confiance === 'basse');
  const choisi = ouvert !== null ? b.lignesBase[ouvert] : undefined;

  const appliquer = (nouveau: Brouillon) => {
    setBrouillon(nouveau);
    setOuvert(null);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {b.lignesBase.map((l, i) => {
          const doute = l.confiance === 'moyenne' || l.confiance === 'basse';
          const actif = ouvert === i;
          const nom = trouverAliment(l.alimentId).nom;
          return (
            <Pressable
              key={`${l.alimentId}-${i}`}
              onPress={() => setOuvert(actif ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ expanded: actif }}
              accessibilityLabel={doute ? `${nom}, à vérifier` : nom}
              accessibilityHint="Touche pour changer ou retirer cet aliment"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: actif ? couleurs.encre : doute ? couleurs.terreDouce : couleurs.feuilleDouce,
                borderWidth: 1.5,
                borderColor: actif ? couleurs.encre : doute ? couleurs.terreCuite : couleurs.feuilleDouce,
                borderRadius: 999,
                paddingVertical: 6,
                paddingHorizontal: 12,
              }}
            >
              <Icone
                nom={doute ? 'info' : 'coche'}
                taille={14}
                couleur={actif ? couleurs.blanc : doute ? couleurs.terreFoncee : couleurs.feuille}
                epaisseur={doute ? 2.6 : 3.2}
              />
              <T g={700} taille={13} couleur={actif ? couleurs.blanc : doute ? couleurs.terreFoncee : couleurs.feuille}>
                {nom}
              </T>
            </Pressable>
          );
        })}
        {(b.inconnus ?? []).map((inc, i) => (
          <Pressable
            key={`inconnu-${i}`}
            onPress={() => router.push({ pathname: '/choisir', params: { mode: 'ajouter', inconnu: String(i) } })}
            accessibilityRole="button"
            accessibilityLabel={`Aliment non reconnu : ${inc.description}. Toucher pour le choisir dans la liste`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: couleurs.terreCuite, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: '100%' }}
          >
            <Icone nom="loupe" taille={14} couleur={couleurs.terreFoncee} epaisseur={2.6} />
            <T g={700} taille={13} couleur={couleurs.terreFoncee} numberOfLines={1} style={{ flexShrink: 1 }}>
              {inc.description}
            </T>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push({ pathname: '/choisir', params: { mode: 'ajouter' } })}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un aliment"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B8A27F', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}
        >
          <Icone nom="plus" taille={14} couleur={couleurs.encre2} epaisseur={3} />
          <T g={700} taille={13} couleur={couleurs.encre2}>
            Ajouter
          </T>
        </Pressable>
      </View>

      {choisi && ouvert !== null ? (
        <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 18, padding: 14, gap: 10 }}>
          <T g={800} taille={15}>
            {choisi.confiance === 'moyenne' || choisi.confiance === 'basse'
              ? `C'est bien ${trouverAliment(choisi.alimentId).nom.toLowerCase()} ?`
              : trouverAliment(choisi.alimentId).nom}
          </T>
          {choisi.alternatives?.length ? (
            <View style={{ gap: 8 }}>
              <T g={600} taille={12} couleur={couleurs.encre2}>
                Ou plutôt :
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {choisi.alternatives.map((alt) => (
                  <Pressable
                    key={alt}
                    onPress={() => appliquer(remplacerAliment(b, ouvert, alt))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remplacer par ${trouverAliment(alt).nom}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: couleurs.fond, borderWidth: 1.5, borderColor: couleurs.traits, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: trouverAliment(alt).couleur, borderWidth: 1.5, borderColor: trouverAliment(alt).contour }} />
                    <T g={700} taille={13}>
                      {trouverAliment(alt).nom}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {choisi.confiance === 'moyenne' || choisi.confiance === 'basse' ? (
              <Action titre="Oui, c'est ça" icone="coche" plein onPress={() => appliquer(confirmerAliment(b, ouvert))} />
            ) : null}
            <Action
              titre="Autre aliment"
              icone="liste"
              onPress={() => {
                setOuvert(null);
                router.push({ pathname: '/choisir', params: { mode: 'remplacer', index: String(ouvert) } });
              }}
            />
            <Action titre="Retirer" icone="croix" onPress={() => appliquer(retirerAliment(b, ouvert))} />
          </View>
        </View>
      ) : aVerifier ? (
        <T g={600} taille={12} couleur={couleurs.terreFoncee}>
          Touche un aliment en orange pour le vérifier.
        </T>
      ) : null}
    </View>
  );
}

function Action({ titre, icone, onPress, plein }: { titre: string; icone: 'coche' | 'liste' | 'croix'; onPress: () => void; plein?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: plein ? couleurs.terreCuite : couleurs.blanc,
        borderWidth: 1.5,
        borderColor: plein ? couleurs.terreCuite : couleurs.traits,
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 12,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icone nom={icone} taille={15} couleur={plein ? couleurs.blanc : couleurs.encre} epaisseur={2.6} />
      <T g={700} taille={13} couleur={plein ? couleurs.blanc : couleurs.encre}>
        {titre}
      </T>
    </Pressable>
  );
}
