# Mettre Calbasse en ligne sur Supabase (sans rien partager de secret)

Tu fais quelques étapes dans ton projet Supabase, en copiant-collant des fichiers.
Tu ne donnes à personne ta clé RodiumAI : c'est toi qui la colles dans Supabase.

Les fichiers sont dans le dossier `supabase/installation/`, à utiliser **dans l'ordre des numéros** :

| Fichier | Où le coller | Rôle |
|---|---|---|
| `1-base-de-donnees.sql` | SQL Editor | tables et règles (1 scan gratuit/jour, 10 avec le forfait…) |
| `2-sauvegarde-des-donnees.sql` | SQL Editor | sauvegarde en ligne du profil et des repas (compte avec e-mail) |
| `3-fonction-api.ts` | Edge Functions → `api` | le « serveur » de Calbasse |

Si tu as déjà fait les étapes 1 à 3 d'une version précédente, ne refais que ce qui est nouveau (voir « Mise à jour »).

## Étape 1 : la base de données

1. **SQL Editor** → **New query**.
2. Copie tout le contenu de `1-base-de-donnees.sql`, colle, clique **Run**. Résultat attendu : « Success. No rows returned ».
3. Recommence avec `2-sauvegarde-des-donnees.sql` (nouvelle requête, coller, Run).

## Étape 2 : autoriser les comptes anonymes

Chaque téléphone reçoit un identifiant secret anonyme : c'est lui qui permet de compter « 1 scan gratuit par jour ». Il devient un vrai compte quand la personne ajoute son e-mail.

**Authentication → Sign In / Providers** : active **Allow anonymous sign-ins**, puis Save.

## Étape 3 : le serveur (fonction `api`)

1. **Edge Functions** → la fonction `api` (ou **Deploy a new function → Via Editor** si elle n'existe pas ; nom exact : `api`).
2. Efface tout le code, colle le contenu de `3-fonction-api.ts`, clique **Deploy**.
3. « Verify JWT » : laisse-le désactivé si Supabase te le permet (le contrôle de ton projet te dira si ça bloque).

## Étape 4 : ta clé RodiumAI

**Edge Functions → Secrets** : ajoute `RODIUMAI_API_KEY` (valeur : ta clé `rd_sk_…`).
Autres secrets facultatifs : `SCANS_GRATUITS`, `SCANS_PREMIUM`, `BUDGET_JOUR`, `PRIX_MENSUEL`, `PRIX_ANNUEL`. Sans eux : 1 scan gratuit, 10 payants, 1 500 FCFA/mois, 12 000 FCFA/an.

## Étape 5 : les e-mails de connexion (indispensable pour le compte avec e-mail)

L'utilisateur reçoit un **code à 6 chiffres** par e-mail. Il faut deux réglages.

### 5a. Mettre le code dans les modèles d'e-mail

Par défaut, Supabase envoie un lien, pas un code. **Authentication → Email Templates** (ou *Emails → Templates*) :

1. Ouvre **Magic Link**. Remplace le contenu par :
   ```html
   <h2>Ton code Calbasse</h2>
   <p>Entre ce code dans l'application :</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Si tu n'as rien demandé, ignore ce message.</p>
   ```
   et mets comme objet : `Ton code Calbasse`.
2. Ouvre **Change Email Address** et colle exactement le même contenu et le même objet.

L'important est `{{ .Token }}` : c'est le code.

### 5b. Brancher un vrai service d'envoi d'e-mails

L'envoi intégré de Supabase ne livre qu'aux membres de ton équipe et très peu par heure : il ne convient pas à de vrais utilisateurs. Le plus simple et gratuit (300 e-mails par jour) : **Brevo**.

1. Crée un compte sur brevo.com, puis dans **Senders** valide une adresse d'expéditeur (Brevo t'envoie un e-mail de confirmation). Prends une adresse que tu relis, par exemple ton e-mail de contact.
2. Dans Brevo : **SMTP & API → SMTP** : note le *login* et crée une *clé SMTP* (mot de passe).
3. Dans Supabase : **Authentication → Emails → SMTP Settings** (ou Project Settings → Authentication) : active « Enable custom SMTP » et remplis :
   - Sender email : l'adresse validée chez Brevo, sender name : `Calbasse`
   - Host : `smtp-relay.brevo.com`, Port : `587`
   - Username : ton login Brevo, Password : la clé SMTP
4. **Authentication → Rate Limits** : « emails sent per hour » : mets 30 ou plus.

## Étape 6 : m'envoyer deux informations publiques

- l'adresse du projet : `https://xxxxxxxx.supabase.co`
- la clé **publishable** : `sb_publishable_…` (faite pour être dans l'app)

Ne m'envoie jamais la clé « secret » ni `service_role`. Je lance alors `npm run verifier:projet -- <adresse> <clé> [photo.jpg]`.

## Mise à jour (tu as déjà installé une version précédente)

Colle seulement les fichiers nouveaux dans l'ordre : `2-sauvegarde-des-donnees.sql` (SQL Editor → Run), puis `3-fonction-api.ts` (remplace le code de `api` → Deploy), puis l'étape 5.

## Si ça ne marche pas

Écris-moi le message d'erreur exact (ou une capture). Les journaux : Edge Functions → `api` → **Logs**.

## Générer des codes d'activation (pour vendre le forfait)

Dans **SQL Editor** :

```sql
select * from creer_codes('mensuel', 30, 5);   -- 5 codes valables 30 jours
select * from creer_codes('annuel', 365, 1);   -- 1 code valable 365 jours
```

Envoie le code au client par WhatsApp après son paiement Mobile Money. Il le saisit dans l'app (écran Premium).
