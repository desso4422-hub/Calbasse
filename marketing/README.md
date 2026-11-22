# Publicités Calbasse — guide de production

Deux créatives UGC, construites selon la méthode Titan Academy :
4 vidéos assemblées, 4 avatars IA différents, chaque partie sous 60 mots, français dilué.

| Fichier | Cible |
| --- | --- |
| `ugc-perte-de-poids.md` | Les gens qui veulent maigrir |
| `ugc-prise-de-poids.md` | Les gens qui veulent prendre du poids ou de la masse |

Chaque fiche contient, pour les 4 UGC : le profil de l'avatar, le prompt Gemini pour
fabriquer son visage, le script complet, les deux parties découpées, et les deux prompts
Flow prêts à coller.

---

## Les outils et les comptes

| Étape | Outil | Adresse |
| --- | --- | --- |
| Fabriquer les visages | Gemini | gemini.google.com |
| Fabriquer les vidéos | VEO / Flow | labs.google/fx/fr/tools/flow |
| Assembler et sous-titrer | CapCut | capcut.com |
| Diffuser | TikTok Ads / Meta Ads | — |

Les deux premiers demandent un compte Google. Tout se fait depuis un navigateur.

---

## La chaîne de production, dans l'ordre

**1. Les 4 visages (Gemini)**
Pour chaque UGC, copie le prompt « Avatar » de la fiche dans Gemini. Télécharge l'image.
Si le visage ne te convainc pas, redemande : « refais-la, autre visage, même décor ».
Range les images sous les noms `pertedepoids-avatar1.jpg` … `pertedepoids-avatar4.jpg`.

> Critère unique pour valider un visage : *est-ce que je ferais confiance à cette personne
> si elle me recommandait Calbasse ?* Si la réponse est non, recommence.

**2. Les 8 vidéos (Flow)**
Pour chaque UGC :
1. Charge l'image de l'avatar dans Flow.
2. Colle le **Prompt Flow — partie 1**. Génère.
3. Sur la vidéo obtenue, clique **Prolonger**, colle le **Prompt Flow — partie 2**. Génère.
4. Télécharge la vidéo complète.

Prolonger, plutôt que générer une deuxième vidéo à part : c'est ce qui garde la même voix
et le même visage d'un bout à l'autre.

**3. L'assemblage (CapCut)**
- Mets les 4 vidéos bout à bout, dans l'ordre 01 → 02 → 03 → 04.
- Coupe les silences au début et à la fin de chaque morceau : l'enchaînement doit être sec.
- Sous-titres automatiques, gros, au centre, 3 à 4 mots par ligne, mot en cours surligné.
- Pas de musique, ou très basse : un témoignage avec une musique forte sonne faux.
- Format 9:16, export 1080p.

**4. La diffusion**
Le CTA renvoie vers WhatsApp. Prépare le lien avant de lancer :

```
https://wa.me/229XXXXXXXX?text=Bonjour%2C%20je%20veux%20essayer%20Calbasse
```

Remplace `229XXXXXXXX` par ton numéro au format international, sans `+` ni espaces.
Le message est déjà écrit dans la conversation : la personne n'a plus qu'à envoyer.

---

## Les règles qui ne changent pas

1. **Un avatar différent par partie.** Quatre visages, c'est l'impression de quatre vraies personnes.
2. **Moins de 60 mots par partie.** Au-delà, la cible décroche.
3. **Français dilué, oral.** Comme on parle à Cotonou, Abidjan ou Dakar — jamais du français d'école.
4. **Structure de chaque témoignage** : problème → solution → transformation.
5. **Trois témoignages différents** : profils, problèmes *et* transformations distincts.
6. **L'avatar incarne la situation désirée, pas le problème.** Personne n'achète un savon
   anti-boutons à quelqu'un qui a le visage couvert de boutons.
7. **Le CTA rappelle la douleur, donne une action claire, rappelle la transformation.**

---

## Les chiffres et les promesses

Les scripts ne contiennent **aucun résultat chiffré** : « mon pantalon ferme », pas « −7 kg
en 30 jours ». C'est délibéré.

- Les témoignages sont joués par des avatars IA : un chiffre inventé est une promesse que
  personne ne peut tenir, et Meta comme TikTok refusent les publicités qui promettent une
  perte de poids chiffrée.
- Dès que tu auras de vrais utilisateurs, remplace ces phrases par leurs vrais résultats,
  avec leur accord. Un chiffre vrai convertit mieux qu'un chiffre inventé.
- Ne promets jamais un effet de santé (« guérit le diabète », « fait fondre la graisse »).
  Calbasse montre ce qu'il y a dans l'assiette : c'est ça, la promesse.

---

## Plan de test

Lance les deux créatives en même temps, même budget, et laisse tourner trois jours sans y
toucher. Regarde deux chiffres : le pourcentage de gens qui regardent au-delà de 3 secondes
(c'est le hook) et le nombre de messages WhatsApp reçus (c'est le reste).

- Peu de vues à 3 secondes → change le hook. Chaque fiche en propose trois de rechange.
- Beaucoup de vues mais peu de messages → change le CTA ou les témoignages.

Garde la créative gagnante, et fabrique-lui des variantes en ne changeant qu'une chose à
la fois : d'abord le hook, puis le 2ᵉ témoignage, puis le CTA.
