#!/usr/bin/env node
/**
 * Contrôle un projet Supabase en ligne, avec les seules informations PUBLIQUES (adresse et clé « publishable »).
 * Aucun jeton d'accès n'est nécessaire.
 *
 *   node scripts/verifier-projet.mjs https://abcdefgh.supabase.co sb_publishable_xxx [photo.jpg]
 *
 * Avec une photo, il fait aussi un vrai scan (≈ 2,4 RODI) : il teste la clé RodiumAI, la limite de 1 scan gratuit
 * et le renvoi d'une même photo. Il crée un compte de test et le supprime à la fin.
 */
import { existsSync, readFileSync } from 'node:fs';

const [url, cle, photo] = process.argv.slice(2);
if (!url || !cle) {
  console.error('Usage : node scripts/verifier-projet.mjs <adresse du projet> <clé publishable> [photo.jpg]');
  process.exit(2);
}
const base = url.replace(/\/+$/, '');
const api = `${base}/functions/v1/api`;
let echecs = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const ko = (m, aide) => { echecs++; console.log(`  ✗ ${m}${aide ? `\n      → ${aide}` : ''}`); };
const appel = async (methode, chemin, jeton, corps) => {
  try {
    const r = await fetch(`${api}${chemin}`, { method: methode, headers: { 'Content-Type': 'application/json', apikey: cle, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) }, body: corps === undefined ? undefined : JSON.stringify(corps) });
    return { statut: r.status, corps: await r.json().catch(() => null) };
  } catch (e) {
    return { statut: 0, corps: { erreur: String(e.message ?? e) } };
  }
};

console.log(`\nContrôle de ${base}\n`);

// 1. La fonction répond
const sante = await appel('GET', '/sante');
if (sante.statut === 200 && sante.corps?.ok) {
  ok('La fonction « api » répond');
  const t = sante.corps.tarifs;
  sante.corps.scansGratuits === 1 && sante.corps.scansPremium === 10 ? ok('Limites : 1 scan gratuit, 10 avec le forfait') : ko(`Limites inattendues : ${sante.corps.scansGratuits} / ${sante.corps.scansPremium}`, 'Vérifie les secrets SCANS_GRATUITS et SCANS_PREMIUM (ou supprime-les pour les valeurs par défaut)');
  t?.mensuel?.montant === 1500 && t?.annuel?.montant === 12000 ? ok('Prix : 1 500 FCFA par mois, 12 000 par an') : ko(`Prix inattendus : ${t?.mensuel?.montant} / ${t?.annuel?.montant}`, 'Vérifie les secrets PRIX_MENSUEL et PRIX_ANNUEL');
  console.log(`  · Paiement en ligne (CinetPay) : ${sante.corps.paiement ? 'configuré' : 'non configuré (les codes d’activation fonctionnent)'}`);
} else {
  ko(`La fonction « api » ne répond pas (statut ${sante.statut}) : ${JSON.stringify(sante.corps)}`, sante.statut === 404 ? 'La fonction n’existe pas, ou elle ne s’appelle pas exactement « api »' : sante.statut === 401 ? 'Désactive « Verify JWT » dans les réglages de la fonction' : 'Regarde les journaux : Edge Functions → api → Logs');
  console.log(`\n${echecs} problème(s). Les autres contrôles sont impossibles tant que la fonction ne répond pas.\n`);
  process.exit(1);
}

// 2. Connexion anonyme
let jeton = null;
try {
  const r = await fetch(`${base}/auth/v1/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cle }, body: JSON.stringify({ data: {} }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.access_token) { jeton = j.access_token; ok('Compte anonyme créé'); }
  else ko(`Création d’un compte anonyme refusée (${r.status}) : ${j.msg ?? j.error_description ?? j.message ?? ''}`, r.status === 422 || /anonymous/i.test(JSON.stringify(j)) ? 'Active « Allow anonymous sign-ins » dans Authentication → Sign In / Providers' : r.status === 401 || r.status === 403 ? 'La clé publique semble fausse : reprends-la dans Project Settings → API Keys' : 'Réessaie dans un moment');
} catch (e) { ko(`Connexion impossible : ${e.message}`); }

if (jeton) {
  // 3. Compte, accès protégé, base de données
  const compte = await appel('GET', '/compte', jeton);
  compte.statut === 200 && compte.corps?.limite === 1 && compte.corps?.scansRestants === 1
    ? ok('La base de données répond : compte gratuit, 1 scan par jour')
    : ko(`Lecture du compte : statut ${compte.statut} ${JSON.stringify(compte.corps)}`, compte.statut === 500 ? 'La base n’est probablement pas installée : colle le fichier 1-base-de-donnees.sql dans SQL Editor' : undefined);
  (await appel('GET', '/compte')).statut === 401 ? ok('Sans connexion, l’accès est refusé') : ko('Un accès sans connexion n’est pas refusé');
  const code = await appel('POST', '/codes', jeton, { code: 'CAL-0000-0000-0000' });
  code.statut === 400 && code.corps?.code === 'invalide' ? ok('Un faux code d’activation est refusé') : ko(`Faux code : statut ${code.statut} ${JSON.stringify(code.corps)}`);

  // Sauvegarde en ligne : refusée tant que le compte n'a pas d'e-mail
  const sauv = await appel('GET', '/sauvegarde', jeton);
  sauv.statut === 403 && sauv.corps?.code === 'sans_email'
    ? ok('La sauvegarde en ligne est installée (réservée aux comptes avec e-mail)')
    : ko(`Sauvegarde : statut ${sauv.statut} ${JSON.stringify(sauv.corps)}`, sauv.statut === 404 || sauv.statut === 400 || sauv.statut === 500 ? 'Colle le fichier 2-sauvegarde-des-donnees.sql dans SQL Editor, puis redéploie la fonction avec 3-fonction-api.ts' : undefined);

  // 4. Vrai scan (facultatif)
  if (photo) {
    if (!existsSync(photo)) ko(`Photo introuvable : ${photo}`);
    else {
      const image = readFileSync(photo).toString('base64');
      const t0 = Date.now();
      const scan = await appel('POST', '/scan', jeton, { cle: `verif-${Date.now()}`, image, typeImage: 'image/jpeg', indice: '' });
      if (scan.statut === 200 && scan.corps?.lignes?.length) {
        ok(`Scan réel réussi en ${((Date.now() - t0) / 1000).toFixed(1)} s : ${scan.corps.nom} (${scan.corps.lignes.map((l) => l.alimentId).join(', ')})`);
        scan.corps.compte?.scansRestants === 0 ? ok('Le scan est décompté : 0 restant sur 1') : ko(`Décompte inattendu : ${JSON.stringify(scan.corps.compte)}`);
        const quota = await appel('POST', '/scan', jeton, { cle: `verif-autre-${Date.now()}`, image, typeImage: 'image/jpeg' });
        quota.statut === 402 && quota.corps?.code === 'quota' ? ok('Le 2e scan du jour est refusé (limite gratuite)') : ko(`2e scan : statut ${quota.statut} ${JSON.stringify(quota.corps)}`);
      } else {
        ko(`Scan réel en échec : statut ${scan.statut} ${JSON.stringify(scan.corps)}`, scan.statut === 503 ? 'La clé RodiumAI est absente ou refusée, ou ton crédit est épuisé : vérifie le secret RODIUMAI_API_KEY' : undefined);
      }
    }
  }

  // 5. Nettoyage
  const suppr = await appel('DELETE', '/compte', jeton);
  suppr.statut === 200 ? ok('Compte de test supprimé (la suppression de compte fonctionne)') : ko(`Suppression du compte de test : statut ${suppr.statut} ${JSON.stringify(suppr.corps)}`);
}

console.log(echecs ? `\n✗ ${echecs} problème(s) à corriger.\n` : '\n✓ Tout est en ordre : ton projet est prêt.\n');
process.exit(echecs ? 1 : 0);
