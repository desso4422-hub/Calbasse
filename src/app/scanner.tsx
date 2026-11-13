import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Assiette } from '../components/Graphiques';
import { Icone, type NomIcone } from '../components/Icone';
import { T } from '../components/T';
import { BoutonRond } from '../components/ui';
import { fonctions } from '../config';
import { preparerPhoto } from '../services/photo';
import { garderPhoto } from '../services/photosEnAttente';
import { ErreurQuota, ErreurReconnaissance, ErreurReseau, modeReconnaissance, reconnaitreRepas } from '../services/reconnaissance';
import { nouveauBrouillon, useBrouillon } from '../state/brouillon';
import { cleJour, heure } from '../lib/nutrition.ts';
import { creneauPourHeure, estPremium, nouvelId, scansRestants, useStore } from '../state/store';
import { couleurs, polices } from '../theme';

const COTE = 340;

export default function Scanner() {
  const insets = useSafeAreaInsets();
  const { etat, dispatch } = useStore();
  const { setBrouillon } = useBrouillon();
  const [permission, demanderPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [pret, setPret] = useState(false);
  const [flash, setFlash] = useState(false);
  const [indice, setIndice] = useState('');
  const [analyse, setAnalyse] = useState(false);

  const restants = scansRestants(etat);
  const premium = estPremium(etat);

  const [erreur, setErreur] = useState<string | null>(null);

  // Plus de scans aujourd'hui : Premium si le paiement est activé, sinon un message clair
  const quotaAtteint = () => {
    if (fonctions.premium) router.push('/premium');
    else setErreur('Tu as utilisé tous tes scans du jour. Reviens demain, ou choisis ton plat dans la liste : ça ne compte pas.');
  };

  // Étape affichée pendant l'analyse, et scan en cours (pour pouvoir le mettre de côté)
  const [etape, setEtape] = useState<'envoi' | 'analyse' | 'lent' | 'nouvel-essai'>('envoi');
  const courant = useRef<{ cle: string; base64: string; indice: string } | null>(null);
  const misDeCote = useRef(false);

  /** Garde la photo et l'analyse plus tard, dès que le réseau le permet. */
  const mettreDeCote = async () => {
    const scan = courant.current;
    if (!scan || misDeCote.current) return;
    misDeCote.current = true;
    const maintenant = new Date();
    const photoUri = await garderPhoto(scan.cle, scan.base64).catch(() => null);
    dispatch({
      type: 'ajouterScanAttente',
      scan: {
        cle: scan.cle,
        jour: cleJour(maintenant),
        heure: heure(maintenant),
        creneau: creneauPourHeure(maintenant),
        indice: scan.indice,
        photoUri,
        photoBase64: photoUri ? undefined : scan.base64,
        statut: 'attente',
        essais: 1,
      },
    });
    router.dismissTo('/(onglets)');
  };

  const analyser = async (photo: { uri: string; width: number; height: number }) => {
    if (restants <= 0) {
      quotaAtteint();
      return;
    }
    setAnalyse(true);
    setErreur(null);
    setEtape('envoi');
    misDeCote.current = false;
    const minuteries = [setTimeout(() => setEtape('analyse'), 4000), setTimeout(() => setEtape('lent'), 15000)];
    try {
      const preparee = modeReconnaissance === 'serveur' ? await preparerPhoto(photo) : { uri: photo.uri, base64: undefined };
      const cle = nouvelId();
      if (preparee.base64) courant.current = { cle, base64: preparee.base64, indice };

      // Deux essais ; si le réseau ne suit toujours pas, la photo est mise de côté (pas perdue)
      let r: Awaited<ReturnType<typeof reconnaitreRepas>> | null = null;
      for (let essai = 1; essai <= 2 && !r; essai++) {
        try {
          r = await reconnaitreRepas({ photoBase64: preparee.base64, indice, cle });
        } catch (e) {
          if (!(e instanceof ErreurReseau) || !courant.current) throw e;
          if (misDeCote.current) return;
          if (essai === 2) {
            await mettreDeCote();
            return;
          }
          setEtape('nouvel-essai');
          await new Promise((ok) => setTimeout(ok, 2000));
        }
      }
      // L'utilisateur a choisi de ne pas attendre : le résultat sera repris par la file d'attente
      if (misDeCote.current || !r) return;
      if (r.compte) dispatch({ type: 'majCompteServeur', compte: r.compte });
      if (r.pasUnRepas) {
        // Pas de nourriture sur la photo : on ne décompte pas le scan.
        setErreur(r.remarque || "On ne voit pas de repas sur cette photo. Cadre l'assiette entière, vue de dessus.");
        return;
      }
      dispatch({ type: 'compterScan' });
      setBrouillon(
        nouveauBrouillon({
          nom: r.nom,
          lignes: r.lignes,
          reconnu: r.reconnu,
          mode: r.mode,
          photoUri: photo.uri,
          scanId: r.scanId,
          inconnus: r.inconnus,
          remarque: r.remarque,
        }),
      );
      router.replace('/resultat');
    } catch (e) {
      if (misDeCote.current) return;
      if (e instanceof ErreurQuota) {
        if (e.compte) dispatch({ type: 'majCompteServeur', compte: e.compte });
        quotaAtteint();
        return;
      }
      setErreur(e instanceof ErreurReconnaissance ? e.message : 'Analyse impossible. Réessaie, ou choisis ton plat dans la liste.');
    } finally {
      minuteries.forEach(clearTimeout);
      courant.current = null;
      setAnalyse(false);
    }
  };

  const photographier = async () => {
    if (restants <= 0) return quotaAtteint();
    if (!camera.current || !pret) return;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (photo) await analyser(photo);
    } catch {
      setErreur('Photo impossible. Réessaie dans un instant.');
    }
  };

  const galerie = async () => {
    if (restants <= 0) return quotaAtteint();
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) await analyser(res.assets[0]);
  };

  const cameraAutorisee = permission?.granted;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: couleurs.nuit }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          <BoutonRond icone="croix" label="Fermer le scanner" fond={couleurs.nuit2} couleur={couleurs.sable} onPress={() => router.back()} />
          <Pressable
            onPress={() => (fonctions.premium ? router.push('/premium') : undefined)}
            disabled={!fonctions.premium}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: couleurs.nuit2, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 }}
          >
            <Icone nom="appareil" taille={16} couleur={couleurs.sable} />
            <T g={700} taille={13} couleur={couleurs.sable}>
              {premium || !fonctions.premium
                ? `${restants} scan${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''} aujourd'hui`
                : `${restants} scan${restants > 1 ? 's' : ''} gratuit${restants > 1 ? 's' : ''} aujourd'hui`}
            </T>
          </Pressable>
          <BoutonRond
            icone="eclair"
            label={flash ? 'Éteindre le flash' : 'Activer le flash'}
            fond={flash ? couleurs.sable : couleurs.nuit2}
            couleur={flash ? couleurs.encre : couleurs.sable}
            onPress={() => setFlash(!flash)}
          />
        </View>

        <View style={{ alignItems: 'center', gap: 14, marginTop: 22 }}>
          <View style={{ width: '88%', maxWidth: COTE, aspectRatio: 1, borderRadius: 26, overflow: 'hidden', backgroundColor: '#2A1A10' }}>
            {cameraAutorisee ? (
              <CameraView ref={camera} style={{ flex: 1 }} facing="back" enableTorch={flash} onCameraReady={() => setPret(true)} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
                <View style={{ opacity: 0.35, position: 'absolute' }}>
                  <Assiette lignes={[{ alimentId: 'riz-au-gras', grammes: 1 }, { alimentId: 'poulet-frit', grammes: 1 }, { alimentId: 'sauce-tomate', grammes: 1 }]} taille={260} fond="#EBDDBE" />
                </View>
                <T g={700} taille={16} couleur={couleurs.sable} centre>
                  {permission && !permission.canAskAgain ? "L'appareil photo est bloqué dans les réglages." : "Autorise l'appareil photo pour scanner ton assiette."}
                </T>
                {permission?.canAskAgain !== false ? (
                  <Pressable onPress={demanderPermission} style={{ backgroundColor: couleurs.terreCuite, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18 }}>
                    <T g={700} taille={15} couleur={couleurs.blanc}>
                      Autoriser
                    </T>
                  </Pressable>
                ) : null}
              </View>
            )}
            <Coins />
            {analyse ? (
              <View
                accessibilityLiveRegion="polite"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,18,11,0.78)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}
              >
                <ActivityIndicator color={couleurs.sable} size="large" />
                <T g={700} taille={16} couleur={couleurs.sable} centre>
                  {etape === 'envoi'
                    ? 'Envoi de la photo…'
                    : etape === 'analyse'
                      ? 'On regarde ton assiette…'
                      : etape === 'nouvel-essai'
                        ? 'Connexion coupée, nouvel essai…'
                        : 'Le réseau est lent, on continue…'}
                </T>
                {(etape === 'lent' || etape === 'nouvel-essai') && modeReconnaissance === 'serveur' ? (
                  <>
                    <Pressable
                      onPress={mettreDeCote}
                      accessibilityRole="button"
                      style={{ marginTop: 6, backgroundColor: couleurs.sable, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16 }}
                    >
                      <T g={700} taille={14}>
                        Continuer sans attendre
                      </T>
                    </Pressable>
                    <T g={500} taille={12} couleur={couleurs.sableClair} centre interligne={1.4}>
                      Ta photo est gardée : le repas sera analysé dès que le réseau le permet.
                    </T>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={{ backgroundColor: couleurs.nuit2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 }}>
            <T g={600} taille={13} couleur={couleurs.sable}>
              Cadre l’assiette entière, vue de dessus
            </T>
          </View>
        </View>

        <View style={{ marginHorizontal: 25, marginTop: 18, gap: 8 }}>
          <T g={700} taille={13} couleur={couleurs.sable}>
            Qu’y a-t-il dedans ?{' '}
            <T g={500} taille={13} couleur={couleurs.traitsFonces}>
              (facultatif)
            </T>
          </T>
          <TextInput
            value={indice}
            onChangeText={setIndice}
            placeholder="ex. riz, sauce graine, poulet, un peu d'huile"
            placeholderTextColor="#8C735C"
            accessibilityLabel="Qu'y a-t-il dans ton assiette ? Facultatif"
            style={{
              height: 52,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: couleurs.nuitTrait,
              backgroundColor: couleurs.nuit3,
              color: couleurs.sable,
              fontFamily: polices[500],
              fontSize: 14,
              paddingHorizontal: 14,
            }}
          />
        </View>

        {erreur ? (
          <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 25, marginTop: 14, flexDirection: 'row', gap: 10, backgroundColor: couleurs.nuit2, borderRadius: 14, padding: 12, alignItems: 'flex-start' }}>
            <Icone nom="info" taille={18} couleur={couleurs.peche} />
            <T g={600} taille={13} couleur={couleurs.sable} interligne={1.4} style={{ flex: 1 }}>
              {erreur}
            </T>
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 24 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24 }}>
          <Action icone="image" titre="Galerie" onPress={galerie} desactive={analyse} />
          <Pressable
            onPress={photographier}
            disabled={analyse || (cameraAutorisee && !pret)}
            accessibilityRole="button"
            accessibilityLabel="Prendre la photo"
            style={({ pressed }) => ({
              width: 84,
              height: 84,
              borderRadius: 42,
              borderWidth: 4,
              borderColor: couleurs.sable,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !cameraAutorisee || analyse ? 0.4 : pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: couleurs.sable }} />
          </Pressable>
          <Action icone="liste" titre="Choisir un plat" onPress={() => router.replace({ pathname: '/choisir', params: { mode: 'nouveau' } })} desactive={analyse} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Action({ icone, titre, onPress, desactive }: { icone: NomIcone; titre: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={desactive} accessibilityRole="button" style={{ width: 92, alignItems: 'center', gap: 6, opacity: desactive ? 0.5 : 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: couleurs.nuit2, alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={icone} couleur={couleurs.sable} />
      </View>
      <T g={600} taille={12} couleur={couleurs.sable} centre>
        {titre}
      </T>
    </Pressable>
  );
}

/** Les quatre coins du cadre de visée. */
function Coins() {
  const c = { position: 'absolute' as const, width: 44, height: 44, borderColor: couleurs.sable };
  return (
    <>
      <View pointerEvents="none" style={[c, { left: 12, top: 12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }]} />
      <View pointerEvents="none" style={[c, { right: 12, top: 12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }]} />
      <View pointerEvents="none" style={[c, { left: 12, bottom: 12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }]} />
      <View pointerEvents="none" style={[c, { right: 12, bottom: 12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }]} />
    </>
  );
}
