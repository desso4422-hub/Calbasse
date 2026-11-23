/**
 * Session de connexion anonyme Supabase : lecture des réponses du service d'authentification et décision
 * de renouveler le jeton. Fonctions pures, testées ; les appels réseau sont dans services/supabase.ts.
 *
 * Chaque installation de l'app a un compte anonyme (sans e-mail, ni téléphone, ni mot de passe). Le jeton
 * d'accès dure environ une heure ; un jeton de renouvellement permet d'en obtenir un nouveau.
 */
export type Session = {
  acces: string;
  refresh: string;
  /** Instant d'expiration du jeton d'accès, en secondes depuis 1970 */
  expire: number;
};

/** Lit la réponse de /auth/v1/signup ou /auth/v1/token. Renvoie null si elle est inutilisable. */
export function sessionDepuisReponse(j: unknown, maintenantMs: number): Session | null {
  if (!j || typeof j !== 'object') return null;
  const r = j as Record<string, unknown>;
  if (typeof r.access_token !== 'string' || !r.access_token || typeof r.refresh_token !== 'string' || !r.refresh_token) return null;
  const maintenant = Math.floor(maintenantMs / 1000);
  const expire = typeof r.expires_at === 'number' ? r.expires_at : typeof r.expires_in === 'number' ? maintenant + r.expires_in : maintenant + 3600;
  return { acces: r.access_token, refresh: r.refresh_token, expire };
}

/** true si le jeton expire dans moins de `margeS` secondes : on le renouvelle avant de l'utiliser. */
export function expireBientot(s: Session, maintenantMs: number, margeS = 90): boolean {
  return s.expire - margeS <= maintenantMs / 1000;
}

/** Relit la session gardée sur le téléphone ; tout ce qui n'est pas une session valide est ignoré. */
export function sessionStockee(brut: string | null): Session | null {
  if (!brut) return null;
  try {
    const s = JSON.parse(brut) as Partial<Session>;
    return typeof s.acces === 'string' && typeof s.refresh === 'string' && typeof s.expire === 'number' && s.acces && s.refresh ? (s as Session) : null;
  } catch {
    return null;
  }
}

/** Adresse de la fonction « api » pour un projet Supabase. */
export function adresseApi(urlProjet: string): string {
  return `${urlProjet.trim().replace(/\/+$/, '')}/functions/v1/api`;
}
