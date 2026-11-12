import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Choix, Ecran, Etiquette, PastilleRadio } from '../components/ui';
import { depuisCle, formater } from '../lib/nutrition.ts';
import { demarrerPaiement, modePaiement, tarifs } from '../services/paiement';
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

  const payer = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      const issue = await demarrerPaiement(plan);
      if (issue.statut === 'active') {
        dispatch({ type: 'activerAbonnement', abonnement: issue.abonnement });
        router.back();
      } else {
        setMessage('Termine le paiement dans la page qui vient de s’ouvrir. Ton abonnement s’activera dès sa confirmation.');
      }
    } catch {
      setMessage('Le paiement n’a pas pu démarrer. Vérifie ta connexion et réessaie.');
    } finally {
      setEnCours(false);
    }
  };

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
          Abonnement {etat.abonnement.plan}, valable jusqu’au {fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Sans renouvellement automatique : on te préviendra avant la fin.
        </T>
        <Liste />
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
