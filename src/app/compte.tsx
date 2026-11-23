import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Carte, Ecran } from '../components/ui';
import { codeEmailValide, emailValide } from '../lib/sauvegarde.ts';
import { serveurConfigure } from '../services/api';
import { ErreurAuth, supabaseConfigure } from '../services/supabase';
import { demanderCodeConnexion, demanderLiaison, ecouterMeta, lierEmail, lireMeta, seConnecter, seDeconnecter, synchroniser, type MetaCompte } from '../services/sauvegarde';
import { useStore } from '../state/store';
import { couleurs, polices } from '../theme';

type Etape = 'email' | 'code' | 'fini';

function confirmer(titre: string, message: string, bouton: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${titre}\n\n${message}`)) action();
    return;
  }
  Alert.alert(titre, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: bouton, style: 'destructive', onPress: action },
  ]);
}

const quand = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'pas encore');

/**
 * Compte avec e-mail : sauvegarde ses données en ligne, et les retrouve sur un nouveau téléphone.
 * ?mode=connexion : « J'ai déjà un compte » (nouveau téléphone).
 */
export default function Compte() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { etat, dispatch } = useStore();
  const [meta, setMeta] = useState<MetaCompte | null>(null);
  const [chargee, setChargee] = useState(false);
  const [connexion, setConnexion] = useState(mode === 'connexion');
  const [etape, setEtape] = useState<Etape>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, setAttente] = useState(0);
  const [bilan, setBilan] = useState<{ repas: number; premium: string | null; trouvee: boolean } | null>(null);

  useEffect(() => {
    lireMeta().then((m) => {
      setMeta(m);
      setChargee(true);
    });
    return ecouterMeta(setMeta);
  }, []);

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente(attente - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const local = { profil: etat.profil, repas: etat.repas };
  const message = (e: unknown, defaut: string) => (e instanceof ErreurAuth ? e.message : defaut);

  const envoyerCode = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await (connexion ? demanderCodeConnexion(email) : demanderLiaison(email));
      setEtape('code');
      setCode('');
      setAttente(60);
    } catch (e) {
      setErreur(message(e, 'Envoi impossible. Réessaie.'));
    } finally {
      setEnCours(false);
    }
  };

  const valider = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await (connexion ? seConnecter(email, code, local) : lierEmail(email, code, local));
      if (r.donnees) dispatch({ type: 'restaurer', profil: r.donnees.profil, repas: r.donnees.repas });
      if (r.compte) dispatch({ type: 'majCompteServeur', compte: r.compte });
      setBilan({ repas: r.donnees?.repas.length ?? etat.repas.length, premium: r.compte?.premium?.jusquau ?? null, trouvee: r.sauvegardeTrouvee });
      setEtape('fini');
    } catch (e) {
      setErreur(message(e, 'Vérification impossible. Réessaie.'));
    } finally {
      setEnCours(false);
    }
  };

  const sauvegarderMaintenant = async () => {
    setEnCours(true);
    setErreur(null);
    const modifie = await synchroniser(local).catch(() => null);
    if (modifie) dispatch({ type: 'restaurer', profil: modifie.profil, repas: modifie.repas });
    setEnCours(false);
  };

  const deconnecter = () =>
    confirmer(
      'Se déconnecter de ce téléphone ?',
      'Tes données sont sauvegardées en ligne, puis effacées de ce téléphone. Tu les retrouveras en te reconnectant avec ton e-mail.',
      'Me déconnecter',
      async () => {
        setEnCours(true);
        const ok = await seDeconnecter(local).catch(() => false);
        setEnCours(false);
        if (!ok) {
          setErreur('Ta sauvegarde n’a pas pu partir (pas de connexion ?). Tu n’as rien perdu : réessaie avec du réseau.');
          return;
        }
        dispatch({ type: 'reinitialiser' });
        router.replace('/onboarding');
      },
    );

  if (!serveurConfigure || !supabaseConfigure) {
    return (
      <Ecran padding={24} bas={<Bouton titre="Fermer" onPress={() => router.back()} />}>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
        <T g={800} taille={26}>
          Bientôt disponible
        </T>
        <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
          Le compte avec e-mail nécessite le serveur Calbasse.
        </T>
      </Ecran>
    );
  }
  if (!chargee) return <Ecran padding={24}>{null}</Ecran>;

  // ——— Compte déjà relié à un e-mail ———
  if (meta && !connexion && etape !== 'fini') {
    const reconnexion = meta.statut === 'reconnexion';
    return (
      <Ecran
        padding={24}
        bas={
          reconnexion ? (
            <Bouton titre="Me reconnecter" onPress={() => setConnexion(true)} />
          ) : (
            <>
              <Bouton titre="Sauvegarder maintenant" icone="coche" onPress={sauvegarderMaintenant} chargement={enCours} />
              <Bouton variante="lien" titre="Se déconnecter de ce téléphone" onPress={deconnecter} />
            </>
          )
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
          <Logo />
        </View>
        <View style={{ gap: 8 }}>
          <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
            {reconnexion ? 'Reconnecte-toi' : 'Ton compte est sauvegardé'}
          </T>
          <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
            {reconnexion
              ? `Ce téléphone n’est plus connecté à ${meta.email}. Reconnecte-toi pour que tes données soient de nouveau sauvegardées.`
              : 'Ton profil, tes repas et ton abonnement te suivent sur un nouveau téléphone : il suffit de te connecter avec ton e-mail.'}
          </T>
        </View>
        <Carte style={{ gap: 6 }}>
          <T g={600} taille={12} couleur={couleurs.encre2}>
            E-mail
          </T>
          <T g={800} taille={17}>
            {meta.email}
          </T>
          <T taille={13} couleur={couleurs.encre2}>
            Dernière sauvegarde : {quand(meta.derniere)}
          </T>
        </Carte>
        {erreur ? <Avis texte={erreur} /> : null}
      </Ecran>
    );
  }

  if (etape === 'fini' && bilan) {
    const fin = bilan.premium;
    return (
      <Ecran padding={24} bas={<Bouton titre="Continuer" onPress={() => (etat.profil || bilan.trouvee ? router.replace('/(onglets)') : router.back())} />}>
        <View style={{ alignItems: 'center', gap: 16, marginTop: 48 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: couleurs.feuilleDouce, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="coche" taille={36} couleur={couleurs.feuille} epaisseur={3} />
          </View>
          <T g={800} taille={26} centre accessibilityRole="header">
            {connexion ? (bilan.trouvee ? 'Compte retrouvé' : 'Connecté') : 'Compte sauvegardé'}
          </T>
          <T taille={15} interligne={1.5} couleur={couleurs.encre2} centre>
            {connexion
              ? bilan.trouvee
                ? `Ton profil et ${bilan.repas} repas sont de retour sur ce téléphone.${fin ? ` Ton abonnement Premium est actif jusqu’au ${fin.split('-').reverse().join('/')}.` : ''}`
                : 'Aucune sauvegarde n’a été trouvée pour ce compte. Tes données seront sauvegardées à partir de maintenant.'
              : `Tes données sont sauvegardées en ligne. Si tu changes de téléphone, connecte-toi avec ${email.trim()}.`}
          </T>
          {connexion && bilan.trouvee ? (
            <T taille={13} interligne={1.45} couleur={couleurs.encre2} centre>
              Les photos de tes repas ne sont pas sauvegardées : elles restent sur le téléphone où tu les as prises.
            </T>
          ) : null}
        </View>
      </Ecran>
    );
  }

  // ——— Saisie de l'e-mail, puis du code ———
  return (
    <Ecran
      padding={24}
      bas={
        etape === 'email' ? (
          <>
            <Bouton titre="Recevoir un code par e-mail" icone="coche" onPress={envoyerCode} chargement={enCours} desactive={!emailValide(email)} />
            <Bouton variante="lien" titre={connexion ? 'Je n’ai pas encore de compte : en créer un' : 'J’ai déjà un compte (nouveau téléphone)'} onPress={() => { setConnexion(!connexion); setErreur(null); }} />
          </>
        ) : (
          <>
            <Bouton titre="Valider" onPress={valider} chargement={enCours} desactive={!codeEmailValide(code)} />
            <Bouton variante="lien" titre={attente > 0 ? `Renvoyer un code dans ${attente} s` : 'Renvoyer un code'} onPress={() => (attente > 0 ? undefined : envoyerCode())} />
          </>
        )
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BoutonRond
          icone={etape === 'code' ? 'gauche' : 'croix'}
          label={etape === 'code' ? 'Changer d’e-mail' : 'Fermer'}
          onPress={() => (etape === 'code' ? setEtape('email') : router.back())}
        />
        <Logo />
      </View>

      {etape === 'email' ? (
        <>
          <View style={{ gap: 8 }}>
            <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              {connexion ? 'Retrouve ton compte' : 'Sauvegarde ton compte'}
            </T>
            <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
              {connexion
                ? 'Entre l’e-mail de ton compte Calbasse. On t’envoie un code : pas de mot de passe à retenir.'
                : 'Avec ton e-mail, tu retrouves ton profil, tes repas et ton abonnement si tu perds ou changes de téléphone. On ne t’enverra pas de publicité.'}
            </T>
          </View>
          <View style={{ gap: 8 }}>
            <T g={700} taille={13}>
              Adresse e-mail
            </T>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.com"
              placeholderTextColor="#B8A27F"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Adresse e-mail"
              style={{ height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: couleurs.traits, backgroundColor: couleurs.blanc, paddingHorizontal: 14, fontFamily: polices[600], fontSize: 17, color: couleurs.encre }}
            />
          </View>
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              Entre le code
            </T>
            <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
              On a envoyé un code à {email.trim()}. Il arrive en quelques secondes ; pense à regarder dans les courriers indésirables.
            </T>
          </View>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
            placeholder="••••••"
            placeholderTextColor="#B8A27F"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={8}
            accessibilityLabel="Code reçu par e-mail"
            style={{ height: 64, borderRadius: 16, borderWidth: 1.5, borderColor: couleurs.traits, backgroundColor: couleurs.blanc, textAlign: 'center', fontFamily: polices[800], fontSize: 30, letterSpacing: 10, color: couleurs.encre }}
          />
        </>
      )}

      {erreur ? <Avis texte={erreur} /> : null}
    </Ecran>
  );
}

function Avis({ texte }: { texte: string }) {
  return (
    <Carte style={{ backgroundColor: couleurs.terreDouce, borderWidth: 0, flexDirection: 'row', gap: 10 }}>
      <Icone nom="info" taille={18} couleur={couleurs.terreFoncee} />
      <T g={600} taille={13} interligne={1.4} couleur={couleurs.terreFoncee} style={{ flex: 1 }} accessibilityLiveRegion="polite">
        {texte}
      </T>
    </Carte>
  );
}
