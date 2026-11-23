# Mettre Calbasse en ligne pour de vrais utilisateurs

Ce guide dit **ce que tu fais toi** (comptes, décisions) et **ce que Claude fait ensuite**. Compte 15 à 20 minutes.

## Comment ça marche, en une phrase

L'app envoie la photo à **ta fonction sur Supabase**, qui seule connaît ta clé RodiumAI, compte les scans de chacun
(5 gratuits par jour et par personne, réglable) et renvoie les aliments reconnus. La clé n'est jamais dans l'app.

```
Téléphone ──photo──▶ Supabase (fonction « api » + base de données) ──▶ RodiumAI / Gemini
                         │  garde : comptes anonymes, scans du jour, corrections
                         ▼
                 limite par personne + plafond global par jour (protège ton crédit)
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

## Étape 3 : trois décisions

- **Ton contact** : une adresse e-mail ou un numéro WhatsApp, qui apparaîtra dans la politique de confidentialité (obligatoire).
- **Scans gratuits par jour et par personne** : 5 par défaut. À 2,4 RODI le scan, 5 scans coûtent ≈ 12 RODI par personne et par jour au maximum.
- **Plafond de scans par jour pour tout le monde** : 300 par défaut. Au-delà, l'app répond « Calbasse est très sollicité, réessaie demain ». Il protège ton crédit tant que tu n'as pas mesuré la consommation réelle.

## Ensuite, Claude s'occupe de

1. appliquer la base de données et déployer la fonction ;
2. vérifier un vrai scan de bout en bout sur ton projet ;
3. construire l'APK (signature permanente gérée par Expo) ;
4. te donner le lien de téléchargement et les messages WhatsApp d'accueil.

## Surveiller après le lancement

Dans Supabase → **SQL Editor**, copie `select * from stats_jour;` : scans réussis, scans en échec, nombre de personnes,
corrections reçues, temps moyen d'analyse, jour par jour.
Dans **Edge Functions → api → Logs**, une ligne `ALERTE service de vision` signale une clé invalide ou un crédit RodiumAI épuisé.

## Si tu changes d'avis

- Changer le nombre de scans gratuits : Supabase → Edge Functions → Secrets → `SCANS_PAR_JOUR`.
- Supprimer un utilisateur et ses données : Supabase → Authentication → Users → Delete user (tout part avec lui).
