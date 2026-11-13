/**
 * Synchronise l'état du compte (Premium, scans restants) avec le serveur :
 * à l'ouverture de l'app et chaque fois qu'elle revient au premier plan (après un paiement, par exemple).
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { lireCompte, serveurConfigure } from '../services/api';
import { useStore } from './store';

export function useSynchroCompte() {
  const { pret, dispatch } = useStore();

  useEffect(() => {
    if (!pret || !serveurConfigure) return;
    const synchroniser = () => {
      lireCompte()
        .then((compte) => dispatch({ type: 'majCompteServeur', compte }))
        .catch(() => {}); // hors ligne : on garde le dernier état connu
    };
    synchroniser();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') synchroniser();
    });
    return () => abonnement.remove();
  }, [pret, dispatch]);
}
