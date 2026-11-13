/**
 * Démarrage du serveur Calbasse (reconnaissance Gemini, comptes, quota de scans, paiement CinetPay).
 *
 *   GEMINI_API_KEY=... npm start
 *
 * Toutes les variables sont décrites dans .env.example. Les routes sont dans app.ts.
 */
import path from 'node:path';
import { creerApplication } from './app.ts';
import { Base, SCANS_GRATUITS, SCANS_PREMIUM } from './base.ts';
import { fournisseurDepuisEnv, optionsDepuisEnv } from './config.ts';
import { Journal } from './journal.ts';
import { smsAfricasTalking, smsConsole } from './sms.ts';

const env = process.env;

const vision = fournisseurDepuisEnv();
if (!vision) {
  console.error('Aucune clé de vision : définis RODIUMAI_API_KEY (https://www.rodiumai.io) ou GEMINI_API_KEY (https://aistudio.google.com/apikey).');
  process.exit(1);
}

const options = optionsDepuisEnv();
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

const port = Number(env.PORT ?? 8787);
serveur.listen(port, () => {
  console.log(`Calbasse : serveur prêt sur le port ${port} (${vision.nom} · ${options.modele}, réflexion ${options.reflexion ?? 'par défaut'})`);
  if (!sms) console.log('SMS non configurés (FOURNISSEUR_SMS) : pas de récupération de compte par téléphone.');
  if (fournisseurSms === 'console') console.log('⚠️  FOURNISSEUR_SMS=console : les codes sont écrits dans les logs. Réservé au développement.');
  if (!cinetpay) console.log('Paiement CinetPay non configuré (CINETPAY_API_KEY, CINETPAY_SITE_ID, URL_PUBLIQUE).');
});
