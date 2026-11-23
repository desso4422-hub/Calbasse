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

export type CodeErreurAuth = 'email_existe' | 'email_invalide' | 'code_invalide' | 'trop_demandes' | 'compte_inconnu' | 'reseau' | 'autre';

/** Traduit une erreur du service d'authentification de Supabase en un message clair pour l'utilisateur. */
export function erreurAuth(statut: number, donnees: unknown): { code: CodeErreurAuth; message: string } {
  const d = (donnees && typeof donnees === 'object' ? donnees : {}) as Record<string, unknown>;
  const code = String(d.error_code ?? d.code ?? '');
  const texte = String(d.msg ?? d.message ?? d.error_description ?? '').toLowerCase();
  if (statut === 0) return { code: 'reseau', message: 'Pas de connexion. Réessaie quand le réseau revient.' };
  if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists' || /already (been )?registered|already exists/.test(texte)) {
    return { code: 'email_existe', message: 'Cet e-mail a déjà un compte Calbasse. Utilise « J’ai déjà un compte » pour t’y connecter.' };
  }
  if (code === 'otp_expired' || code === 'invalid_otp' || (/expired|invalid/.test(texte) && /token|otp|code/.test(texte))) {
    return { code: 'code_invalide', message: 'Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.' };
  }
  if (statut === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|too many/.test(texte)) {
    return { code: 'trop_demandes', message: 'Trop de demandes. Attends une minute puis réessaie.' };
  }
  if (code === 'otp_disabled' || code === 'user_not_found' || /signups? not allowed|not found/.test(texte)) {
    return { code: 'compte_inconnu', message: 'Aucun compte Calbasse avec cet e-mail. Vérifie l’adresse.' };
  }
  if (code === 'email_address_invalid' || code === 'validation_failed' || /invalid.*email|email.*invalid/.test(texte)) {
    return { code: 'email_invalide', message: 'Cette adresse e-mail ne semble pas valide.' };
  }
  return { code: 'autre', message: 'L’opération a échoué. Réessaie dans un moment.' };
}
