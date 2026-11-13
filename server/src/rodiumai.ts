/**
 * Vision via RodiumAI, passerelle d'accès aux modèles (dont Gemini) payable depuis l'Afrique.
 *
 * API compatible OpenAI : POST {base}/chat/completions, clé « rd_sk_… » en Authorization: Bearer,
 * photo en data URL, réponse JSON demandée par response_format (json_schema, puis json_object
 * si la passerelle ne prend pas le schéma). Documentation : https://www.rodiumai.io/docs
 */
import type { ClientHttp } from './cinetpay.ts';
import { schemaJson, ErreurFournisseur, type Fournisseur } from './reconnaissance.ts';

export type ConfigRodium = {
  cleApi: string;
  /** https://api.rodiumai.io/v1 */
  urlApi: string;
};

type ReponseChat = {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  usage?: unknown;
  cost_rodi?: number;
  error?: { message?: string; code?: string } | string;
  error_code?: string;
  message?: string;
};

const efforts = { minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' } as const;

export function fournisseurRodium(config: ConfigRodium, http: ClientHttp = fetch): Fournisseur {
  // Mémorise si la passerelle refuse json_schema, pour ne pas payer un échec à chaque scan
  let schemaAccepte = true;

  async function appeler(corps: object): Promise<{ statut: number; donnees: ReponseChat }> {
    let reponse: Response;
    try {
      reponse = await http(`${config.urlApi}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.cleApi}` },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new ErreurFournisseur(`RodiumAI injoignable : ${e instanceof Error ? e.message : e}`, 503, 'network_error');
    }
    const donnees = (await reponse.json().catch(() => ({}))) as ReponseChat;
    return { statut: reponse.status, donnees };
  }

  return {
    nom: 'rodiumai',
    async generer({ systeme, image, typeImage, texte, options }) {
      const base = {
        model: options.modele,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systeme },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${typeImage};base64,${image}` } },
              { type: 'text', text: texte },
            ],
          },
        ],
        ...(options.reflexion ? { reasoning_effort: efforts[options.reflexion] } : {}),
      };
      const avecSchema = { ...base, response_format: { type: 'json_schema', json_schema: { name: 'repas', schema: schemaJson } } };
      // Sans schéma : on rappelle le format attendu dans la demande
      const sansSchema = {
        ...base,
        response_format: { type: 'json_object' },
        messages: [
          base.messages[0],
          {
            ...base.messages[1],
            content: [...(base.messages[1].content as object[]), { type: 'text', text: `Réponds uniquement avec un objet JSON conforme à ce schéma :\n${JSON.stringify(schemaJson)}` }],
          },
        ],
      };

      let { statut, donnees } = await appeler(schemaAccepte ? avecSchema : sansSchema);
      if (statut === 400 && schemaAccepte) {
        schemaAccepte = false;
        ({ statut, donnees } = await appeler(sansSchema));
      }
      if (statut < 200 || statut >= 300) {
        const err = typeof donnees.error === 'object' ? donnees.error : undefined;
        const code = err?.code ?? donnees.error_code;
        const message = err?.message ?? (typeof donnees.error === 'string' ? donnees.error : donnees.message) ?? `HTTP ${statut}`;
        throw new ErreurFournisseur(`RodiumAI ${statut}${code ? ` (${code})` : ''} : ${message}`, statut, code);
      }
      const choix = donnees.choices?.[0];
      const fin = choix?.finish_reason ?? 'inconnue';
      return {
        texte: choix?.message?.content ?? null,
        refus: fin === 'content_filter' || !!choix?.message?.refusal,
        fin,
        usage: { ...(typeof donnees.usage === 'object' ? donnees.usage : {}), cost_rodi: donnees.cost_rodi },
      };
    },
  };
}
