/**
 * Appel à RodiumAI (passerelle vers Gemini) depuis la fonction serveur.
 *
 * La clé vit dans les secrets Supabase : elle n'est jamais envoyée à l'app. Les consignes, le catalogue
 * et la vérification de la réponse sont les mêmes que dans l'app (_shared/vision.ts) : un aliment
 * inventé par le modèle ne peut jamais passer.
 */
import {
  corpsRodium,
  lireJson,
  normaliser,
  texteDemande,
  texteSysteme,
  validerReponse,
  type NiveauReflexion,
  type ResultatScan,
  type TypeImage,
} from '../_shared/vision.ts';

export class ErreurVision extends Error {
  readonly statut: number;
  readonly code?: string;
  constructor(message: string, statut: number, code?: string) {
    super(message);
    this.statut = statut;
    this.code = code;
  }
}
/** Le modèle a refusé d'analyser la photo. */
export class RefusModele extends Error {}
/** La réponse du modèle est inutilisable. */
export class ReponseIllisible extends Error {}

export type ConfigVision = {
  cleApi: string;
  urlApi: string;
  modele: string;
  reflexion?: NiveauReflexion;
  delaiMs?: number;
};

export type Analyse = { resultat: ResultatScan; usage: unknown; modele: string };
export type Vision = (image: string, typeImage: TypeImage, indice: string) => Promise<Analyse>;

type ReponseChat = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: unknown;
  cost_rodi?: number;
  error?: { message?: string; code?: string } | string;
  error_code?: string;
  message?: string;
};

// Calculé une fois : identique à chaque requête, ce qui permet au fournisseur de le mettre en cache
const systeme = texteSysteme();

// La passerelle accepte-t-elle le format JSON strict ? On retient la réponse pour ne pas payer l'essai à chaque scan.
let schemaAccepte = true;

export function creerVision(cfg: ConfigVision, http: typeof fetch = fetch): Vision {
  async function appeler(corps: object): Promise<{ statut: number; donnees: ReponseChat }> {
    let reponse: Response;
    try {
      reponse = await http(`${cfg.urlApi.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.cleApi}` },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(cfg.delaiMs ?? 60_000),
      });
    } catch (e) {
      throw new ErreurVision(`RodiumAI injoignable : ${e instanceof Error ? e.message : e}`, 503, 'reseau');
    }
    const donnees = (await reponse.json().catch(() => ({}))) as ReponseChat;
    return { statut: reponse.status, donnees };
  }

  return async (image, typeImage, indice) => {
    const requete = (avecSchema: boolean) =>
      corpsRodium({ systeme, texte: texteDemande(indice), image, typeImage, modele: cfg.modele, reflexion: cfg.reflexion, avecSchema });

    let { statut, donnees } = await appeler(requete(schemaAccepte));
    if (statut === 400 && schemaAccepte) {
      schemaAccepte = false;
      ({ statut, donnees } = await appeler(requete(false)));
    }
    if (statut < 200 || statut >= 300) {
      const err = typeof donnees.error === 'object' ? donnees.error : undefined;
      const code = err?.code ?? donnees.error_code;
      const message = err?.message ?? (typeof donnees.error === 'string' ? donnees.error : donnees.message) ?? `HTTP ${statut}`;
      throw new ErreurVision(`RodiumAI ${statut}${code ? ` (${code})` : ''} : ${message}`, statut, code);
    }
    const choix = donnees.choices?.[0];
    if (choix?.finish_reason === 'content_filter' || choix?.message?.refusal) throw new RefusModele('Le modèle a décliné cette image');
    const texte = choix?.message?.content;
    if (!texte) throw new ReponseIllisible(`Réponse vide (fin : ${choix?.finish_reason ?? 'inconnue'})`);
    const json = lireJson(texte);
    if (json === undefined) throw new ReponseIllisible('Réponse non exploitable');
    const brut = validerReponse(json);
    if (!brut) throw new ReponseIllisible('Réponse non conforme');
    return {
      resultat: normaliser(brut),
      usage: { ...(typeof donnees.usage === 'object' ? donnees.usage : {}), cost_rodi: donnees.cost_rodi },
      modele: cfg.modele,
    };
  };
}
