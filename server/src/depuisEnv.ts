/**
 * Construit le serveur Calbasse à partir des variables d'environnement (voir .env.example).
 * Utilisé par index.ts (serveur classique) et vercel.ts (fonction Vercel).
 */
import path from 'node:path';
import { creerApplication } from './app.ts';
import { Base, SCANS_GRATUITS, SCANS_PREMIUM } from './base.ts';
import { fournisseurDepuisEnv, optionsDepuisEnv } from './config.ts';
import { Journal } from './journal.ts';
import { smsAfricasTalking, smsConsole } from './sms.ts';

export function serveurDepuisEnv(env: Record<string, string | undefined> = process.env) {
  const vision = fournisseurDepuisEnv(env);
  if (!vision) {
    throw new Error('Aucune clé de vision : définis RODIUMAI_API_KEY (https://www.rodiumai.io) ou GEMINI_API_KEY (https://aistudio.google.com/apikey).');
  }
  const options = optionsDepuisEnv(env);
  const dossier = env.DATA_DIR ?? './donnees';

  const cinetpay =
    env.CINETPAY_API_KEY && env.CINETPAY_SITE_ID && env.URL_PUBLIQUE
      ? {
          apiKey: env.CINETPAY_API_KEY,
          siteId: env.CINETPAY_SITE_ID,
          urlApi: (env.CINETPAY_URL_API ?? 'https://api-checkout.cinetpay.com/v2').replace(/\/+$/, ''),
          urlPublique: env.URL_PUBLIQUE.replace(/\/+$/, ''),
        }
      : null;

  const fournisseurSms = env.FOURNISSEUR_SMS ?? '';
  const sms =
    fournisseurSms === 'africastalking' && env.AT_UTILISATEUR && env.AT_CLE_API
      ? smsAfricasTalking({ utilisateur: env.AT_UTILISATEUR, cleApi: env.AT_CLE_API, expediteur: env.AT_EXPEDITEUR || undefined, sandbox: env.AT_UTILISATEUR === 'sandbox' })
      : fournisseurSms === 'console'
        ? smsConsole()
        : null;

  const serveur = creerApplication({
    base: new Base(path.join(dossier, 'calbasse.db'), env.FUSEAU ?? 'Africa/Lagos', undefined, {
      gratuit: Number(env.SCANS_GRATUITS ?? SCANS_GRATUITS),
      premium: Number(env.SCANS_PREMIUM ?? SCANS_PREMIUM),
    }),
    vision,
    options,
    journal: new Journal(dossier, env.GARDER_PHOTOS === '1'),
    cinetpay,
    sms,
    requetesParHeure: Number(env.REQUETES_PAR_HEURE ?? 120),
    comptesParHeure: Number(env.COMPTES_PAR_HEURE ?? 10),
    derriereProxy: env.DERRIERE_PROXY === '1',
  });

  return { serveur, vision, options, cinetpay, sms, fournisseurSms };
}
