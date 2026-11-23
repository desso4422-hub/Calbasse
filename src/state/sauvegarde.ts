/**
 * Garde la sauvegarde en ligne à jour pour un compte avec e-mail : à l'ouverture de l'app, à son retour au premier plan,
 * et quelques secondes après chaque changement du profil ou des repas.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { serveurConfigure } from '../services/api';
import { lireMeta, synchroniser } from '../services/sauvegarde';
import { useStore } from './store';

const DELAI_MS = 4000;

export function useSauvegarde() {
  const { etat, pret, dispatch } = useStore();
  const dernier = useRef(etat);
  const enCours = useRef(false);
  useEffect(() => {
    dernier.current = etat;
  }, [etat]);

  const lancer = useRef(async () => {});
  useEffect(() => {
    lancer.current = async () => {
      if (enCours.current) return;
      enCours.current = true;
      try {
        const modifie = await synchroniser({ profil: dernier.current.profil, repas: dernier.current.repas });
        if (modifie) dispatch({ type: 'restaurer', profil: modifie.profil, repas: modifie.repas });
      } finally {
        enCours.current = false;
      }
    };
  }, [dispatch]);

  // À l'ouverture et au retour dans l'app
  useEffect(() => {
    if (!pret || !serveurConfigure) return;
    lancer.current();
    const abonnement = AppState.addEventListener('change', (s) => {
      if (s === 'active') lancer.current();
    });
    return () => abonnement.remove();
  }, [pret]);

  // Après chaque changement, avec un petit délai pour regrouper les modifications
  useEffect(() => {
    if (!pret || !serveurConfigure) return;
    let annule = false;
    const t = setTimeout(async () => {
      if (annule || !(await lireMeta())) return;
      lancer.current();
    }, DELAI_MS);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [pret, etat.profil, etat.repas]);
}
