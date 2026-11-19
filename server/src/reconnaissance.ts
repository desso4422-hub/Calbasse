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
import { idsAliments } from './catalogue.ts';
import { CONSIGNES, lireJson, normaliser, schemaJson, texteDemande, texteSysteme, validerReponse, type ReponseModele, type ResultatScan, type TypeImage } from '../../src/lib/vision.ts';

export { CONSIGNES, normaliser, schemaJson, texteDemande, texteSysteme };
export type { LigneReconnue, ReponseModele, ResultatScan, TypeImage } from '../../src/lib/vision.ts';


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


export type NiveauReflexion = 'minimal' | 'low' | 'medium' | 'high';

export type OptionsAnalyse = {
  modele: string;
  /** Niveau de réflexion du modèle. Absent : la valeur par défaut du modèle. */
  reflexion?: NiveauReflexion;
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

/** Seule partie du client dont on a besoin : facilite les tests avec un faux client. */
export type ClientVision = { models: { generateContent: (p: GenerateContentParameters) => Promise<GenerateContentResponse> } };

const niveaux: Record<NiveauReflexion, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

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
  // Certains modèles entourent le JSON de ```json … ``` : lireJson l'extrait
  const json = lireJson(r.texte);
  if (json === undefined) throw new ReponseIllisible(`Réponse non exploitable (fin : ${r.fin})`);
  // Le modèle suit le schéma, mais on revalide : un identifiant hors base ne doit jamais passer.
  const brut = SchemaReponse.safeParse(json);
  if (!brut.success) throw new ReponseIllisible('Réponse non conforme au schéma');
  const verifie = validerReponse(brut.data) as ReponseModele;
  return { resultat: normaliser(verifie), brut: verifie, usage: r.usage };
}
