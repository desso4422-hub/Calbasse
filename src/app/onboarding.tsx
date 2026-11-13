import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Logo } from '../components/Graphiques';
import { Icone, type NomIcone } from '../components/Icone';
import { T } from '../components/T';
import { Bouton, BoutonRond, Carte, Choix, Ecran, Segment } from '../components/ui';
import { calculerCibles, formater, type Activite, type Mesures, type Objectif, type Sexe } from '../lib/nutrition.ts';
import { fonctions } from '../config';
import { serveurConfigure } from '../services/api';
import { useStore } from '../state/store';
import { couleurs, polices } from '../theme';

const objectifs: { id: Objectif; titre: string; texte: string; icone: NomIcone }[] = [
  { id: 'masse', titre: 'Prendre de la masse', texte: 'Savoir si tu atteins tes protéines, même avec le riz sauce de la dame.', icone: 'hausse' },
  { id: 'perte', titre: 'Perdre du poids', texte: 'Manger le plat de la famille, avec la bonne portion.', icone: 'baisse' },
  { id: 'forme', titre: 'Garder la forme', texte: 'Savoir si ton assiette est bonne pour toi, sans culpabiliser.', icone: 'coeur' },
];

const activites: { id: Activite; titre: string; texte: string }[] = [
  { id: 'sedentaire', titre: 'Plutôt assis', texte: 'Bureau, peu de marche' },
  { id: 'leger', titre: 'Un peu actif', texte: 'Marche, sport 1 à 2 fois par semaine' },
  { id: 'actif', titre: 'Actif', texte: 'Sport 3 à 5 fois, ou métier physique' },
  { id: 'tresActif', titre: 'Très actif', texte: 'Sport presque tous les jours' },
];

export default function Onboarding() {
  const { etat, dispatch } = useStore();
  const existant = etat.profil;
  const [etape, setEtape] = useState(1);
  const [objectif, setObjectif] = useState<Objectif>(existant?.mesures.objectif ?? 'masse');
  const [prenom, setPrenom] = useState(existant?.prenom ?? '');
  const [sexe, setSexe] = useState<Sexe>(existant?.mesures.sexe ?? 'homme');
  const [age, setAge] = useState(existant ? String(existant.mesures.age) : '');
  const [poids, setPoids] = useState(existant ? String(existant.mesures.poidsKg) : '');
  const [taille, setTaille] = useState(existant ? String(existant.mesures.tailleCm) : '');
  const [activite, setActivite] = useState<Activite>(existant?.mesures.activite ?? 'leger');

  const mesures: Mesures | null = useMemo(() => {
    const a = Number(age.replace(',', '.'));
    const p = Number(poids.replace(',', '.'));
    const t = Number(taille.replace(',', '.'));
    if (!(a >= 13 && a <= 100 && p >= 30 && p <= 250 && t >= 120 && t <= 230)) return null;
    return { sexe, age: a, poidsKg: p, tailleCm: t, activite, objectif };
  }, [age, poids, taille, sexe, activite, objectif]);

  const cibles = mesures ? calculerCibles(mesures) : null;

  const terminer = () => {
    if (!mesures) return;
    dispatch({ type: 'definirProfil', prenom: prenom.trim(), mesures });
    if (router.canGoBack() && existant) router.back();
    else router.replace('/(onglets)');
  };

  const bas =
    etape === 1 ? (
      <>
        <T taille={13} couleur={couleurs.encre2} centre interligne={1.4}>
          Attiéké, pâte, riz au gras, sauces, huile : Calbasse connaît tes plats.
        </T>
        <Bouton titre="Continuer" onPress={() => setEtape(2)} />
        {serveurConfigure && fonctions.telephone && !existant ? (
          <Bouton variante="lien" titre="J’ai déjà un compte Premium" onPress={() => router.push({ pathname: '/telephone', params: { mode: 'recuperer' } })} />
        ) : null}
      </>
    ) : etape === 2 ? (
      <Bouton titre="Voir mes objectifs" onPress={() => setEtape(3)} desactive={!mesures} />
    ) : (
      <Bouton titre={existant ? 'Enregistrer' : 'Commencer'} onPress={terminer} />
    );

  return (
    <Ecran bas={bas} padding={24}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {etape > 1 || existant ? (
          <BoutonRond icone="gauche" label="Retour" taille={40} onPress={() => (etape > 1 ? setEtape(etape - 1) : router.back())} />
        ) : null}
        <Logo taille={44} />
        <T g={800} taille={22} espacement={-0.02}>
          Calbasse
        </T>
      </View>

      <View style={{ gap: 8, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: i <= etape ? couleurs.terreCuite : couleurs.traits }} />
          ))}
        </View>
        <T g={600} taille={12} couleur={couleurs.encre2}>
          Étape {etape} sur 3
        </T>
      </View>

      {etape === 1 ? (
        <>
          <View style={{ gap: 10, marginTop: 6 }}>
            <T g={800} taille={32} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              Quel est ton objectif ?
            </T>
            <T taille={15} couleur={couleurs.encre2} interligne={1.5}>
              On adapte tes protéines et tes calories à ton objectif. Tu pourras le changer quand tu veux.
            </T>
          </View>
          <View style={{ gap: 12 }}>
            {objectifs.map((o) => (
              <Choix
                key={o.id}
                actif={objectif === o.id}
                onPress={() => setObjectif(o.id)}
                gauche={
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: couleurs.encre, alignItems: 'center', justifyContent: 'center' }}>
                    <Icone nom={o.icone} couleur={couleurs.sable} />
                  </View>
                }
              >
                <T g={800} taille={17}>
                  {o.titre}
                </T>
                <T taille={13} couleur={couleurs.encre2} interligne={1.4}>
                  {o.texte}
                </T>
              </Choix>
            ))}
          </View>
        </>
      ) : null}

      {etape === 2 ? (
        <>
          <View style={{ gap: 10, marginTop: 6 }}>
            <T g={800} taille={32} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              Parle-nous de toi
            </T>
            <T taille={15} couleur={couleurs.encre2} interligne={1.5}>
              Pour calculer tes besoins du jour. Ces chiffres restent sur ton téléphone.
            </T>
          </View>
          <Champ label="Ton prénom" valeur={prenom} onChange={setPrenom} placeholder="ex. Arnaud" />
          <View style={{ gap: 8 }}>
            <T g={700} taille={13}>
              Tu es
            </T>
            <Segment
              options={[
                { valeur: 'homme', titre: 'Un homme' },
                { valeur: 'femme', titre: 'Une femme' },
              ]}
              valeur={sexe}
              onChange={setSexe}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Champ label="Âge" valeur={age} onChange={setAge} placeholder="25" unite="ans" nombre />
            <Champ label="Poids" valeur={poids} onChange={setPoids} placeholder="70" unite="kg" nombre />
            <Champ label="Taille" valeur={taille} onChange={setTaille} placeholder="175" unite="cm" nombre />
          </View>
          <View style={{ gap: 8 }}>
            <T g={700} taille={13}>
              Ton activité
            </T>
            {activites.map((a) => (
              <Choix key={a.id} actif={activite === a.id} onPress={() => setActivite(a.id)}>
                <T g={800} taille={15}>
                  {a.titre}
                </T>
                <T taille={12} couleur={couleurs.encre2}>
                  {a.texte}
                </T>
              </Choix>
            ))}
          </View>
        </>
      ) : null}

      {etape === 3 && cibles ? (
        <>
          <View style={{ gap: 10, marginTop: 6 }}>
            <T g={800} taille={32} interligne={1.1} espacement={-0.03} accessibilityRole="header">
              {prenom.trim() ? `${prenom.trim()}, voici tes repères` : 'Voici tes repères'}
            </T>
            <T taille={15} couleur={couleurs.encre2} interligne={1.5}>
              Chaque jour, vise environ :
            </T>
          </View>
          <View style={{ backgroundColor: couleurs.encre, borderRadius: 22, padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ gap: 2 }}>
                <T g={700} taille={12} couleur={couleurs.sableClair}>
                  Protéines
                </T>
                <T g={800} taille={42} couleur={couleurs.peche}>
                  {cibles.prot}
                  <T g={700} taille={18} couleur={couleurs.peche}>
                    {' '}g
                  </T>
                </T>
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <T g={700} taille={12} couleur={couleurs.sableClair}>
                  Calories
                </T>
                <T g={800} taille={28} couleur={couleurs.sable}>
                  {formater(cibles.kcal)}
                  <T g={700} taille={14} couleur={couleurs.sable}>
                    {' '}kcal
                  </T>
                </T>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#4A3322', paddingTop: 10 }}>
              <T g={500} taille={12} couleur={couleurs.sableClair}>
                Glucides {cibles.gluc} g · Lipides {cibles.lip} g
              </T>
            </View>
          </View>
          <Carte style={{ backgroundColor: couleurs.sable, borderWidth: 0, flexDirection: 'row', gap: 10 }}>
            <Icone nom="info" taille={20} couleur={couleurs.terreFoncee} />
            <T taille={13} interligne={1.45} style={{ flex: 1 }}>
              Ce sont des repères généraux, pas un avis médical. Si tu es enceinte, malade ou suivi(e) pour ton poids, demande conseil à un professionnel de santé.
            </T>
          </Carte>
        </>
      ) : null}
    </Ecran>
  );
}

function Champ({
  label,
  valeur,
  onChange,
  placeholder,
  unite,
  nombre,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unite?: string;
  nombre?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <T g={700} taille={13}>
        {label}
      </T>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 52,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: couleurs.traits,
          backgroundColor: couleurs.blanc,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={valeur}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#B8A27F"
          keyboardType={nombre ? 'decimal-pad' : 'default'}
          autoCapitalize={nombre ? 'none' : 'words'}
          accessibilityLabel={label}
          style={{ flex: 1, minWidth: 0, fontFamily: polices[600], fontSize: 16, color: couleurs.encre, height: '100%' }}
        />
        {unite ? (
          <T g={600} taille={13} couleur={couleurs.encre2}>
            {unite}
          </T>
        ) : null}
      </View>
    </View>
  );
}
