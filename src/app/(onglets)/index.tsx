import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Anneau, Assiette, Jauge } from '../../components/Graphiques';
import { Icone } from '../../components/Icone';
import { T } from '../../components/T';
import { CarteScanEnAttente } from '../../components/ScanEnAttente';
import { Ecran } from '../../components/ui';
import { fonctions } from '../../config';
import {
  additionner,
  ajouterJours,
  arrondirNutriments,
  cleJour,
  dateLongue,
  depuisCle,
  formater,
  joursCourts,
  lundi,
  totalRepas,
  zero,
} from '../../lib/nutrition.ts';
import { brouillonDepuisRepas, useBrouillon } from '../../state/brouillon';
import { creneauPourHeure, estPremium, nomsCreneaux, repasDuJour, scansRestants, useStore, type Creneau, type Etat } from '../../state/store';
import { couleurs } from '../../theme';

function totalJour(etat: Etat, jour: string) {
  return arrondirNutriments(repasDuJour(etat, jour).map((r) => totalRepas(r.lignes, r.huile)).reduce(additionner, zero));
}

export default function Aujourdhui() {
  const { etat } = useStore();
  const { setBrouillon } = useBrouillon();
  const profil = etat.profil;
  const aujourdhui = new Date();
  const cleAujourdhui = cleJour(aujourdhui);
  const [jour, setJour] = useState(cleAujourdhui);
  const estAujourdhui = jour === cleAujourdhui;

  const semaine = useMemo(() => {
    const debut = lundi(depuisCle(jour));
    return Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i));
  }, [jour]);

  if (!profil) return null;
  const cibles = profil.cibles;
  const total = totalJour(etat, jour);
  const repas = repasDuJour(etat, jour);
  const resteProt = Math.max(0, cibles.prot - total.prot);
  const restants = scansRestants(etat);
  const premium = estPremium(etat);

  // Prochain créneau principal à remplir (aujourd'hui seulement)
  const pris = new Set([...repas.map((r) => r.creneau), ...(etat.scansEnAttente ?? []).filter((x) => x.jour === jour).map((x) => x.creneau)]);
  const principaux: Creneau[] = ['petitDej', 'dejeuner', 'diner'];
  const actuel = creneauPourHeure(aujourdhui);
  const prochain: Creneau =
    principaux.find((c) => !pris.has(c) && principaux.indexOf(c) >= Math.max(0, principaux.indexOf(actuel === 'collation' ? 'diner' : actuel))) ??
    (actuel === 'collation' ? 'collation' : actuel);

  return (
    <Ecran espaceBas={28}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <T g={500} taille={13} couleur={couleurs.encre2}>
            {dateLongue(depuisCle(jour))}
          </T>
          <T g={800} taille={26} espacement={-0.02} numberOfLines={1}>
            {profil.prenom ? `Salut ${profil.prenom}` : 'Salut'}
          </T>
        </View>
        <Pressable
          onPress={() => (fonctions.premium ? router.push('/premium') : router.push('/scanner'))}
          accessibilityRole="button"
          accessibilityLabel={premium ? `Premium, ${restants} scans restants` : fonctions.premium ? `${restants} scans gratuits restants. Passer à Premium` : `${restants} scans restants aujourd'hui`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: couleurs.terreDouce, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Icone nom="appareil" taille={16} couleur={couleurs.terreFoncee} />
          <T g={700} taille={12} couleur={couleurs.terreFoncee}>
            {premium
              ? `Premium · ${restants}`
              : fonctions.premium
                ? `${restants} scan${restants > 1 ? 's' : ''} gratuit${restants > 1 ? 's' : ''}`
                : `${restants} scan${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}`}
          </T>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {semaine.map((d, i) => {
          const cle = cleJour(d);
          const futur = cle > cleAujourdhui;
          const actif = cle === jour;
          const t = futur ? null : totalJour(etat, cle);
          const atteint = !!t && t.prot >= cibles.prot;
          const entame = !!t && t.kcal > 0;
          return (
            <Pressable
              key={cle}
              disabled={futur}
              onPress={() => setJour(cle)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif, disabled: futur }}
              accessibilityLabel={`${dateLongue(d)}${atteint ? ', objectif atteint' : ''}`}
              style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14, backgroundColor: actif ? couleurs.encre : 'transparent' }}
            >
              <T g={600} taille={11} couleur={actif ? couleurs.sable : couleurs.encre2}>
                {joursCourts[i]}
              </T>
              <T g={700} taille={15} couleur={actif ? couleurs.blanc : futur ? couleurs.encre2 : couleurs.encre}>
                {d.getDate()}
              </T>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: atteint ? (actif ? couleurs.sable : couleurs.terreCuite) : 'transparent',
                  borderWidth: atteint || futur || (!entame && cle !== cleAujourdhui) ? 0 : 1.5,
                  borderColor: actif ? couleurs.sable : couleurs.terreCuite,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={{ backgroundColor: couleurs.blanc, borderWidth: 1, borderColor: couleurs.traits, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 132, height: 132 }}>
          <Anneau progression={total.prot / cibles.prot} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <T g={800} taille={32}>
              {total.prot}
            </T>
            <T g={600} taille={12} couleur={couleurs.encre2}>
              g / {cibles.prot} g
            </T>
            <T g={700} taille={11} couleur={couleurs.terreFoncee} style={{ marginTop: 2 }}>
              Protéines
            </T>
          </View>
        </View>
        <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
          <T g={700} taille={12} couleur={couleurs.encre2}>
            Calories
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
            <T g={800} taille={24}>
              {formater(total.kcal)}
            </T>
            <T g={600} taille={12} couleur={couleurs.encre2}>
              / {formater(cibles.kcal)} kcal
            </T>
          </View>
          <Jauge progression={total.kcal / cibles.kcal} />
          <T g={500} taille={12} couleur={couleurs.encre2}>
            Glucides {total.gluc} g · Lipides {total.lip} g
          </T>
        </View>
      </View>

      <T taille={14} interligne={1.45} couleur={couleurs.encre2}>
        {resteProt > 0 ? (
          <>
            {estAujourdhui ? 'Il te reste ' : 'Il manquait '}
            <T g={700} taille={14} couleur={couleurs.encre}>
              {resteProt} g de protéines
            </T>
            {estAujourdhui ? ' pour atteindre ton objectif du jour.' : ' ce jour-là pour atteindre ton objectif.'}
          </>
        ) : (
          <>
            <T g={700} taille={14} couleur={couleurs.encre}>
              Objectif protéines atteint.
            </T>{' '}
            {estAujourdhui ? 'Bien joué, continue comme ça.' : 'Belle journée.'}
          </>
        )}
      </T>

      <View style={{ gap: 10 }}>
        <T g={800} taille={17}>
          {estAujourdhui ? "Repas d'aujourd'hui" : 'Repas de ce jour'}
        </T>
        {(etat.scansEnAttente ?? [])
          // Aujourd'hui, on montre aussi les scans des jours précédents qui attendent encore
          .filter((x) => x.jour === jour || (estAujourdhui && x.jour < jour))
          .map((x) => (
            <CarteScanEnAttente key={x.cle} scan={x} />
          ))}
        {repas.map((r) => {
          const t = arrondirNutriments(totalRepas(r.lignes, r.huile));
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                setBrouillon(brouillonDepuisRepas(r));
                router.push('/detail');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${nomsCreneaux[r.creneau]}, ${r.nom}, ${t.kcal} kilocalories, ${t.prot} grammes de protéines`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: couleurs.blanc,
                borderWidth: 1,
                borderColor: couleurs.traits,
                borderRadius: 18,
                padding: 10,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Assiette lignes={r.lignes} />
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <T g={500} taille={12} couleur={couleurs.encre2}>
                  {nomsCreneaux[r.creneau]} · {r.heure}
                </T>
                <T g={700} taille={15} numberOfLines={1}>
                  {r.nom}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 1 }}>
                <T g={700} taille={14}>
                  {formater(t.kcal)} kcal
                </T>
                <T g={700} taille={12} couleur={couleurs.terreFoncee}>
                  {t.prot} g prot.
                </T>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => (estAujourdhui ? router.push('/scanner') : router.push({ pathname: '/choisir', params: { mode: 'nouveau', jour } }))}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: couleurs.traitsFonces,
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: couleurs.terreDouce, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="plus" taille={20} couleur={couleurs.terreCuite} epaisseur={2.6} />
          </View>
          <T g={600} taille={15} couleur={couleurs.encre2}>
            {estAujourdhui ? `${nomsCreneaux[prochain]} · Ajoute ton repas` : 'Ajoute un repas oublié'}
          </T>
        </Pressable>
      </View>
    </Ecran>
  );
}
