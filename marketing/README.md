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
4. Écoute les deux parties à la suite, puis télécharge.

Prolonger, plutôt que générer une deuxième vidéo à part : c'est ce qui garde le mieux la
même voix et le même visage d'un bout à l'autre.

> **La voix doit être la même dans les deux parties d'un avatar.** Flow en change dès qu'il
> le peut : c'est le défaut le plus visible de la première production. Les prompts décrivent
> maintenant la voix (timbre, hauteur, accent, ton) et le débit, mot pour mot identiques dans
> la partie 1 et la partie 2 — ne jamais raccourcir ces blocs en les collant, c'est eux qui
> tiennent la voix.

**Écouter les deux parties à la suite avant de télécharger.** Trois questions :

1. Est-ce la même personne qui parle ? Si le timbre ou la hauteur change, régénérer la
   partie 2 (« Prolonger » à nouveau) sans rien modifier au prompt : chaque génération tire
   une voix, il en faut parfois deux ou trois pour tomber juste.
2. Le débit est-il le même ? Si une partie est nettement plus lente ou plus rapide, la
   régénérer : le montage rattrape un petit écart, pas un grand.
3. Y a-t-il un long silence au début, à la fin, ou au milieu d'une phrase ? Les silences
   créent des à-coups de rythme. Régénérer plutôt que de couper.

Une partie qui demande trois générations reste moins chère qu'une publicité où l'on entend
deux personnes différentes jouer le même témoignage.

**3. L'assemblage (CapCut, ou `montage/assembler.py` qui le fait automatiquement)**
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

## Retours de la première production (perte de poids)

Huit rushs reçus, trois enseignements :

1. **Maximum 24 mots par partie.** Une partie de 8 secondes se dit à environ 3 mots par seconde.
   La partie 1 de l'UGC 01 en faisait 31 : l'IA a été coupée en plein « l'attiéké poisson ». Deux
   autres parties à 27 et 29 mots tenaient de justesse. Version courte conseillée pour une nouvelle
   génération : « Tu veux maigrir mais tu manges africain tous les jours ? Moi c'était ça mon
   problème. Aucune appli ne connaît l'attiéké poisson. » (21 mots)
2. **L'IA incruste parfois de faux sous-titres** en bas de l'image. À chercher dans chaque rush ;
   `zoom_force` dans la config du montage les cache par un zoom.
3. **Le nom Calbasse n'est pas toujours bien prononcé.** À écouter dans chaque rush. S'il est mal
   dit, régénérer la partie en écrivant « Calbasse » comme il doit se prononcer (par exemple
   « Cal-basse »).
4. **Les mots africains sont souvent mal dits** (« attiéké » devenait un faux mot). Les écrire comme
   ils se prononcent : « atchéké » pour l'attiéké (prononciation ivoirienne), « ndolé » sans le N
   initial est déjà ce que l'IA dit.
5. **La vitesse de parole varie beaucoup d'un clip à l'autre** (de 2,9 à 6,2 syllabes par seconde sur
   un même avatar, à cause des pauses). Le montage la ramène à un rythme unique, mais seulement
   dans une fourchette : un clip trop lent reste plus lent que les autres. Plus les rushs sont
   proches, moins il faut étirer.
6. **La voix change entre la partie 1 et la partie 2 d'un même avatar.** C'est ce qui s'entend le
   plus. Les prompts décrivent désormais la voix et le débit à l'identique dans les deux parties ;
   si Flow en change quand même, régénérer la partie 2.

Le montage est automatisé : voir `montage/README.md`.

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
