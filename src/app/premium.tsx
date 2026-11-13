import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Carte, Choix, Ecran, Etiquette, PastilleRadio } from '../components/ui';
import { serveurConfigure } from '../services/api';
import { depuisCle, formater } from '../lib/nutrition.ts';
import { demarrerPaiement, ErreurPaiement, modePaiement, suivrePaiement, tarifs } from '../services/paiement';
import { estPremium, SCANS_GRATUITS, SCANS_PREMIUM, useStore } from '../state/store';
import { couleurs } from '../theme';

const avantages = [`${SCANS_PREMIUM} scans photo par jour`, 'Suivi détaillé de tes protéines', 'Bilan de la semaine chaque dimanche', 'Historique complet de tes repas'];

export default function Premium() {
  const { etat, dispatch } = useStore();
  const [plan, setPlan] = useState<'mensuel' | 'annuel'>('mensuel');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const premium = estPremium(etat);
  const parMois = Math.round(tarifs.annuel.prix / 12);

  // Transaction CinetPay en cours de confirmation
  const [transaction, setTransaction] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  const verifier = useCallback(async () => {
    if (!transaction) return;
    setVerification(true);
    try {
      const suivi = await suivrePaiement(transaction);
      if (suivi.compte) dispatch({ type: 'majCompteServeur', compte: suivi.compte });
      if (suivi.statut === 'accepte') {
        setTransaction(null);
        setMessage(null);
      } else if (suivi.statut === 'refuse') {
        setTransaction(null);
        setMessage('Le paiement n’a pas abouti. Aucun montant n’a été prélevé pour Premium. Tu peux réessayer.');
      }
    } catch {
      // hors ligne : on réessaiera
    } finally {
      setVerification(false);
    }
  }, [transaction, dispatch]);

  // Tant qu'une transaction attend : on vérifie toutes les 5 s (3 minutes max) et au retour dans l'app
  useEffect(() => {
    if (!transaction) return;
    let essais = 0;
    const minuterie = setInterval(() => {
      essais += 1;
      if (essais > 36) clearInterval(minuterie);
      else verifier();
    }, 5000);
    const abonnement = AppState.addEventListener('change', (e) => e === 'active' && verifier());
    return () => {
      clearInterval(minuterie);
      abonnement.remove();
    };
    // verifier change à chaque vérification ; on ne relance l'effet que pour une nouvelle transaction
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction]);

  const payer = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      const issue = await demarrerPaiement(plan);
      if (issue.statut === 'active') {
        dispatch({ type: 'activerAbonnement', abonnement: issue.abonnement });
        router.back();
      } else {
        setTransaction(issue.transactionId);
      }
    } catch (e) {
      setMessage(e instanceof ErreurPaiement ? e.message : 'Le paiement n’a pas pu démarrer. Vérifie ta connexion et réessaie.');
    } finally {
      setEnCours(false);
    }
  };

  if (transaction && !premium) {
    return (
      <Ecran
        padding={24}
        bas={
          <>
            <Bouton titre="J’ai payé, vérifier" onPress={verifier} chargement={verification} />
            <Bouton variante="lien" titre="Annuler" onPress={() => setTransaction(null)} />
          </>
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
          <Logo />
        </View>
        <View style={{ alignItems: 'center', gap: 16, marginTop: 40 }}>
          <ActivityIndicator size="large" color={couleurs.terreCuite} />
          <T g={800} taille={24} centre>
            Paiement en cours de confirmation
          </T>
          <T taille={15} interligne={1.5} couleur={couleurs.encre2} centre>
            Valide le paiement sur ton téléphone (code Mobile Money) ou dans la page CinetPay. Premium s’active tout seul dès que CinetPay le confirme, en général en moins d’une minute.
          </T>
          <T g={600} taille={12} couleur={couleurs.encre2} centre>
            Référence : {transaction}
          </T>
        </View>
      </Ecran>
    );
  }

  if (premium && etat.abonnement) {
    const fin = depuisCle(etat.abonnement.jusquau);
    return (
      <Ecran bas={<Bouton titre="Fermer" onPress={() => router.back()} />} padding={24}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
          <Logo />
        </View>
        <T g={800} taille={32} interligne={1.1} espacement={-0.03}>
          Tu es Premium
        </T>
        <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
          Abonnement {etat.abonnement.plan}, valable jusqu’au {fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Sans renouvellement automatique : tu pourras le prolonger depuis cet écran.
        </T>
        <Liste />
        {serveurConfigure && !etat.serveur?.telephone ? (
          <Carte style={{ backgroundColor: couleurs.terreDouce, borderWidth: 0, gap: 10 }}>
            <T g={800} taille={15}>
              Ne perds pas ton abonnement
            </T>
            <T taille={13} interligne={1.45}>
              Ajoute ton numéro : si tu changes de téléphone, tu retrouveras Premium en un SMS.
            </T>
            <Bouton titre="Ajouter mon numéro" variante="contour" icone="telephone" hauteur={48} onPress={() => router.push('/telephone')} />
          </Carte>
        ) : null}
      </Ecran>
    );
  }

  return (
    <Ecran
      padding={24}
      bas={
        <>
          {message ? (
            <T taille={13} couleur={couleurs.terreFoncee} centre interligne={1.4}>
              {message}
            </T>
          ) : null}
          <Bouton titre={`Payer ${formater(tarifs[plan].prix)} FCFA`} onPress={payer} chargement={enCours} />
          <Bouton variante="lien" titre="Rester en gratuit" onPress={() => router.back()} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
        <Logo />
      </View>

      <View style={{ gap: 8 }}>
        <T g={800} taille={32} interligne={1.1} espacement={-0.03} accessibilityRole="header">
          Passe à Premium
        </T>
        <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
          Scanne tous tes repas, tous les jours. En gratuit, tu as {SCANS_GRATUITS} scans par jour.
        </T>
      </View>

      <Liste />

      <View style={{ gap: 10 }}>
        <Choix actif={plan === 'mensuel'} onPress={() => setPlan('mensuel')} gauche={<PastilleRadio actif={plan === 'mensuel'} />} droite={<Prix montant={tarifs.mensuel.prix} unite="FCFA / mois" />}>
          <T g={800} taille={16}>
            Mensuel
          </T>
          <T taille={12} couleur={couleurs.encre2}>
            Tu arrêtes quand tu veux
          </T>
        </Choix>
        <Choix actif={plan === 'annuel'} onPress={() => setPlan('annuel')} gauche={<PastilleRadio actif={plan === 'annuel'} />} droite={<Prix montant={tarifs.annuel.prix} unite="FCFA / an" />}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <T g={800} taille={16}>
              Annuel
            </T>
            <View style={{ backgroundColor: couleurs.feuille, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
              <T g={700} taille={11} couleur={couleurs.blanc}>
                2 mois offerts
              </T>
            </View>
          </View>
          <T taille={12} couleur={couleurs.encre2}>
            Soit environ {formater(parMois)} FCFA par mois
          </T>
        </Choix>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icone nom="telephone" taille={18} couleur={couleurs.terreFoncee} />
          <T g={600} taille={13}>
            Mobile Money ou carte bancaire, via CinetPay
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icone nom="cadenas" taille={18} couleur={couleurs.terreFoncee} />
          <T g={600} taille={13}>
            Sans renouvellement automatique
          </T>
        </View>
        {modePaiement === 'demo' ? <Etiquette texte="Mode démo : aucun paiement réel" ton="sable" icone="info" /> : null}
      </View>
    </Ecran>
  );
}

function Liste() {
  return (
    <View style={{ gap: 12 }}>
      {avantages.map((a) => (
        <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: couleurs.terreCuite, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="coche" taille={15} couleur={couleurs.blanc} epaisseur={3.2} />
          </View>
          <T g={600} taille={15}>
            {a}
          </T>
        </View>
      ))}
    </View>
  );
}

function Prix({ montant, unite }: { montant: number; unite: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <T g={800} taille={18}>
        {formater(montant)}
      </T>
      <T g={700} taille={12} couleur={couleurs.encre2}>
        {unite}
      </T>
    </View>
  );
}
