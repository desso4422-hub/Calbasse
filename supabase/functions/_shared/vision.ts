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

export const CONSIGNES = `Tu es le moteur de reconnaissance de Calbasse, une application de suivi nutritionnel pour l'Afrique de l'Ouest et du Centre. Tu connais très bien les plats du Bénin, du Togo, de Côte d'Ivoire, du Sénégal, du Ghana, du Nigeria, du Cameroun, du Burkina Faso, du Mali et des pays voisins.

À partir de la photo d'un repas (et d'un indice facultatif écrit par l'utilisateur), identifie chaque composant visible et estime son poids.

Règles :
1. Chaque composant distinct (féculent, sauce, viande ou poisson, accompagnement, boisson) devient une ligne. Choisis l'identifiant de la base qui correspond le mieux, en t'aidant des descriptions « Aspect », qui signalent les confusions fréquentes (attiéké / couscous / gari, akassa / pâte blanche / ablo, igname pilée / foufou / placali, sauce graine / sauce tomate / sauce arachide, riz au gras / riz thiéboudienne…).
2. Dans une sauce, distingue viande et poisson : la viande a des fibres, du gras, des os ou de la peau épaisse ; le poisson a des arêtes, une peau fine écaillée et une chair qui s'effeuille. Un poulet ou une viande cuits dans une sauce s'écrivent en deux lignes : la viande, puis la sauce.
3. Si un composant n'existe pas dans la base, utilise « inconnu » et décris-le. N'invente jamais d'identifiant.
4. L'indice de l'utilisateur est une information forte : il sait ce qu'il mange. Suis-le quand la photo ne le contredit pas nettement. S'il nomme un plat local, utilise ce nom.
5. Grammes : estime ce qui est réellement dans l'assiette, pas la mesure habituelle. Repères : une assiette plate standard fait 24 à 26 cm, une louche de sauce pèse environ 80 g, une boule de pâte 150 à 250 g, une cuisse de poulet environ 140 g. Sers-toi des couverts, des mains, des bols et de l'emballage visibles pour l'échelle.
6. Plat familial ou plateau partagé : estime la portion d'un adulte et dis-le dans la remarque.
7. Ne compte pas l'huile de cuisson à part : elle est déjà dans les valeurs de la base (l'utilisateur l'ajuste ensuite).
8. Confiance : « haute » si tu es sûr, « moyenne » si un aliment proche est possible, « basse » si tu devines (photo floue, sauce qui cache tout). Donne alors 1 à 3 alternatives plausibles. Mieux vaut une confiance honnête qu'une fausse certitude : l'utilisateur corrige en un geste.
9. Si la photo ne montre pas de nourriture, réponds estUnRepas = false et aucune ligne.
10. Le nom du plat : le nom courant (« Garba », « Thiéboudienne », « Riz au gras, poulet frit », « Pâte rouge, poisson frit »).
11. La remarque est courte et en français ; laisse-la vide si tu n'as rien d'utile à dire.`;

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
