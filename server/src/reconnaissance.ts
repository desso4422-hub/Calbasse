/**
 * Reconnaissance d'une assiette avec Gemini (Google).
 *
 * Choix qui servent la précision :
 * - le modèle ne peut répondre qu'avec des identifiants de la base (sortie JSON contrainte + enum),
 *   et la réponse est revalidée ici avant d'être utilisée ;
 * - chaque aliment arrive avec une description visuelle et les confusions fréquentes ;
 * - l'indice tapé par l'utilisateur est une information forte ;
 * - pour chaque aliment, le modèle donne sa confiance et des alternatives, que l'app propose en un geste.
 * Les calories ne viennent jamais du modèle : l'app les calcule à partir de la base.
 */
import { ApiError, FinishReason, ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { z } from 'zod';
import { idsAliments, texteCatalogue } from './catalogue.ts';

const Confiance = z.enum(['haute', 'moyenne', 'basse']);

const Composant = z.object({
  alimentId: z.enum([...idsAliments, 'inconnu']).describe("Identifiant de la base, ou 'inconnu' si l'aliment n'y est pas"),
  grammes: z.number().describe("Poids estimé de ce qui est dans l'assiette, en grammes"),
  confiance: Confiance,
  alternatives: z.array(z.enum(idsAliments)).describe("Jusqu'à 3 autres identifiants plausibles, du plus au moins probable"),
  description: z.string().describe("Ce que tu vois, en quelques mots (obligatoire si 'inconnu')"),
});

export const SchemaReponse = z.object({
  estUnRepas: z.boolean(),
  nomDuPlat: z.string().describe("Nom courant du plat, tel qu'on le dit en Afrique de l'Ouest et du Centre"),
  confianceGlobale: Confiance,
  composants: z.array(Composant),
  remarque: z.string().describe("Courte remarque utile à l'utilisateur, en français, ou chaîne vide"),
});

export type ReponseModele = z.infer<typeof SchemaReponse>;

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

export type NiveauReflexion = 'minimal' | 'low' | 'medium' | 'high';

export type OptionsAnalyse = {
  modele: string;
  /** Niveau de réflexion du modèle. Absent : la valeur par défaut du modèle. */
  reflexion?: NiveauReflexion;
};

export type LigneReconnue = {
  alimentId: string;
  grammes: number;
  confiance: 'haute' | 'moyenne' | 'basse';
  alternatives: string[];
};

export type ResultatScan = {
  estUnRepas: boolean;
  nom: string;
  confiance: 'haute' | 'moyenne' | 'basse';
  lignes: LigneReconnue[];
  inconnus: { description: string; grammes: number }[];
  remarque: string;
};

export class RefusModele extends Error {}
export class ReponseIllisible extends Error {}

/** Erreur du service de vision (clé invalide, crédit épuisé, surcharge…), avec son statut HTTP. */
export class ErreurFournisseur extends Error {
  readonly statut: number;
  readonly code?: string;
  constructor(message: string, statut: number, code?: string) {
    super(message);
    this.statut = statut;
    this.code = code;
  }
}

/**
 * Un service capable de regarder la photo et de répondre en JSON : Gemini en direct, ou une
 * passerelle comme RodiumAI. Les consignes, le catalogue et la validation restent les mêmes.
 */
export type Fournisseur = {
  nom: string;
  generer(p: { systeme: string; image: string; typeImage: TypeImage; texte: string; options: OptionsAnalyse }): Promise<{
    texte: string | null;
    refus: boolean;
    fin: string;
    usage: unknown;
  }>;
};

/** Les types d'image acceptés. */
export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Seule partie du client dont on a besoin : facilite les tests avec un faux client. */
export type ClientVision = { models: { generateContent: (p: GenerateContentParameters) => Promise<GenerateContentResponse> } };

const niveaux: Record<NiveauReflexion, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Schéma JSON envoyé à Gemini (calculé une fois : identique à chaque requête). */
export const schemaJson = (() => {
  const { $schema: _, ...schema } = z.toJSONSchema(SchemaReponse);
  return schema;
})();

/** Requête Gemini. `texte` : la demande de l'utilisateur (voir texteDemande). */
export function construireRequete(image: string, typeImage: TypeImage, texte: string, options: OptionsAnalyse): GenerateContentParameters {
  return {
    model: options.modele,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: typeImage, data: image } },
          { text: texte },
        ],
      },
    ],
    config: {
      // Consignes + catalogue en premier et identiques à chaque requête : Gemini peut les mettre
      // en cache automatiquement (cache implicite), ce qui réduit le coût.
      systemInstruction: texteSysteme(),
      responseMimeType: 'application/json',
      responseJsonSchema: schemaJson,
      maxOutputTokens: 8192,
      ...(options.reflexion ? { thinkingConfig: { thinkingLevel: niveaux[options.reflexion] } } : {}),
    },
  };
}

/** Texte de l'utilisateur envoyé avec la photo */
export function texteDemande(indice: string): string {
  const texteIndice = indice.trim() ? `Indice de l'utilisateur : « ${indice.trim().slice(0, 300)} »` : "Pas d'indice de l'utilisateur.";
  return `${texteIndice}\nIdentifie les composants de ce repas.`;
}

/** Consignes + catalogue : identiques à chaque requête (cache de prompt chez le fournisseur). */
export function texteSysteme(): string {
  return `${CONSIGNES}\n\n${texteCatalogue()}`;
}

/** Gemini en direct (SDK Google). */
export function fournisseurGemini(client: ClientVision): Fournisseur {
  return {
    nom: 'gemini',
    async generer({ image, typeImage, texte, options }) {
      let reponse: GenerateContentResponse;
      try {
        reponse = await client.models.generateContent(construireRequete(image, typeImage, texte, options));
      } catch (e) {
        if (e instanceof ApiError) throw new ErreurFournisseur(e.message, e.status);
        throw e;
      }
      const fin = reponse.candidates?.[0]?.finishReason;
      const refus = !!reponse.promptFeedback?.blockReason || fin === FinishReason.SAFETY || fin === FinishReason.PROHIBITED_CONTENT;
      return { texte: reponse.text ?? null, refus, fin: String(fin ?? 'inconnue'), usage: reponse.usageMetadata };
    },
  };
}

export async function analyserRepas(
  fournisseur: Fournisseur,
  image: string,
  typeImage: TypeImage,
  indice: string,
  options: OptionsAnalyse,
): Promise<{ resultat: ResultatScan; brut: ReponseModele; usage: unknown }> {
  const r = await fournisseur.generer({ systeme: texteSysteme(), image, typeImage, texte: texteDemande(indice), options });
  if (r.refus) throw new RefusModele('Le modèle a décliné cette image');
  if (!r.texte) throw new ReponseIllisible(`Réponse vide (fin : ${r.fin})`);
  let json: unknown;
  try {
    // Certains modèles entourent le JSON de ```json … ``` : on l'extrait
    json = JSON.parse(r.texte.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  } catch {
    throw new ReponseIllisible(`Réponse non exploitable (fin : ${r.fin})`);
  }
  // Le modèle suit le schéma, mais on revalide : un identifiant hors base ne doit jamais passer.
  const brut = SchemaReponse.safeParse(json);
  if (!brut.success) throw new ReponseIllisible('Réponse non conforme au schéma');
  return { resultat: normaliser(brut.data), brut: brut.data, usage: r.usage };
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
