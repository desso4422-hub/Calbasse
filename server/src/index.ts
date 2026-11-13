/**
 * Démarrage du serveur Calbasse (reconnaissance, comptes, quota de scans, paiement CinetPay).
 *
 *   RODIUMAI_API_KEY=rd_sk_... npm start
 *
 * Toutes les variables sont décrites dans .env.example. Les routes sont dans app.ts.
 */
import { serveurDepuisEnv } from './depuisEnv.ts';

let demarrage: ReturnType<typeof serveurDepuisEnv>;
try {
  demarrage = serveurDepuisEnv();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
const { serveur, vision, options, cinetpay, sms, fournisseurSms } = demarrage;

const port = Number(process.env.PORT ?? 8787);
serveur.listen(port, () => {
  console.log(`Calbasse : serveur prêt sur le port ${port} (${vision.nom} · ${options.modele}, réflexion ${options.reflexion ?? 'par défaut'})`);
  if (!sms) console.log('SMS non configurés (FOURNISSEUR_SMS) : pas de récupération de compte par téléphone.');
  if (fournisseurSms === 'console') console.log('⚠️  FOURNISSEUR_SMS=console : les codes sont écrits dans les logs. Réservé au développement.');
  if (!cinetpay) console.log('Paiement CinetPay non configuré (CINETPAY_API_KEY, CINETPAY_SITE_ID, URL_PUBLIQUE).');
});
