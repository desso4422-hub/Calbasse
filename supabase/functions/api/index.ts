/**
 * Fonction « api » de Calbasse : le seul point d'entrée de l'app vers le serveur.
 *
 * Elle branche la logique de core.ts sur la vraie base de données Supabase et sur RodiumAI.
 *
 * Secrets à définir dans Supabase (Edge Functions → Secrets) :
 *   RODIUMAI_API_KEY   ta clé RodiumAI (rd_sk_…)                          obligatoire
 *   SCANS_GRATUITS     scans par jour et par personne, forfait gratuit    1 par défaut
 *   SCANS_PREMIUM      scans par jour et par personne, forfait payant     10 par défaut
 *   BUDGET_JOUR        scans par jour pour tout le monde (plafond)       300 par défaut
 *   PRIX_MENSUEL       prix du forfait de 30 jours, en FCFA               2000 par défaut
 *   PRIX_ANNUEL        prix du forfait de 365 jours, en FCFA              20000 par défaut
 *   RODIUMAI_MODELE    modèle de vision                                  google/gemini-3.1-flash-lite
 *   CINETPAY_API_KEY, CINETPAY_SITE_ID   paiement en ligne (facultatif ; sans eux, seuls les codes d'activation marchent)
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { creerGestionnaire, type Depots, type Paiement, type Premium, type Reservation } from './core.ts';
import { creerVision } from './rodium.ts';

const env = (nom: string) => Deno.env.get(nom) ?? undefined;
const entier = (nom: string, defaut: number) => {
  const n = Number(env(nom));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaut;
};

const cleApi = env('RODIUMAI_API_KEY');
if (!cleApi) console.error('RODIUMAI_API_KEY manquante : les scans échoueront. Ajoute-la dans les secrets de la fonction.');

const supabase = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const urlPublique = `${env('SUPABASE_URL')}/functions/v1/api`;
const config = {
  modele: env('RODIUMAI_MODELE') ?? 'google/gemini-3.1-flash-lite',
  gratuit: entier('SCANS_GRATUITS', 1),
  premium: entier('SCANS_PREMIUM', 10),
  budget: entier('BUDGET_JOUR', 300),
  parMinute: entier('SCANS_PAR_MINUTE', 6),
  tarifs: {
    mensuel: { montant: entier('PRIX_MENSUEL', 2000), jours: 30 },
    annuel: { montant: entier('PRIX_ANNUEL', 20000), jours: 365 },
  },
  cinetpay:
    env('CINETPAY_API_KEY') && env('CINETPAY_SITE_ID')
      ? { apiKey: env('CINETPAY_API_KEY')!, siteId: env('CINETPAY_SITE_ID')!, urlApi: (env('CINETPAY_URL_API') ?? 'https://api-checkout.cinetpay.com/v2').replace(/\/+$/, ''), urlPublique }
      : null,
};

/** Une erreur de la base devient une exception : core.ts la transforme en réponse 500 propre. */
function verifier<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const depots: Depots = {
  async utilisateur(jeton) {
    const { data, error } = await supabase.auth.getUser(jeton);
    return error || !data.user ? null : { id: data.user.id };
  },
  async reserverScan(id, cle, gratuit, premium, budget, parMinute) {
    return verifier(await supabase.rpc('reserver_scan', { p_user: id, p_cle: cle, p_gratuit: gratuit, p_premium: premium, p_budget: budget, p_par_minute: parMinute })) as Reservation;
  },
  async terminerScan(scanId, p) {
    verifier(await supabase.rpc('terminer_scan', { p_scan: scanId, p_resultat: p.resultat, p_modele: p.modele, p_duree: p.dureeMs, p_usage: p.usage, p_compte: p.compte }));
  },
  async echouerScan(scanId, erreur) {
    verifier(await supabase.rpc('echouer_scan', { p_scan: scanId, p_erreur: erreur }));
  },
  async etatCompte(id, gratuit, premium) {
    return verifier(await supabase.rpc('etat_compte', { p_user: id, p_gratuit: gratuit, p_premium: premium })) as { limite: number; restants: number; premium: Premium };
  },
  async utiliserCode(id, code) {
    return verifier(await supabase.rpc('utiliser_code', { p_user: id, p_code: code })) as { statut: 'ok' | 'invalide' | 'deja_utilise' | 'trop_essais' };
  },
  async creerPaiement(id, plan, montant) {
    return verifier(await supabase.rpc('creer_paiement', { p_user: id, p_plan: plan, p_montant: montant })) as string;
  },
  async lirePaiement(transactionId) {
    return (verifier(await supabase.rpc('lire_paiement', { p_id: transactionId })) as Paiement | null) ?? null;
  },
  async validerPaiement(transactionId, jours) {
    verifier(await supabase.rpc('valider_paiement', { p_id: transactionId, p_jours: jours }));
  },
  async refuserPaiement(transactionId) {
    verifier(await supabase.rpc('refuser_paiement', { p_id: transactionId }));
  },
  async enregistrerCorrection(id, c) {
    const scan = verifier(await supabase.from('scans').select('id').eq('id', c.scanId).eq('user_id', id).maybeSingle());
    if (!scan) return false;
    verifier(await supabase.from('corrections').upsert({ user_id: id, scan_id: c.scanId, proposees: c.proposees, finales: c.finales }, { onConflict: 'scan_id' }));
    return true;
  },
  async enregistrerSignalement(id, s) {
    verifier(
      await supabase
        .from('signalements')
        .upsert({ user_id: id, jour: s.jour, aliment_id: s.alimentId, repas_nom: s.repasNom }, { onConflict: 'user_id,jour,aliment_id', ignoreDuplicates: true }),
    );
  },
  async supprimerCompte(id) {
    // Les scans, corrections et signalements partent avec le compte (suppression en cascade)
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
  },
};

const vision = creerVision({
  cleApi: cleApi ?? '',
  urlApi: env('RODIUMAI_BASE_URL') ?? 'https://api.rodiumai.io/v1',
  modele: config.modele,
  reflexion: (['minimal', 'low', 'medium', 'high'] as const).find((n) => n === env('REFLEXION')),
});

Deno.serve(creerGestionnaire({ depots, vision, config }));
