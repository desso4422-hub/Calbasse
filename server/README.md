# Serveur Calbasse

Trois rôles :

1. **Reconnaissance des plats** : reçoit la photo d'une assiette, demande au modèle de vision Gemini (Google) d'identifier chaque aliment **parmi ceux de la base de l'app** (`src/lib/aliments.ts`), et renvoie les aliments, les grammes estimés, une confiance et des alternatives. Les calories sont calculées par l'app, jamais par le modèle.
2. **Comptes et quota de scans** : chaque installation de l'app reçoit un compte anonyme (un jeton gardé dans le stockage sécurisé du téléphone). Le serveur compte les scans : 2 par jour en gratuit, 30 en Premium. Le compteur de l'app n'est qu'un affichage.
3. **Paiement Premium** avec CinetPay (Mobile Money et carte), vérifié côté serveur.

Les données (comptes, scans, paiements) sont dans un fichier SQLite, `DATA_DIR/calbasse.db`, géré par Node lui-même (aucune base à installer). Sauvegarde ce fichier régulièrement.

## Lancer

```bash
cd server
npm install
```

```bash
GEMINI_API_KEY=... npm start
```

Crée la clé sur [Google AI Studio](https://aistudio.google.com/apikey). Puis, dans l'app, mets `EXPO_PUBLIC_API_URL=http://<adresse-de-ta-machine>:8787` dans `.env.local` et relance `npx expo start`. Sur un téléphone, utilise l'adresse IP locale de ton ordinateur, pas `localhost`.

Réglages : voir `.env.example`. Node 22.13 ou plus récent (le serveur s'exécute directement en TypeScript et utilise `node:sqlite`).

## Routes

| Route | Jeton | Rôle |
| --- | --- | --- |
| `GET /sante` | | État du serveur |
| `POST /comptes` | | Crée un compte anonyme, renvoie son jeton |
| `GET /compte` | oui | Premium, scans restants, limite du jour |
| `POST /scan` | oui | Analyse une photo ; `402` si le quota du jour est épuisé |
| `POST /corrections` | oui | Corrections de l'utilisateur, pour améliorer la base |
| `POST /telephone/code` | oui | Envoie un code à 6 chiffres par SMS |
| `POST /telephone/verifier` | oui | Vérifie le code ; rattache le numéro, ou récupère l'ancien compte lié à ce numéro |
| `POST /paiements` | oui | Crée une transaction CinetPay, renvoie l'adresse de paiement |
| `GET /paiements/:id` | oui | Statut de la transaction (revérifié auprès de CinetPay) |
| `POST /cinetpay/notification` | | Notification envoyée par CinetPay |
| `GET /cinetpay/retour` | | Page affichée après le paiement, avec un lien pour revenir dans l'app |

Le jeton s'envoie dans l'en-tête `Authorization: Bearer <jeton>`. Seule son empreinte SHA-256 est stockée.

```bash
npm test
```

```bash
npm run typecheck
```

## Comment la précision est obtenue

1. **Réponse contrainte** : Gemini doit répondre en JSON selon un schéma qui n'autorise que les identifiants de la base (ou « inconnu »), et le serveur revalide la réponse. Pas d'aliment inventé, pas de calories inventées.
2. **Une description visuelle par aliment** (« Aspect »), qui nomme les confusions fréquentes : attiéké / couscous / gari, akassa / pâte blanche / ablo, igname pilée / foufou / placali, sauce graine / sauce tomate / sauce arachide… Près de 75 aliments et 25 plats d'Afrique de l'Ouest et du Centre, avec leurs noms locaux (amiwo, garba, thiéboudienne, waakye, ndolè, eru, egusi, kenkey, tô…).
3. **L'indice de l'utilisateur** (« garba bien pimenté ») est transmis comme information forte.
4. **Confiance et alternatives** : quand le modèle doute, l'aliment s'affiche en orange dans l'app et ses alternatives sont proposées en un geste. Un aliment hors base est montré comme « non reconnu », avec ce que le modèle a vu.
5. **Corrections remontées** : chaque remplacement fait dans l'app est enregistré dans `donnees/corrections.jsonl`. C'est la liste des erreurs réelles à corriger dans la base.
6. **Évaluation mesurée** : `npm run evaluer` note la reconnaissance sur tes photos étiquetées (voir `eval/LISEZ-MOI.md`). C'est le seul moyen de savoir où on en est vraiment.

Autres choix : les consignes et le catalogue (≈ 7 000 tokens) sont envoyés en premier et toujours identiques, ce qui permet au cache implicite de Gemini de les facturer moins cher ; l'app réduit la photo à 1568 px avant l'envoi.

## Modèle et coût

Par défaut : `gemini-3.8-flash` (le modèle Flash courant d'après le SDK `@google/genai` 3.2.0). Deux réglages, dans `.env` :

- `GEMINI_MODELE` : par exemple `gemini-flash-lite-latest`, encore moins cher, si la précision tient ;
- `GEMINI_REFLEXION` : `minimal`, `low`, `medium` ou `high`. Moins de réflexion = moins cher et plus rapide.

Vérifie les modèles disponibles et leurs prix sur [la page des modèles](https://ai.google.dev/gemini-api/docs/models) et [la page des tarifs](https://ai.google.dev/gemini-api/docs/pricing) : je n'ai pas pu les consulter en écrivant ce serveur. Chaque scan enregistre dans `donnees/scans.jsonl` le nombre de tokens consommés (`usage` : entrée, entrée en cache, sortie, réflexion) : multiplie par les prix de la page des tarifs pour connaître le coût réel par scan, et compare-le aux 2 000 FCFA/mois de Premium et à la limite de 30 scans par jour.

Change de modèle ou de niveau de réflexion seulement après avoir comparé la précision sur tes photos avec `npm run evaluer`.

## Numéro de téléphone et récupération de compte

Un compte anonyme vit dans le téléphone (son jeton). Pour ne pas perdre Premium en changeant de téléphone, l'utilisateur peut vérifier son numéro par SMS (Profil → « Protéger mon compte », ou proposé juste après un paiement).

Sur un nouveau téléphone, « J'ai déjà un compte Premium » (premier écran) ou Profil → même parcours : si le numéro vérifié appartient déjà à un compte, l'appareil **reprend ce compte**. L'ancien compte reçoit un nouveau jeton, ce qui déconnecte l'ancien téléphone (utile s'il a été perdu ou volé). L'abonnement le plus long est gardé, les paiements suivent, et les scans du jour s'additionnent (pas de quota gratuit en double).

Garde-fous : code à 6 chiffres valable 10 minutes, 5 essais maximum, 3 codes par numéro et 5 par compte et par heure ; seul le haché du code est stocké ; un code ne sert qu'une fois.

Envoi des SMS : `FOURNISSEUR_SMS=africastalking` avec `AT_UTILISATEUR` et `AT_CLE_API` ([Africa's Talking](https://africastalking.com), qui couvre la plupart des opérateurs de la région). Commence avec `AT_UTILISATEUR=sandbox` (bac à sable, aucun vrai SMS). En développement, `FOURNISSEUR_SMS=console` écrit le code dans les logs du serveur : **jamais en production**. Sans fournisseur, les routes `/telephone` répondent 503 et l'app ne propose pas la récupération.

⚠️ Comme pour CinetPay, l'appel à Africa's Talking (`src/sms.ts`) a été écrit sans accès à leur documentation : vérifie-le dans leur bac à sable, puis avec un vrai SMS, avant la mise en production. Chaque SMS est payant : regarde leurs tarifs par pays.

Ce que la récupération ne ramène pas : **l'historique des repas**, qui reste dans l'ancien téléphone (il n'est pas encore sauvegardé sur le serveur). L'app le dit à l'utilisateur.

## Paiement CinetPay

1. Crée un compte marchand sur CinetPay et récupère l'**API key** et le **site ID**.
2. Renseigne `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` et `URL_PUBLIQUE` (l'adresse HTTPS publique du serveur : CinetPay doit pouvoir joindre `URL_PUBLIQUE/cinetpay/notification`).
3. Parcours : l'app demande `POST /paiements` → le serveur crée la transaction chez CinetPay → l'app ouvre la page CinetPay → l'utilisateur paie (Orange Money, MTN MoMo, Moov, Wave, carte…) → CinetPay notifie le serveur → le serveur **redemande le statut à CinetPay**, vérifie montant et devise (XOF), puis active ou prolonge Premium. L'app vérifie le statut toutes les 5 secondes et à chaque retour au premier plan.

Sécurité : la notification seule n'active jamais rien. Un faux appel à `/cinetpay/notification` ne fait que déclencher une vérification auprès de CinetPay avec la clé du serveur. Une même transaction ne peut prolonger Premium qu'une fois.

⚠️ **À vérifier avant la mise en production.** Ce module a été écrit d'après l'API checkout v2 de CinetPay **sans accès à sa documentation** (le site était bloqué depuis l'environnement de développement). Il a été testé contre une simulation, pas contre CinetPay. Avant d'encaisser :

- relis les noms de champs de `src/cinetpay.ts` avec la documentation actuelle sur docs.cinetpay.com (création : `apikey`, `site_id`, `transaction_id`, `amount`, `currency`, `notify_url`, `return_url`, `channels` ; vérification : `/payment/check`, `code` « 00 » et `data.status` « ACCEPTED ») ;
- si CinetPay signe ses notifications (en-tête `x-token`), tu peux ajouter cette vérification en plus : elle n'est pas nécessaire puisque le serveur revérifie toujours le statut ;
- fais quelques vrais paiements de petit montant avec ton compte, et vérifie `donnees/calbasse.db` (table `paiements`).

Le XOF couvre l'UEMOA (Bénin, Côte d'Ivoire, Sénégal, Togo, Burkina Faso, Mali, Niger). Pour le Cameroun (XAF) ou d'autres pays, il faudra adapter la devise et les prix.

## Déployer

N'importe quel hébergeur Node (Render, Railway, Fly.io, un VPS…) : `npm install` puis `npm start`, avec `GEMINI_API_KEY` en variable secrète. Mets le serveur derrière HTTPS. Les photos de repas sont des données personnelles : avec l'offre gratuite de l'API Gemini, Google peut utiliser les requêtes pour améliorer ses produits ; vérifie les conditions de Google et passe sur un compte payant avant d'accueillir de vrais utilisateurs. La limite par adresse IP est en mémoire : avec plusieurs instances, déplace-la vers le proxy ou une base partagée. Derrière un proxy (Render, Fly.io, Nginx…), mets `DERRIERE_PROXY=1` pour que les limites par adresse IP voient la vraie adresse.

Limite connue : les comptes sont anonymes. Quelqu'un de déterminé peut en créer plusieurs pour cumuler des scans gratuits ; la limite de comptes créés par adresse IP (`COMPTES_PAR_HEURE`) freine ça. Pour aller plus loin : Play Integrity (Android) et App Attest (iOS). Un utilisateur qui n'a pas vérifié son numéro et réinitialise son téléphone perd son compte : en dernier recours, retrouve son paiement dans la table `paiements` grâce à la référence CinetPay qu'il te donne, et rattache-le à son nouveau compte.
