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

export type Section = { titre: string; paragraphes: string[] };

export const confidentialite: Section[] = [
  {
    titre: 'Qui est responsable',
    paragraphes: [
      `Calbasse est une application de suivi nutritionnel pour l’Afrique de l’Ouest et du Centre. Pour toute question sur tes données : ${CONTACT}.`,
    ],
  },
  {
    titre: 'Ce que tu nous confies',
    paragraphes: [
      'Tes photos de plats. Quand tu scannes un plat, la photo est réduite puis envoyée à notre serveur, qui la transmet à un service d’analyse d’image (RodiumAI) fonctionnant avec un modèle d’intelligence artificielle de Google (Gemini). Calbasse ne conserve pas tes photos.',
      'Ton compte anonyme. Au premier lancement, l’app crée un compte sans nom, sans e-mail et sans numéro de téléphone : seulement un identifiant aléatoire.',
      'Tes scans. Pour chaque analyse, nous gardons la date, les aliments reconnus avec leurs quantités et la durée de l’analyse. Cela sert à compter tes scans du jour.',
      'Tes corrections et signalements. Quand tu changes un aliment proposé, ou que tu signales un chiffre qui te semble faux, nous gardons ce que tu as changé pour améliorer la reconnaissance et corriger la base nutritionnelle.',
    ],
  },
  {
    titre: 'Ce qui reste sur ton téléphone',
    paragraphes: ['Ton prénom, ton âge, ton poids, ta taille, ton objectif, tes repas et ton historique restent sur ton téléphone. Ils ne sont pas envoyés à nos serveurs.'],
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
    paragraphes: ['Tes scans, corrections et signalements sont gardés tant que ton compte existe. Quand tu supprimes ton compte, ils sont effacés avec lui.'],
  },
  {
    titre: 'Tes droits',
    paragraphes: [
      `Tu peux tout supprimer à tout moment : Profil, puis « Effacer mes données ». Cela supprime ton compte en ligne et les données de ton téléphone. Pour toute autre demande (accès, correction), écris-nous : ${CONTACT}.`,
    ],
  },
  {
    titre: 'Sécurité',
    paragraphes: ['Les échanges entre l’app et le serveur sont chiffrés. Les tables de données sont fermées : seul notre serveur y accède.'],
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
