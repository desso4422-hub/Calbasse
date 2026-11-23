# Mettre Calbasse en ligne sur Supabase (sans rien partager de secret)

Tu fais 5 petites étapes dans ton projet Supabase, en copiant-collant deux fichiers.
Durée : environ 10 minutes. Tu ne donnes à personne ta clé RodiumAI : c'est toi qui la colles dans Supabase.

Les deux fichiers sont dans le dossier `supabase/installation/` :

- `1-base-de-donnees.sql` : crée les tables et les règles (1 scan gratuit par jour, 10 avec le forfait…)
- `2-fonction-api.ts` : le « serveur » de Calbasse

## Étape 1 : la base de données

1. Dans ton projet Supabase, menu de gauche : **SQL Editor**.
2. Clique **New query**.
3. Ouvre `1-base-de-donnees.sql`, copie tout (Ctrl+A, Ctrl+C), colle dans l'éditeur.
4. Clique **Run**. Tu dois voir « Success. No rows returned ».

## Étape 2 : autoriser les comptes anonymes

1. Menu **Authentication**, puis **Sign In / Providers** (ou « Providers »).
2. Active **Allow anonymous sign-ins** et enregistre.

## Étape 3 : le serveur (fonction `api`)

1. Menu **Edge Functions**, puis **Deploy a new function**, puis **Via Editor**.
2. Nom de la fonction : exactement `api`.
3. Efface le code d'exemple, colle tout le contenu de `2-fonction-api.ts`.
4. **Important** : dans les réglages de la fonction, désactive **Verify JWT** (sinon l'app sera refusée).
5. Clique **Deploy**.

## Étape 4 : ta clé RodiumAI

1. **Edge Functions**, puis **Secrets** (ou Project Settings, puis Edge Functions, puis Secrets).
2. Ajoute un secret : nom `RODIUMAI_API_KEY`, valeur = ta clé `rd_sk_…`. Enregistre.
3. Les autres réglages sont facultatifs. Sans eux : 1 scan gratuit, 10 payant, 1 500 FCFA/mois, 12 000 FCFA/an.

## Étape 5 : m'envoyer deux informations publiques

Dans **Project Settings**, puis **API Keys** (et **Data API** pour l'adresse) :

- l'adresse du projet : `https://xxxxxxxx.supabase.co`
- la clé **publishable** : `sb_publishable_…` (cette clé est faite pour être dans l'app, tu peux me l'écrire ici)

Ne m'envoie jamais la clé « secret » ni `service_role`.

Avec ces deux informations, je vérifie que tout marche (`npm run verifier:projet -- <adresse> <clé> [photo.jpg]`).

## Si ça ne marche pas

Écris-moi le message d'erreur exact (ou une capture d'écran). Les journaux se trouvent dans Edge Functions, puis `api`, puis **Logs**.

## Générer des codes d'activation (pour vendre le forfait)

Dans **SQL Editor** :

```sql
select * from creer_codes('mensuel', 30, 5);   -- 5 codes valables 30 jours
select * from creer_codes('annuel', 365, 1);   -- 1 code valable 365 jours
```

Envoie le code au client par WhatsApp après son paiement Mobile Money. Il le saisit dans l'app (écran Premium).
