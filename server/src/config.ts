import type { NiveauReflexion, OptionsAnalyse } from './reconnaissance.ts';

/** Modèle par défaut : Gemini Flash, bon rapport précision / prix pour la vision. */
export const MODELE_PAR_DEFAUT = 'gemini-3.8-flash';

const niveaux: NiveauReflexion[] = ['minimal', 'low', 'medium', 'high'];

export function optionsDepuisEnv(env: Record<string, string | undefined> = process.env): OptionsAnalyse {
  const r = env.GEMINI_REFLEXION?.toLowerCase();
  return {
    modele: env.GEMINI_MODELE || MODELE_PAR_DEFAUT,
    reflexion: niveaux.includes(r as NiveauReflexion) ? (r as NiveauReflexion) : undefined,
  };
}
