/**
 * Fonction « api » de Calbasse : le seul point d'entrée de l'app vers le serveur.
 *
 * Elle branche la logique de core.ts sur la vraie base de données Supabase et sur RodiumAI.
 *
 * Secrets à définir dans Supabase (Edge Functions → Secrets) :
 *   RODIUMAI_API_KEY   ta clé RodiumAI (rd_sk_…)                          obligatoire
 *   SCANS_PAR_JOUR     scans gratuits par personne et par jour            5 par défaut
 *   BUDGET_JOUR        scans par jour pour tout le monde (plafond)       300 par défaut
 *   RODIUMAI_MODELE    modèle de vision                                  google/gemini-3.1-flash-lite
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { creerGestionnaire, type Depots, type Reservation } from './core.ts';
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

const config = {
  modele: env('RODIUMAI_MODELE') ?? 'google/gemini-3.1-flash-lite',
  limite: entier('SCANS_PAR_JOUR', 5),
  budget: entier('BUDGET_JOUR', 300),
  parMinute: entier('SCANS_PAR_MINUTE', 6),
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
  async reserverScan(id, cle, limite, budget, parMinute) {
    return verifier(await supabase.rpc('reserver_scan', { p_user: id, p_cle: cle, p_limite: limite, p_budget: budget, p_par_minute: parMinute })) as Reservation;
  },
  async terminerScan(scanId, p) {
    verifier(await supabase.rpc('terminer_scan', { p_scan: scanId, p_resultat: p.resultat, p_modele: p.modele, p_duree: p.dureeMs, p_usage: p.usage, p_compte: p.compte }));
  },
  async echouerScan(scanId, erreur) {
    verifier(await supabase.rpc('echouer_scan', { p_scan: scanId, p_erreur: erreur }));
  },
  async etatCompte(id, limite) {
    return verifier(await supabase.rpc('etat_compte', { p_user: id, p_limite: limite })) as { limite: number; restants: number };
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
