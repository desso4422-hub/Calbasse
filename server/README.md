# Serveur Calbasse

Trois rôles :

1. **Reconnaissance des plats** : reçoit la photo d'une assiette, demande au modèle de vision (Gemini, via [RodiumAI](https://www.rodiumai.io) ou directement chez Google) d'identifier chaque aliment **parmi ceux de la base de l'app** (`src/lib/aliments.ts`), et renvoie les aliments, les grammes estimés, une confiance et des alternatives. Les calories sont calculées par l'app, jamais par le modèle.
2. **Comptes et quota de scans** : chaque installation de l'app reçoit un compte anonyme (un jeton gardé dans le stockage sécurisé du téléphone). Le serveur compte les scans : 2 par jour en gratuit et 30 en Premium par défaut, réglables avec `SCANS_GRATUITS` et `SCANS_PREMIUM` (pour les testeurs du MVP, par exemple `SCANS_GRATUITS=10`). Le compteur de l'app n'est qu'un affichage.
3. **Paiement Premium** avec CinetPay (Mobile Money et carte), vérifié côté serveur.

Les données (comptes, scans, paiements) sont dans un fichier SQLite, `DATA_DIR/calbasse.db`, géré par Node lui-même (aucune base à installer). Sauvegarde ce fichier régulièrement.

## Lancer

```bash
cd server
npm install
```

```bash
RODIUMAI_API_KEY=rd_sk_... npm start
```

La clé se crée sur [RodiumAI](https://www.rodiumai.io), qui donne accès à Gemini avec un paiement possible depuis l'Afrique. Pour utiliser Google directement, mets plutôt `GEMINI_API_KEY` (clé « AIza… » de [Google AI Studio](https://aistudio.google.com/apikey)).

Derrière un proxy d'entreprise ou dans un environnement cloud qui impose un proxy, ajoute `NODE_USE_ENV_PROXY=1` : sinon Node ignore `HTTPS_PROXY`. Puis, dans l'app, lance `EXPO_PUBLIC_API_URL=auto npx expo start` : en développement, l'app retrouve seule l'adresse de ton ordinateur (le téléphone doit être sur le même Wi-Fi). En production, mets l'adresse HTTPS du serveur.

Réglages : voir `.env.example`. Node 22.13 ou plus récent (le serveur s'exécute directement en TypeScript et utilise `node:sqlite`).

## Routes

| Route | Jeton | Rôle |
| --- | --- | --- |
| `GET /sante` | | État du serveur |
| `POST /comptes` | | Crée un compte anonyme, renvoie son jeton |
| `GET /compte` | oui | Premium, scans restants, limite du jour |
| `POST /scan` | oui | Analyse une photo ; `402` si le quota du jour est épuisé. Avec `cle` (identifiant unique de la photo), un renvoi rend le même résultat sans nouvelle analyse ni nouveau décompte, même pendant que l'analyse est en cours |
| `POST /corrections` | oui | Corrections de l'utilisateur, pour améliorer la base |
| `POST /telephone/code` | oui | Envoie un code à 6 chiffres par SMS |
| `POST /telephone/verifier` | oui | Vérifie le code ; rattache le numéro, ou récupère l'ancien compte lié à ce numéro |
| `POST /paiements` | oui | Crée une transaction CinetPay, renvoie l'adresse de paiement |
| `GET /paiements/:id` | oui | Statut de la transaction (revérifié auprès de CinetPay) |
| `POST /cinetpay/notification` | | Notification envoyée par CinetPay |
| `GET /cinetpay/retour` | | Page affichée après le paiement, avec un lien pour revenir dans l'app |

Le jeton s'envoie dans l'en-tête `Authorization: Bearer <jeton>`. Seule son empreinte SHA-256 est stockée.

Pour essayer la reconnaissance sur tes propres photos, sans lancer l'app (avec ta clé dans `RODIUMAI_API_KEY`) :

```bash
npm run essai -- photo1.jpg photo2.jpg --indice "garba"
```

Le script affiche les aliments reconnus, les calories calculées, la durée et les tokens consommés (pour estimer le coût par scan).

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

Par défaut : **Gemini 3.1 Flash Lite via RodiumAI** (`google/gemini-3.1-flash-lite`). Réglages dans `.env` : `RODIUMAI_MODELE` (liste et prix : `https://api.rodiumai.io/v1/pricing`) et `REFLEXION` (`minimal`, `low`, `medium` ou `high`).

Premiers chiffres mesurés (5 photos, novembre 2026) : **2 à 3 secondes** par analyse, environ **10 400 tokens en entrée** (consignes + catalogue + photo) et **350 en sortie**. Au tarif RodiumAI de ce modèle (190,9 RODI par million de tokens en entrée, 1 145,3 en sortie), cela fait **environ 2,4 RODI par scan**. Vérifie sur ton tableau de bord RodiumAI la valeur d'un RODI en FCFA et le coût réel (`usage` dans `donnees/scans.jsonl`).

Pistes pour réduire encore le coût : `google/gemini-2.5-flash-lite` (environ 3 fois moins cher en entrée), ou un catalogue plus court envoyé au modèle. Ne change de modèle qu'après avoir comparé la précision avec `npm run evaluer` sur les mêmes photos.

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

N'importe quel hébergeur Node (Render, Railway, Fly.io, un VPS…) : `npm install` puis `npm start`, avec `RODIUMAI_API_KEY` en variable secrète. Mets le serveur derrière HTTPS. Les photos de repas sont des données personnelles : avec l'offre gratuite de l'API Gemini, Google peut utiliser les requêtes pour améliorer ses produits ; vérifie les conditions de Google et passe sur un compte payant avant d'accueillir de vrais utilisateurs. La limite par adresse IP est en mémoire : avec plusieurs instances, déplace-la vers le proxy ou une base partagée. Derrière un proxy (Render, Fly.io, Nginx…), mets `DERRIERE_PROXY=1` pour que les limites par adresse IP voient la vraie adresse.

Limite connue : les comptes sont anonymes. Quelqu'un de déterminé peut en créer plusieurs pour cumuler des scans gratuits ; la limite de comptes créés par adresse IP (`COMPTES_PAR_HEURE`) freine ça. Pour aller plus loin : Play Integrity (Android) et App Attest (iOS). Un utilisateur qui n'a pas vérifié son numéro et réinitialise son téléphone perd son compte : en dernier recours, retrouve son paiement dans la table `paiements` grâce à la référence CinetPay qu'il te donne, et rattache-le à son nouveau compte.
