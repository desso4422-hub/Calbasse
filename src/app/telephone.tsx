import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Carte, Ecran, Puce } from '../components/ui';
import { depuisCle } from '../lib/nutrition.ts';
import { serveurConfigure } from '../services/api';
import { demanderCode, ErreurTelephone, pays, verifierCode } from '../services/telephone';
import { useStore } from '../state/store';
import { couleurs, polices } from '../theme';

/**
 * Ajouter son numéro (protéger son compte) ou retrouver un compte existant.
 * ?mode=recuperer depuis l'accueil : « J'ai déjà un compte Premium ».
 */
export default function Telephone() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const recuperation = mode === 'recuperer';
  const { dispatch } = useStore();
  const [indicatif, setIndicatif] = useState(pays[0].indicatif);
  const [numero, setNumero] = useState('');
  const [code, setCode] = useState('');
  const [etape, setEtape] = useState<'numero' | 'code' | 'fini'>('numero');
  const [numeroMasque, setNumeroMasque] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ recupere: boolean; premiumJusquau: string | null } | null>(null);
  const [attente, setAttente] = useState(0);

  // Délai avant de pouvoir redemander un code
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente(attente - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const choisi = pays.find((p) => p.indicatif === indicatif) ?? pays[0];
  const chiffres = numero.replace(/\D/g, '');

  const envoyer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await demanderCode(numero, indicatif);
      setNumeroMasque(r.numeroMasque);
      setEtape('code');
      setCode('');
      setAttente(60);
    } catch (e) {
      setErreur(e instanceof ErreurTelephone ? e.message : 'Envoi impossible. Réessaie.');
    } finally {
      setEnCours(false);
    }
  };

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await verifierCode(numero, indicatif, code);
      dispatch({ type: 'majCompteServeur', compte: r.compte });
      setResultat({ recupere: r.recupere, premiumJusquau: r.compte.premium?.jusquau ?? null });
      setEtape('fini');
    } catch (e) {
      setErreur(e instanceof ErreurTelephone ? e.message : 'Vérification impossible. Réessaie.');
    } finally {
      setEnCours(false);
    }
  };

  if (!serveurConfigure) {
    return (
      <Ecran padding={24} bas={<Bouton titre="Fermer" onPress={() => router.back()} />}>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
        <T g={800} taille={26}>
          Bientôt disponible
        </T>
        <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
          La vérification du numéro de téléphone nécessite le serveur Calbasse (mode démo).
        </T>
      </Ecran>
    );
  }

  if (etape === 'fini' && resultat) {
    const fin = resultat.premiumJusquau ? depuisCle(resultat.premiumJusquau).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    return (
      <Ecran padding={24} bas={<Bouton titre="Continuer" onPress={() => router.back()} />}>
        <View style={{ alignItems: 'center', gap: 16, marginTop: 48 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: couleurs.feuilleDouce, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="coche" taille={36} couleur={couleurs.feuille} epaisseur={3} />
          </View>
          <T g={800} taille={26} centre accessibilityRole="header">
            {resultat.recupere ? 'Compte retrouvé' : 'Numéro enregistré'}
          </T>
          <T taille={15} interligne={1.5} couleur={couleurs.encre2} centre>
            {resultat.recupere
              ? fin
                ? `Ton abonnement Premium est de retour, valable jusqu’au ${fin}. Ton ancien téléphone est déconnecté.`
                : 'Ton compte est de retour sur ce téléphone. Ton ancien téléphone est déconnecté.'
              : 'Si tu changes de téléphone, tu retrouveras ton compte et ton abonnement avec ce numéro.'}
          </T>
          {resultat.recupere ? (
            <T taille={13} interligne={1.45} couleur={couleurs.encre2} centre>
              L’historique de tes repas reste sur l’ancien téléphone : il n’est pas encore sauvegardé en ligne.
            </T>
          ) : null}
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran
      padding={24}
      bas={
        etape === 'numero' ? (
          <Bouton titre="Recevoir un code par SMS" icone="telephone" onPress={envoyer} chargement={enCours} desactive={chiffres.length < 8} />
        ) : (
          <>
            <Bouton titre="Valider" onPress={valider} chargement={enCours} desactive={code.replace(/\D/g, '').length !== 6} />
            <Bouton
              variante="lien"
              titre={attente > 0 ? `Renvoyer un code dans ${attente} s` : 'Renvoyer un code'}
              onPress={() => (attente > 0 ? undefined : envoyer())}
            />
          </>
        )
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BoutonRond
          icone={etape === 'code' ? 'gauche' : 'croix'}
          label={etape === 'code' ? 'Changer de numéro' : 'Fermer'}
          onPress={() => (etape === 'code' ? setEtape('numero') : router.back())}
        />
        <Logo />
      </View>

      {etape === 'numero' ? (
        <>
          <View style={{ gap: 8 }}>
            <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              {recuperation ? 'Retrouve ton compte' : 'Protège ton compte'}
            </T>
            <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
              {recuperation
                ? 'Entre le numéro que tu avais vérifié sur ton ancien téléphone. Ton abonnement Premium te suivra.'
                : 'Avec ton numéro, tu retrouveras ton compte et ton abonnement Premium si tu changes de téléphone. On ne t’enverra pas de publicité.'}
            </T>
          </View>

          <View style={{ gap: 8 }}>
            <T g={700} taille={13}>
              Pays
            </T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
              {pays.map((p) => (
                <Puce key={p.indicatif} titre={`${p.nom} +${p.indicatif}`} actif={p.indicatif === indicatif} onPress={() => setIndicatif(p.indicatif)} />
              ))}
            </ScrollView>
          </View>

          <View style={{ gap: 8 }}>
            <T g={700} taille={13}>
              Numéro de téléphone
            </T>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 56,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: couleurs.traits,
                backgroundColor: couleurs.blanc,
                paddingHorizontal: 14,
                gap: 10,
              }}
            >
              <T g={700} taille={17}>
                +{indicatif}
              </T>
              <TextInput
                value={numero}
                onChangeText={setNumero}
                placeholder={choisi.exemple}
                placeholderTextColor="#B8A27F"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessibilityLabel="Numéro de téléphone"
                style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: polices[600], fontSize: 17, color: couleurs.encre }}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              Entre le code
            </T>
            <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
              On a envoyé un code à 6 chiffres au {numeroMasque}. Il est valable 10 minutes.
            </T>
          </View>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor="#B8A27F"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={6}
            accessibilityLabel="Code reçu par SMS"
            style={{
              height: 64,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: couleurs.traits,
              backgroundColor: couleurs.blanc,
              textAlign: 'center',
              fontFamily: polices[800],
              fontSize: 30,
              letterSpacing: 10,
              color: couleurs.encre,
            }}
          />
        </>
      )}

      {erreur ? (
        <Carte style={{ backgroundColor: couleurs.terreDouce, borderWidth: 0, flexDirection: 'row', gap: 10 }}>
          <Icone nom="info" taille={18} couleur={couleurs.terreFoncee} />
          <T g={600} taille={13} interligne={1.4} couleur={couleurs.terreFoncee} style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {erreur}
          </T>
        </Carte>
      ) : null}
    </Ecran>
  );
}
