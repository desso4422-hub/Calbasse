// FICHIER GÉNÉRÉ : ne pas modifier ici.
// Source : src/lib/vision.ts. Pour le mettre à jour : npm run sync:supabase

/**
 * Le cerveau de la reconnaissance, partagé par l'app et le serveur :
 * consignes données au modèle, catalogue des aliments, format de réponse exigé,
 * vérification et nettoyage de ce que le modèle renvoie.
 *
 * Une seule source de vérité : le serveur (dossier server/) et l'app qui interroge
 * le modèle en direct (APK autonome) utilisent exactement le même texte et le même schéma.
 * Les calories ne viennent jamais du modèle : elles sont calculées depuis aliments.ts.
 */
import { aliments, categories } from './aliments.ts';
import { platsComposes, type Confiance } from './plats.ts';

export type { Confiance };

export const idsAliments = aliments.map((a) => a.id) as [string, ...string[]];

function nomCategorie(id: string): string {
  return categories.find((c) => c.id === id)?.nom ?? id;
}

/** Le texte stable (même ordre, pas de date) : le fournisseur peut le mettre en cache. */
export function texteCatalogue(): string {
  const parCategorie = new Map<string, string[]>();
  for (const a of aliments) {
    const lignes = parCategorie.get(a.categorie) ?? [];
    lignes.push(
      `- ${a.id} — ${a.nom}` +
        (a.synonymes.length ? ` (aussi : ${a.synonymes.join(', ')})` : '') +
        `\n  Aspect : ${a.description}` +
        `\n  Mesure habituelle : ${a.unite} ≈ ${a.uniteG} g${a.uniteNote ? ` ${a.uniteNote}` : ''}`,
    );
    parCategorie.set(a.categorie, lignes);
  }
  const sections = [...parCategorie.entries()].map(([cat, lignes]) => `### ${nomCategorie(cat)}\n${lignes.join('\n')}`);

  const plats = platsComposes
    .map((p) => `- ${p.nom} : ${p.lignes.map((l) => `${l.alimentId} ${l.grammes} g`).join(' + ')}`)
    .join('\n');

  return `## Aliments connus (choisis uniquement parmi ces identifiants)\n\n${sections.join('\n\n')}\n\n## Plats courants et grammages d'une portion moyenne\n\n${plats}`;
}

export const CONSIGNES = `Tu es le moteur de reconnaissance de Calbasse, une application de suivi nutritionnel pour l'Afrique de l'Ouest et du Centre. Tu connais très bien les plats du Bénin, du Togo, de Côte d'Ivoire, du Sénégal, du Ghana, du Nigeria, du Cameroun, du Burkina Faso, du Mali et des pays voisins, et tu reconnais aussi les aliments du monde entier : fruits et légumes, produits industriels, cuisine européenne, asiatique, américaine.

À partir de la photo d'un repas (et d'un indice facultatif écrit par l'utilisateur), identifie chaque composant visible et estime son poids.

## Identifier

1. Nomme d'abord, classe ensuite. Regarde la photo et dis ce que tu vois réellement, quel que soit le pays d'origine de l'aliment. C'est seulement ensuite que tu cherches l'identifiant correspondant dans la base. Couleur, texture et grain priment sur le nom : une pâte brun foncé n'est pas une pâte blanche, même si les deux s'appellent « pâte ». Les descriptions « Aspect » signalent les confusions fréquentes (attiéké / couscous / gari, akassa / pâte blanche / ablo, igname pilée / foufou / placali, sauce graine / sauce tomate / sauce arachide, riz au gras / thiéboudienne…).
2. INTERDIT : remplacer un aliment par un autre sous prétexte qu'il lui ressemble ou qu'il est dans la base. La base est courte et très incomplète : elle ne contient presque aucun aliment hors d'Afrique de l'Ouest — ni pomme, ni raisin, ni pizza, ni yaourt, ni fromage. C'est normal. Un aliment absent s'écrit « inconnu » avec sa description (« pomme », « part de pizza »), et jamais l'identifiant d'un sosie. Un faux aliment est une erreur bien plus grave qu'un aliment hors base : l'utilisateur voit un plat qu'il n'a pas mangé.
3. Avant de répondre, relis chaque ligne : si l'identifiant choisi ne décrit pas exactement ce que montre la photo, remplace-le par « inconnu » et décris l'aliment.
4. Chaque composant distinct (féculent, sauce, viande ou poisson, accompagnement, boisson) devient une ligne. Dans une sauce, distingue viande et poisson : la viande a des fibres, du gras, des os ou de la peau épaisse ; le poisson a des arêtes, une peau fine écaillée et une chair qui s'effeuille. Un poulet ou une viande cuits dans une sauce s'écrivent en deux lignes : la viande, puis la sauce.
5. Compte chaque sauce comme une ligne séparée du féculent qu'elle accompagne, même si elle est en partie cachée dessous.
6. L'indice de l'utilisateur est une information forte : il sait ce qu'il mange. Suis-le quand la photo ne le contredit pas nettement. S'il nomme un plat local, utilise ce nom. S'il contredit clairement la photo, suis la photo et baisse la confiance.

## Estimer le poids

7. Ne devine pas un poids d'un coup. Procède en trois temps.
   a) Trouve l'échelle. Cherche un objet de taille connue : assiette plate 24 à 26 cm, assiette creuse 22 cm, bol 15 cm, cuillère à soupe 8 cm de long, fourchette 19 cm, canette 12 cm de haut, main d'adulte 18 cm, pouce 6 cm. Si rien ne donne l'échelle, suppose une assiette plate courante et baisse nettement la confiance de la ligne : la photo seule ne dit pas si un aliment est petit et proche ou gros et loin.
   b) Juge le volume, pas la surface. Deux assiettes couvertes pareil peuvent peser du simple au double : ce qui compte est l'épaisseur du tas.
   c) Convertis le volume en grammes. Sauces et liquides ≈ 1 g pour 1 ml ; féculents cuits tassés (riz, pâte, couscous) ≈ 0,8 g/ml ; viande et poisson ≈ 1 g/ml ; salade et feuilles crues ≈ 0,2 g/ml ; aliments frits et aérés ≈ 0,5 g/ml.
8. Aliment rond et entier (fruit, tubercule, boule de pâte) : mesure son diamètre avec le repère d'échelle, puis lis ce tableau, valable pour tout ce qui est à peu près sphérique : 6 cm ≈ 100 g, 7 cm ≈ 150 g, 8 cm ≈ 220 g, 9 cm ≈ 300 g, 10 cm ≈ 400 g. Le poids suit le cube du diamètre : un fruit à peine plus large est beaucoup plus lourd.
9. Repères pour les aliments absents de la base. Ce sont des ordres de grandeur pour un spécimen MOYEN, pas des réponses à recopier : descends ou monte franchement dès que la photo montre un aliment petit ou gros. Pomme, orange : petite 100 g, moyenne 150 g, grosse 220 g. Banane épluchée : petite 80 g, moyenne 120 g, grosse 170 g. Œuf 55 g. Tranche de pain 30 g. Part de pizza 125 g. Pot de yaourt 125 g. Verre 250 ml. Bouteille individuelle 500 ml.
10. La mesure habituelle donnée dans la base est un repère, pas une réponse : estime ce qui est réellement dans l'assiette. Une louche de sauce pèse environ 80 g, une boule de pâte 150 à 250 g, une cuisse de poulet environ 140 g. Une portion dépasse rarement 2000 g.
11. Plat familial ou plateau partagé : estime la portion d'un adulte et dis-le dans la remarque.
12. Huile. Les plats frits et les sauces de la base incluent déjà leur huile de cuisson habituelle : ne la compte pas une deuxième fois. N'ajoute une ligne d'huile (huile_palme ou huile_vegetale) que pour un excès visible : flaque au fond de l'assiette, couche d'huile en surface d'une sauce, aliments luisants de gras.

## Répondre

13. Confiance : « haute » si tu es sûr, « moyenne » si un aliment proche est possible, « basse » si tu devines (photo floue, sauce qui cache tout, aucune échelle). Donne alors 1 à 3 alternatives plausibles. Mieux vaut une confiance honnête qu'une fausse certitude : l'utilisateur corrige en un geste.
14. Si la photo ne montre pas de nourriture, réponds estUnRepas = false et aucune ligne.
15. Le nom du plat : le nom courant (« Garba », « Thiéboudienne », « Riz au gras, poulet frit », « Pomme »). Les noms de plats locaux (attiéké, amiwo, gari, alloco) ne se traduisent pas.
16. La remarque est courte et en français ; laisse-la vide si tu n'as rien d'utile à dire.`;

/** Consignes + catalogue : identiques à chaque requête (cache de prompt chez le fournisseur). */
export function texteSysteme(): string {
  return `${CONSIGNES}\n\n${texteCatalogue()}`;
}

/** Texte de l'utilisateur envoyé avec la photo */
export function texteDemande(indice: string): string {
  const texteIndice = indice.trim() ? `Indice de l'utilisateur : « ${indice.trim().slice(0, 300)} »` : "Pas d'indice de l'utilisateur.";
  return `${texteIndice}\nIdentifie les composants de ce repas.`;
}

const CONFIANCES = ['haute', 'moyenne', 'basse'] as const;
const enumConfiance = { type: 'string', enum: [...CONFIANCES] };

/**
 * Format de réponse imposé au modèle (JSON Schema). Côté serveur, un test vérifie qu'il reste
 * identique au schéma Zod qui revalide ensuite la réponse.
 */
export const schemaJson = {
  type: 'object',
  properties: {
    estUnRepas: { type: 'boolean' },
    nomDuPlat: { type: 'string', description: "Nom courant du plat, tel qu'on le dit en Afrique de l'Ouest et du Centre" },
    confianceGlobale: enumConfiance,
    composants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          alimentId: { type: 'string', enum: [...idsAliments, 'inconnu'], description: "Identifiant de la base, ou 'inconnu' si l'aliment n'y est pas" },
          grammes: { type: 'number', description: "Poids estimé de ce qui est dans l'assiette, en grammes" },
          confiance: enumConfiance,
          alternatives: { type: 'array', items: { type: 'string', enum: [...idsAliments] }, description: "Jusqu'à 3 autres identifiants plausibles, du plus au moins probable" },
          description: { type: 'string', description: "Ce que tu vois, en quelques mots (obligatoire si 'inconnu')" },
        },
        required: ['alimentId', 'grammes', 'confiance', 'alternatives', 'description'],
        additionalProperties: false,
      },
    },
    remarque: { type: 'string', description: "Courte remarque utile à l'utilisateur, en français, ou chaîne vide" },
  },
  required: ['estUnRepas', 'nomDuPlat', 'confianceGlobale', 'composants', 'remarque'],
  additionalProperties: false,
} as const;

export type ComposantModele = {
  alimentId: string;
  grammes: number;
  confiance: Confiance;
  alternatives: string[];
  description: string;
};

export type ReponseModele = {
  estUnRepas: boolean;
  nomDuPlat: string;
  confianceGlobale: Confiance;
  composants: ComposantModele[];
  remarque: string;
};

export type LigneReconnue = {
  alimentId: string;
  grammes: number;
  confiance: Confiance;
  alternatives: string[];
};

export type ResultatScan = {
  estUnRepas: boolean;
  nom: string;
  confiance: Confiance;
  lignes: LigneReconnue[];
  inconnus: { description: string; grammes: number }[];
  remarque: string;
};

const connus = new Set<string>([...idsAliments, 'inconnu']);
const estConfiance = (v: unknown): v is Confiance => CONFIANCES.includes(v as Confiance);

/**
 * Vérifie la réponse du modèle sans rien inventer : un identifiant hors base ne doit jamais
 * passer, même si le fournisseur a ignoré le schéma. Renvoie null si la réponse est inutilisable.
 */
export function validerReponse(valeur: unknown): ReponseModele | null {
  if (typeof valeur !== 'object' || valeur === null) return null;
  const r = valeur as Record<string, unknown>;
  if (typeof r.estUnRepas !== 'boolean' || !Array.isArray(r.composants)) return null;
  const composants: ComposantModele[] = [];
  for (const c of r.composants) {
    if (typeof c !== 'object' || c === null) return null;
    const x = c as Record<string, unknown>;
    if (typeof x.alimentId !== 'string' || !connus.has(x.alimentId)) return null;
    if (typeof x.grammes !== 'number' || !Number.isFinite(x.grammes)) return null;
    if (!estConfiance(x.confiance)) return null;
    const alternatives = Array.isArray(x.alternatives) ? x.alternatives.filter((a): a is string => typeof a === 'string' && connus.has(a)) : [];
    composants.push({
      alimentId: x.alimentId,
      grammes: x.grammes,
      confiance: x.confiance,
      alternatives,
      description: typeof x.description === 'string' ? x.description : '',
    });
  }
  return {
    estUnRepas: r.estUnRepas,
    nomDuPlat: typeof r.nomDuPlat === 'string' ? r.nomDuPlat : '',
    confianceGlobale: estConfiance(r.confianceGlobale) ? r.confianceGlobale : 'moyenne',
    composants,
    remarque: typeof r.remarque === 'string' ? r.remarque : '',
  };
}

/** Extrait le JSON même si le modèle l'entoure de ```json … ``` */
export function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  } catch {
    return undefined;
  }
}

/** Nettoie la réponse : grammes plausibles, alternatives sans doublon, fusion des lignes répétées. */
export function normaliser(r: ReponseModele): ResultatScan {
  const lignes: LigneReconnue[] = [];
  const inconnus: ResultatScan['inconnus'] = [];
  for (const c of r.composants) {
    const grammes = Math.min(2000, Math.max(5, Math.round(c.grammes / 5) * 5));
    if (c.alimentId === 'inconnu') {
      inconnus.push({ description: c.description || 'Aliment non reconnu', grammes });
      continue;
    }
    const alternatives = [...new Set(c.alternatives)].filter((a) => a !== c.alimentId).slice(0, 3);
    const existante = lignes.find((l) => l.alimentId === c.alimentId);
    if (existante) {
      existante.grammes += grammes;
      continue;
    }
    lignes.push({ alimentId: c.alimentId, grammes, confiance: c.confiance, alternatives });
  }
  return {
    estUnRepas: r.estUnRepas && (lignes.length > 0 || inconnus.length > 0),
    nom: r.nomDuPlat.trim(),
    confiance: r.confianceGlobale,
    lignes,
    inconnus,
    remarque: r.remarque.trim(),
  };
}

export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
export type NiveauReflexion = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Corps de la requête RodiumAI (API compatible OpenAI), identique côté app et côté serveur.
 * `avecSchema` = false : on rappelle le format dans la demande, pour les passerelles qui
 * refusent response_format.json_schema.
 */
export function corpsRodium(p: {
  systeme: string;
  texte: string;
  image: string;
  typeImage: TypeImage;
  modele: string;
  reflexion?: NiveauReflexion;
  avecSchema: boolean;
}): Record<string, unknown> {
  const contenu: object[] = [
    { type: 'image_url', image_url: { url: `data:${p.typeImage};base64,${p.image}` } },
    { type: 'text', text: p.texte },
  ];
  if (!p.avecSchema) contenu.push({ type: 'text', text: `Réponds uniquement avec un objet JSON conforme à ce schéma :\n${JSON.stringify(schemaJson)}` });
  return {
    model: p.modele,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: p.systeme },
      { role: 'user', content: contenu },
    ],
    ...(p.reflexion ? { reasoning_effort: p.reflexion } : {}),
    response_format: p.avecSchema ? { type: 'json_schema', json_schema: { name: 'repas', schema: schemaJson } } : { type: 'json_object' },
  };
}
