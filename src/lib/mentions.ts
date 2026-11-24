/**
 * Politique de confidentialité et conditions d'utilisation de Calbasse.
 *
 * Source unique : l'écran de l'app (src/app/confidentialite.tsx) et le fichier à publier
 * (docs/confidentialite.md, produit par `npm run mentions`) viennent tous deux d'ici.
 *
 * ⚠️ Texte de départ, rédigé d'après ce que l'app fait réellement. À relire avant une diffusion large :
 * il ne remplace pas l'avis d'un juriste, notamment pour le droit applicable dans chaque pays.
 */

export const MISE_A_JOUR = '23 novembre 2026';

/**
 * Où te joindre : une adresse e-mail ou un numéro WhatsApp. Renseigné à la construction de l'app par
 * EXPO_PUBLIC_CONTACT (dans eas.json). Sans lui, un texte à compléter apparaît, et le garde-fou
 * `npm run verifier:production` refuse de construire une version à diffuser.
 */
export const CONTACT = process.env.EXPO_PUBLIC_CONTACT?.trim() || '[À COMPLÉTER : e-mail ou numéro WhatsApp de contact]';

/** Version de test sans contact public (EXPO_PUBLIC_CONTACT=aucun) : on renvoie vers la personne qui a donné l'app. */
export const SANS_CONTACT = CONTACT.toLowerCase() === 'aucun';

/** « écris-nous : … » ou, sans contact public, « écris à la personne qui t'a donné l'application » */
export const ECRIRE = SANS_CONTACT ? 'écris à la personne qui t’a donné l’application' : `écris-nous : ${CONTACT}`;

export type Section = { titre: string; paragraphes: string[] };

export const confidentialite: Section[] = [
  {
    titre: 'Qui est responsable',
    paragraphes: [
      `Calbasse est une application de suivi nutritionnel pour l’Afrique de l’Ouest et du Centre. Pour toute question sur tes données, ${ECRIRE}.`,
    ],
  },
  {
    titre: 'Ce que tu nous confies',
    paragraphes: [
      'Tes photos de plats. Quand tu scannes un plat, la photo est réduite puis envoyée à notre serveur, qui la transmet à un service d’analyse d’image (RodiumAI) fonctionnant avec un modèle d’intelligence artificielle de Google (Gemini). Calbasse ne conserve pas tes photos.',
      'Ton compte. Au premier lancement, l’app crée un compte anonyme : sans nom, sans e-mail, sans numéro de téléphone, seulement un identifiant aléatoire. Si tu choisis « Sauvegarder mon compte », tu y ajoutes ton adresse e-mail (confirmée par un code) : elle sert uniquement à te reconnaître et à t’envoyer ce code.',
      'Tes scans. Pour chaque analyse, nous gardons la date, les aliments reconnus avec leurs quantités et la durée de l’analyse. Cela sert à compter tes scans du jour.',
      'Tes corrections et signalements. Quand tu changes un aliment proposé, ou que tu signales un chiffre qui te semble faux, nous gardons ce que tu as changé pour améliorer la reconnaissance et corriger la base nutritionnelle.',
    ],
  },
  {
    titre: 'Ce qui reste sur ton téléphone',
    paragraphes: [
      'Tant que tu ne sauvegardes pas ton compte, ton prénom, ton âge, ton poids, ta taille, ton objectif, tes repas et ton historique restent sur ton téléphone : ils ne sont pas envoyés à nos serveurs, et si tu perds ton téléphone, ils sont perdus.',
      'Si tu sauvegardes ton compte avec ton e-mail, ces informations (profil et repas, sans les photos) sont aussi copiées sur nos serveurs, pour que tu les retrouves sur un nouveau téléphone. Ce sont des informations liées à ta santé : elles ne sont utilisées que pour te les rendre, jamais pour te cibler ni être revendues. Tu peux te déconnecter ou tout supprimer à tout moment.',
    ],
  },
  {
    titre: 'À quoi ça sert',
    paragraphes: [
      'Analyser tes plats, limiter le nombre de scans par jour et empêcher les abus, et améliorer la reconnaissance des plats africains. Pas de publicité, pas de vente de données.',
    ],
  },
  {
    titre: 'Qui reçoit des données',
    paragraphes: [
      'Nos prestataires techniques : Supabase (hébergement de la base de données et du serveur), RodiumAI et Google (analyse de la photo). Chacun traite les données selon ses propres conditions. Nous ne partageons rien avec personne d’autre.',
    ],
  },
  {
    titre: 'Combien de temps',
    paragraphes: ['Tes scans, corrections, signalements et ta sauvegarde en ligne sont gardés tant que ton compte existe. Quand tu supprimes ton compte, ils sont effacés avec lui.'],
  },
  {
    titre: 'Tes droits',
    paragraphes: [
      `Tu peux tout supprimer à tout moment : Profil, puis « Effacer mes données ». Cela supprime ton compte en ligne, ta sauvegarde et les données de ton téléphone. Pour toute autre demande (accès, correction), ${ECRIRE}.`,
    ],
  },
  {
    titre: 'Sécurité',
    paragraphes: ['Les échanges entre l’app et le serveur sont chiffrés. Les tables de données sont fermées : seul notre serveur y accède. La connexion se fait par un code envoyé à ton e-mail : il n’y a pas de mot de passe à voler.'],
  },
  {
    titre: 'Enfants',
    paragraphes: ['Calbasse n’est pas destiné aux moins de 16 ans sans l’accord d’un parent.'],
  },
  {
    titre: 'Changements',
    paragraphes: [`Si cette politique change, nous te le dirons dans l’app. Dernière mise à jour : ${MISE_A_JOUR}.`],
  },
];

export const conditions: Section[] = [
  {
    titre: 'Ce que fait Calbasse',
    paragraphes: ['Calbasse estime les calories, les protéines, les glucides et les lipides d’un plat à partir d’une photo, pour t’aider à suivre ton alimentation.'],
  },
  {
    titre: 'Ce sont des estimations',
    paragraphes: [
      'Les valeurs sont estimées d’après une photo et une base de valeurs nutritionnelles en cours de validation par un nutritionniste. Elles peuvent être inexactes. Vérifie toujours la proposition et corrige-la si besoin.',
    ],
  },
  {
    titre: 'Santé',
    paragraphes: [
      'Calbasse ne remplace pas un médecin ou un nutritionniste. Si tu es enceinte, malade, ou suivi(e) pour ton poids ou une maladie, demande conseil à un professionnel avant de changer ton alimentation.',
    ],
  },
  {
    titre: 'Limites d’usage',
    paragraphes: ['Le nombre de scans gratuits est limité chaque jour. Pour protéger le service, nous pouvons limiter ou suspendre l’accès en cas d’abus.'],
  },
  {
    titre: 'Disponibilité',
    paragraphes: ['Calbasse est en phase de test : le service peut être interrompu ou modifié sans préavis.'],
  },
  {
    titre: 'Responsabilité',
    paragraphes: ['Dans les limites permises par la loi, Calbasse n’est pas responsable des décisions prises à partir des estimations affichées.'],
  },
];

/** Le même texte en Markdown, pour la page à publier (Play Store, site, WhatsApp). */
export function enMarkdown(): string {
  const bloc = (s: Section) => `## ${s.titre}\n\n${s.paragraphes.join('\n\n')}`;
  return [
    '# Calbasse : confidentialité et conditions d’utilisation',
    `*Dernière mise à jour : ${MISE_A_JOUR}*`,
    '# Politique de confidentialité',
    confidentialite.map(bloc).join('\n\n'),
    '# Conditions d’utilisation',
    conditions.map(bloc).join('\n\n'),
  ].join('\n\n') + '\n';
}
