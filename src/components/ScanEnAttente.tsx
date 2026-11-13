import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { supprimerPhoto } from '../services/photosEnAttente';
import { nouveauBrouillon, useBrouillon } from '../state/brouillon';
import { nomsCreneaux, useStore, type ScanEnAttente as Scan } from '../state/store';
import { couleurs } from '../theme';
import { Icone } from './Icone';
import { T } from './T';

/** Un repas photographié qui attend le réseau, est en cours d'analyse, est prêt, ou a échoué. */
export function CarteScanEnAttente({ scan }: { scan: Scan }) {
  const { dispatch } = useStore();
  const { setBrouillon } = useBrouillon();
  const source = scan.photoUri ? { uri: scan.photoUri } : scan.photoBase64 ? { uri: `data:image/jpeg;base64,${scan.photoBase64}` } : null;

  const ouvrir = () => {
    if (scan.statut !== 'pret' || !scan.resultat) return;
    const r = scan.resultat;
    setBrouillon(
      nouveauBrouillon({
        nom: r.nom,
        lignes: r.lignes,
        reconnu: r.reconnu,
        mode: 'serveur',
        photoUri: scan.photoUri ?? undefined,
        scanId: r.scanId,
        inconnus: r.inconnus,
        remarque: r.remarque,
        creneau: scan.creneau,
        jour: scan.jour,
        heure: scan.heure,
        cleAttente: scan.cle,
      }),
    );
    router.push('/resultat');
  };

  const supprimer = () => {
    supprimerPhoto(scan.photoUri);
    dispatch({ type: 'retirerScanAttente', cle: scan.cle });
  };

  const etat =
    scan.statut === 'pret'
      ? { titre: scan.resultat?.nom ?? 'Repas analysé', texte: 'Prêt à vérifier', couleur: couleurs.feuille }
      : scan.statut === 'envoi'
        ? { titre: 'Analyse en cours…', texte: 'Envoi de la photo', couleur: couleurs.encre2 }
        : scan.statut === 'echec'
          ? { titre: 'Analyse impossible', texte: scan.erreur ?? 'Réessaie ou choisis ton plat dans la liste.', couleur: couleurs.terreFoncee }
          : { titre: 'En attente de réseau', texte: 'Analysé automatiquement dès que la connexion revient', couleur: couleurs.terreFoncee };

  return (
    <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1.5, borderColor: scan.statut === 'pret' ? couleurs.feuille : couleurs.traitsFonces, borderStyle: scan.statut === 'pret' ? 'solid' : 'dashed', borderRadius: 18, padding: 10, gap: 10 }}>
      <Pressable
        onPress={ouvrir}
        disabled={scan.statut !== 'pret'}
        accessibilityRole={scan.statut === 'pret' ? 'button' : undefined}
        accessibilityLabel={`${nomsCreneaux[scan.creneau]} ${scan.heure}. ${etat.titre}. ${etat.texte}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: couleurs.sable, alignItems: 'center', justifyContent: 'center' }}>
          {source ? <Image source={source} style={{ width: 52, height: 52 }} accessibilityLabel="Photo du repas" /> : <Icone nom="appareil" couleur={couleurs.encre2} />}
          {scan.statut === 'envoi' ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,18,11,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={couleurs.blanc} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <T g={500} taille={12} couleur={couleurs.encre2}>
            {nomsCreneaux[scan.creneau]} · {scan.heure}
          </T>
          <T g={700} taille={15} numberOfLines={1}>
            {etat.titre}
          </T>
          <T g={600} taille={12} couleur={etat.couleur} numberOfLines={2}>
            {etat.texte}
          </T>
        </View>
        {scan.statut === 'pret' ? <Icone nom="droite" taille={18} couleur={couleurs.feuille} /> : null}
      </Pressable>

      {scan.statut === 'echec' || scan.statut === 'attente' ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {scan.statut === 'echec' ? <Action titre="Réessayer" onPress={() => dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'attente', erreur: undefined, essais: 1 } })} /> : null}
          <Action
            titre="Choisir dans la liste"
            onPress={() => {
              supprimer();
              router.push({ pathname: '/choisir', params: { mode: 'nouveau', jour: scan.jour } });
            }}
          />
          <Action titre="Supprimer" onPress={supprimer} />
        </View>
      ) : null}
    </View>
  );
}

function Action({ titre, onPress }: { titre: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ borderWidth: 1.5, borderColor: couleurs.traits, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11, opacity: pressed ? 0.7 : 1 })}
    >
      <T g={700} taille={12}>
        {titre}
      </T>
    </Pressable>
  );
}
