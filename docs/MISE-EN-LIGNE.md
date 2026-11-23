# Mettre Calbasse en ligne pour de vrais utilisateurs

Ce guide dit **ce que tu fais toi** (comptes, décisions) et **ce que Claude fait ensuite**. Compte 15 à 20 minutes.

## Comment ça marche, en une phrase

L'app envoie la photo à **ta fonction sur Supabase**, qui seule connaît ta clé RodiumAI, compte les scans de chacun
(**1 gratuit par jour, 10 avec le forfait payant**) et renvoie les aliments reconnus. La clé n'est jamais dans l'app.

```
Téléphone ──photo──▶ Supabase (fonction « api » + base de données) ──▶ RodiumAI / Gemini
                         │  garde : comptes anonymes, scans du jour, corrections
                         ▼
                 limite par personne (1 ou 10 selon le forfait) + plafond global par jour (protège ton crédit)
```

## Étape 1 : Supabase (10 minutes)

1. Va sur **supabase.com**, clique **Start your project** et connecte-toi avec GitHub.
2. **New project** :
   - Name : `calbasse`
   - Database password : clique **Generate a password** et **note-le** dans un endroit sûr (tu n'en auras pas besoin tout de suite, mais il est impossible à retrouver)
   - Region : **West EU (Paris)** ou, à défaut, **West EU (Ireland)** : ce sont les plus proches de l'Afrique de l'Ouest
   - Plan : **Free**
   - Attends 2 minutes que le projet soit prêt.
3. Menu de gauche → **Authentication** → **Sign In / Providers** → active **Anonymous sign-ins** → **Save**.
   (Si tu ne le trouves pas, ce n'est pas grave : Claude peut l'activer à ta place à l'étape suivante.)
4. Menu de gauche → **Edge Functions** → **Secrets** → **Add new secret** :
   - Name : `RODIUMAI_API_KEY`
   - Value : ta clé RodiumAI (`rd_sk_…`)
   - **Save**.
   *C'est toi qui la colles, pas Claude : ainsi elle ne passe jamais par la conversation.*
5. **Project Settings** → **API Keys** (ou **API**) : note **Project URL** (`https://xxxx.supabase.co`) et la clé **Publishable** (ou « anon », elle commence par `sb_publishable_` ou `eyJ`). Ces deux-là sont publiques : tu peux me les écrire dans la conversation.
6. Ton avatar en haut à droite → **Account preferences** → **Access Tokens** → **Generate new token**, nom `claude`. **Ne le colle pas dans la conversation** : quand tu me dis que c'est prêt, Claude affiche un formulaire sécurisé. Tu pourras supprimer ce jeton à la fin.

## Étape 2 : Expo, pour fabriquer l'APK (5 minutes)

1. Va sur **expo.dev** → **Sign up** (e-mail ou GitHub). Choisis un nom d'utilisateur.
2. **Account settings** → **Access tokens** → **Create token**, nom `claude`. Même principe : formulaire sécurisé.

## Étape 3 : tes décisions

- **Ton contact** : une adresse e-mail ou un **numéro WhatsApp** (de préférence : l'app y envoie les clients qui veulent payer). Il apparaît aussi dans la politique de confidentialité, c'est obligatoire.
- **Les prix** : par défaut **2 000 FCFA par mois** (30 jours) et **20 000 FCFA par an** (365 jours). Dis-moi si tu les changes.
- **Plafond de scans par jour pour tout le monde** : 300 par défaut. Au-delà, l'app répond « Calbasse est très sollicité, réessaie demain ». Il protège ton crédit tant que tu n'as pas mesuré la consommation réelle.

Les limites (1 scan gratuit, 10 avec le forfait) sont déjà réglées.

## Vendre le forfait

Deux façons de faire payer, qui peuvent coexister :

**1. Par code d'activation (marche tout de suite, sans compte marchand)**

1. Le client t'écrit sur WhatsApp (l'écran Premium de l'app a un bouton qui ouvre la conversation avec un message prêt).
2. Il te paie en Mobile Money, sur ton numéro.
3. Tu crées un code dans Supabase → **SQL Editor** :
   ```sql
   select * from creer_codes('mensuel', 30, 1, 'Awa, 2000 FCFA, 24/11');
   ```
   (`'annuel', 365` pour l'offre annuelle ; le nombre devant la note permet d'en créer plusieurs d'un coup.)
4. Tu lui envoies le code (`CAL-XXXX-XXXX-XXXX`). Il le saisit dans Premium → « J'ai un code d'activation » : le forfait s'active tout de suite.
5. Un code ne sert qu'une fois. La note te permet de retrouver qui a payé quoi :
   `select code, plan, note, utilise_le from codes_activation order by cree_le desc;`

*Un client change de téléphone ou réinstalle l'app ?* Son compte est lié à son téléphone : retrouve son paiement dans tes notes et envoie-lui un nouveau code.

**2. Paiement automatique avec CinetPay** (Mobile Money et carte, sans intervention de ta part)

Il faut un compte marchand CinetPay (inscription et vérification de ton activité). Ensuite, dans Supabase → Edge Functions → Secrets : `CINETPAY_API_KEY` et `CINETPAY_SITE_ID`. Claude fait le reste, y compris un test en mode d'essai avant les vrais paiements. L'écran Premium bascule alors tout seul vers « Payer ».

## Secrets de la fonction (réglages)

| Nom | Rôle | Par défaut |
| --- | --- | --- |
| `RODIUMAI_API_KEY` | ta clé RodiumAI | obligatoire |
| `SCANS_GRATUITS` | scans par jour, forfait gratuit | 1 |
| `SCANS_PREMIUM` | scans par jour, forfait payant | 10 |
| `BUDGET_JOUR` | plafond de scans par jour, tous utilisateurs | 300 |
| `PRIX_MENSUEL` / `PRIX_ANNUEL` | prix en FCFA (multiples de 5) | 2000 / 20000 |
| `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` | paiement automatique (facultatif) | absent |

## Ensuite, Claude s'occupe de

1. appliquer la base de données et déployer la fonction ;
2. vérifier un vrai scan de bout en bout sur ton projet ;
3. construire l'APK (signature permanente gérée par Expo) ;
4. te donner le lien de téléchargement et les messages WhatsApp d'accueil.

## Surveiller après le lancement

Dans Supabase → **SQL Editor**, copie `select * from stats_jour;` : scans réussis, scans en échec, nombre de personnes,
corrections reçues, temps moyen d'analyse, jour par jour. Et `select count(*) from abonnements where jusqu_au > now();` pour le nombre d'abonnés.
Dans **Edge Functions → api → Logs**, une ligne `ALERTE service de vision` signale une clé invalide ou un crédit RodiumAI épuisé.

## Si tu changes d'avis

- Changer les limites ou les prix : Supabase → Edge Functions → Secrets (voir le tableau ci-dessus).
- Offrir un mois à quelqu'un : crée-lui un code. Pour activer directement un compte connu : `select activer_abonnement('<identifiant>', 'mensuel', 30, 'manuel');`
- Supprimer un utilisateur et ses données : Supabase → Authentication → Users → Delete user (tout part avec lui).
