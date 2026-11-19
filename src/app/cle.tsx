import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Carte, Ecran } from '../components/ui';
import { enregistrerCle, lireCle, verifierCle } from '../services/visionDirecte';
import { couleurs, polices } from '../theme';

/**
 * Clé de reconnaissance (mode sans serveur) : l'utilisateur colle sa clé RodiumAI une seule fois.
 * Elle est gardée dans le coffre du téléphone et ne quitte l'appareil que vers RodiumAI.
 */
export default function Cle() {
  const [valeur, setValeur] = useState('');
  const [existante, setExistante] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    lireCle().then((c) => setExistante(!!c));
  }, []);

  const enregistrer = async () => {
    setEnCours(true);
    setMessage(null);
    const r = await verifierCle(valeur);
    if (r.ok) {
      await enregistrerCle(valeur);
      setExistante(true);
      setValeur('');
    }
    setMessage({ ok: r.ok, texte: r.message });
    setEnCours(false);
  };

  const retirer = async () => {
    await enregistrerCle('');
    setExistante(false);
    setMessage({ ok: true, texte: 'Clé retirée de ce téléphone.' });
  };

  return (
    <Ecran
      padding={24}
      bas={
        <>
          <Bouton titre={existante ? 'Remplacer la clé' : 'Enregistrer la clé'} onPress={enregistrer} chargement={enCours} desactive={valeur.trim().length < 10} />
          {existante ? <Bouton variante="lien" titre="Retirer la clé de ce téléphone" onPress={retirer} /> : null}
        </>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BoutonRond icone="croix" label="Fermer" onPress={() => router.back()} />
        <Logo />
      </View>

      <View style={{ gap: 8 }}>
        <T g={800} taille={30} interligne={1.1} espacement={-0.03} accessibilityRole="header">
          Clé de reconnaissance
        </T>
        <T taille={15} interligne={1.5} couleur={couleurs.encre2}>
          Cette version de Calbasse reconnaît les plats toute seule, sans serveur. Colle ici ta clé RodiumAI : elle reste dans le coffre de ce téléphone et sert uniquement à
          analyser tes photos.
        </T>
      </View>

      {existante ? (
        <Carte>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icone nom="coche" taille={20} couleur={couleurs.feuille} epaisseur={3} />
            <T g={700} taille={15}>
              Une clé est enregistrée sur ce téléphone
            </T>
          </View>
        </Carte>
      ) : null}

      <View style={{ gap: 8 }}>
        <T g={700} taille={13}>
          Clé RodiumAI
        </T>
        <View style={{ height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: couleurs.traits, backgroundColor: couleurs.blanc, paddingHorizontal: 14, justifyContent: 'center' }}>
          <TextInput
            value={valeur}
            onChangeText={setValeur}
            placeholder="rd_sk_…"
            placeholderTextColor="#B8A27F"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel="Clé RodiumAI"
            style={{ height: '100%', fontFamily: polices[600], fontSize: 17, color: couleurs.encre }}
          />
        </View>
        {message ? (
          <T taille={13} interligne={1.45} couleur={message.ok ? couleurs.feuille : couleurs.terreCuite}>
            {message.texte}
          </T>
        ) : null}
      </View>

      <T taille={13} interligne={1.45} couleur={couleurs.encre2}>
        Ta clé se crée sur rodiumai.io, dans l’espace des clés d’API. Garde-la pour toi : chaque analyse est décomptée de ton crédit.
      </T>
    </Ecran>
  );
}
