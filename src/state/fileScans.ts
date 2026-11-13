/**
 * Analyse des scans en attente (photo prise sans réseau, ou réseau trop lent).
 * Relance : au lancement, quand le réseau revient, au retour au premier plan, et chaque minute
 * tant qu'il reste des scans en attente. Chaque photo est renvoyée avec sa clé : le serveur
 * ne l'analyse et ne la décompte qu'une fois, même si un envoi précédent avait abouti.
 */
import { addNetworkStateListener } from 'expo-network';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { serveurConfigure } from '../services/api';
import { lirePhoto } from '../services/photosEnAttente';
import { ErreurQuota, ErreurReconnaissance, ErreurReseau, reconnaitreRepas } from '../services/reconnaissance';
import { useStore, type ScanEnAttente } from './store';

export function useFileScans() {
  const { etat, pret, dispatch } = useStore();
  const etatRef = useRef(etat);
  useEffect(() => {
    etatRef.current = etat;
  }, [etat]);
  const enCours = useRef(false);

  const traiter = useCallback(async () => {
    if (!serveurConfigure || enCours.current) return;
    enCours.current = true;
    // L'état lu par la boucle peut avoir un temps de retard sur les dispatch : on note ce qui est déjà traité
    const traites = new Set<string>();
    try {
      for (;;) {
        const suivant = (etatRef.current.scansEnAttente ?? []).find((x) => x.statut === 'attente' && !traites.has(x.cle));
        if (!suivant) break;
        traites.add(suivant.cle);
        const reseauOk = await analyser(suivant);
        if (!reseauOk) break; // réseau toujours absent : on attend le prochain signal
      }
    } finally {
      enCours.current = false;
    }

    async function analyser(scan: ScanEnAttente): Promise<boolean> {
      dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'envoi' } });
      try {
        const photo = await lirePhoto(scan.photoUri, scan.photoBase64);
        const r = await reconnaitreRepas({ photoBase64: photo, indice: scan.indice, cle: scan.cle });
        if (r.compte) dispatch({ type: 'majCompteServeur', compte: r.compte });
        if (r.pasUnRepas) {
          dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'echec', erreur: r.remarque || 'On ne voit pas de repas sur cette photo.' } });
        } else {
          dispatch({
            type: 'majScanAttente',
            cle: scan.cle,
            maj: {
              statut: 'pret',
              erreur: undefined,
              photoBase64: undefined, // plus besoin de la garder en mémoire (web)
              resultat: { nom: r.nom, lignes: r.lignes, reconnu: r.reconnu, scanId: r.scanId, inconnus: r.inconnus, remarque: r.remarque },
            },
          });
        }
        return true;
      } catch (e) {
        if (e instanceof ErreurReseau) {
          dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'attente', essais: scan.essais + 1 } });
          return false;
        }
        if (e instanceof ErreurQuota) {
          if (e.compte) dispatch({ type: 'majCompteServeur', compte: e.compte });
          dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'echec', erreur: 'Plus de scans aujourd’hui. Réessaie demain, ou choisis ton plat dans la liste.' } });
          return true;
        }
        const message = e instanceof ErreurReconnaissance ? e.message : 'Photo illisible.';
        dispatch({ type: 'majScanAttente', cle: scan.cle, maj: { statut: 'echec', erreur: message } });
        return true;
      }
    }
  }, [dispatch]);

  const enAttente = (etat.scansEnAttente ?? []).some((x) => x.statut === 'attente');
  // Change quand un scan entre dans la file (mis de côté, ou « Réessayer ») — pas à chaque essai raté
  const cles = (etat.scansEnAttente ?? [])
    .filter((x) => x.statut === 'attente' && x.essais <= 1)
    .map((x) => x.cle)
    .join(',');

  // Un scan vient d'être mis de côté : on tente tout de suite (le serveur reconnaît la photo à sa clé
  // et rend le résultat de l'analyse déjà lancée, sans la refaire ni la décompter)
  useEffect(() => {
    if (pret && cles) traiter();
  }, [pret, cles, traiter]);

  // Au lancement, au retour du réseau et au retour au premier plan
  useEffect(() => {
    if (!pret || !serveurConfigure) return;
    traiter();
    const reseau = addNetworkStateListener((e) => {
      if (e.isConnected && e.isInternetReachable !== false) traiter();
    });
    const app = AppState.addEventListener('change', (e) => e === 'active' && traiter());
    return () => {
      reseau.remove();
      app.remove();
    };
  }, [pret, traiter]);

  // Filet de sécurité : toutes les minutes tant qu'il reste des scans en attente
  useEffect(() => {
    if (!pret || !enAttente) return;
    const minuterie = setInterval(traiter, 60_000);
    return () => clearInterval(minuterie);
  }, [pret, enAttente, traiter]);
}
