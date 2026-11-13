/**
 * Choix du service de vision et du modèle, à partir des variables d'environnement.
 *
 *   RODIUMAI_API_KEY=rd_sk_…   → RodiumAI (passerelle, payable depuis l'Afrique)
 *   GEMINI_API_KEY=AIza…       → Gemini en direct (Google AI Studio)
 *
 * Si les deux sont définies, RodiumAI est utilisé (ou FOURNISSEUR_VISION=gemini pour forcer Gemini).
 */
import { GoogleGenAI } from '@google/genai';
import { fournisseurGemini, type Fournisseur, type NiveauReflexion, type OptionsAnalyse } from './reconnaissance.ts';
import { fournisseurRodium } from './rodiumai.ts';

export const MODELE_GEMINI = 'gemini-3.8-flash';
export const MODELE_RODIUMAI = 'google/gemini-3.1-flash-lite';
/** Rétrocompatibilité des tests et scripts */
export const MODELE_PAR_DEFAUT = MODELE_GEMINI;

const niveaux: NiveauReflexion[] = ['minimal', 'low', 'medium', 'high'];

type Env = Record<string, string | undefined>;

export function nomFournisseur(env: Env = process.env): 'rodiumai' | 'gemini' | null {
  if (env.FOURNISSEUR_VISION === 'gemini' && env.GEMINI_API_KEY) return 'gemini';
  if (env.RODIUMAI_API_KEY) return 'rodiumai';
  if (env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function optionsDepuisEnv(env: Env = process.env): OptionsAnalyse {
  const r = (env.REFLEXION ?? env.GEMINI_REFLEXION)?.toLowerCase();
  const rodium = nomFournisseur(env) === 'rodiumai';
  return {
    modele: (rodium ? env.RODIUMAI_MODELE : env.GEMINI_MODELE) || (rodium ? MODELE_RODIUMAI : MODELE_GEMINI),
    reflexion: niveaux.includes(r as NiveauReflexion) ? (r as NiveauReflexion) : undefined,
  };
}

export function fournisseurDepuisEnv(env: Env = process.env): Fournisseur | null {
  switch (nomFournisseur(env)) {
    case 'rodiumai':
      return fournisseurRodium({
        cleApi: env.RODIUMAI_API_KEY!,
        urlApi: (env.RODIUMAI_BASE_URL ?? 'https://api.rodiumai.io/v1').replace(/\/+$/, ''),
      });
    case 'gemini':
      return fournisseurGemini(
        new GoogleGenAI({ apiKey: env.GEMINI_API_KEY!, ...(env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: env.GEMINI_BASE_URL } } : {}) }),
      );
    default:
      return null;
  }
}
