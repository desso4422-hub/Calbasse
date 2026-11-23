/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { creerGestionnaire, type Depots, type Reservation } from './core.ts';
import { creerVision, ErreurVision, RefusModele, ReponseIllisible, type Vision } from './rodium.ts';
import type { ResultatScan } from '../_shared/vision.ts';

const REPAS: ResultatScan = {
  estUnRepas: true,
  nom: 'Garba',
  confiance: 'haute',
  lignes: [{ alimentId: 'attieke', grammes: 250, confiance: 'haute', alternatives: [] }],
  inconnus: [],
  remarque: '',
};

type Appels = { reserver: unknown[][]; terminer: unknown[][]; echouer: unknown[][]; corrections: unknown[][]; signalements: unknown[][]; supprimes: string[] };

/** Une fausse base : reproduit les règles du SQL en mémoire (un compte, une limite par jour). */
function fauxDepots(opts: { limite?: number; statut?: Reservation['statut']; restants?: number; scansDe?: Record<string, string> } = {}) {
  const appels: Appels = { reserver: [], terminer: [], echouer: [], corrections: [], signalements: [], supprimes: [] };
  const depots: Depots = {
    async utilisateur(jeton) {
      return jeton === 'jeton-valide' ? { id: 'u1' } : jeton === 'jeton-autre' ? { id: 'u2' } : null;
    },
    async reserverScan(...a) {
      appels.reserver.push(a);
      const limite = opts.limite ?? 5;
      const statut = opts.statut ?? 'nouveau';
      return { statut, scan_id: 'scan-1', resultat: { scanId: 'scan-1', ...REPAS }, limite, restants: opts.restants ?? limite - 1 };
    },
    async terminerScan(...a) { appels.terminer.push(a); },
    async echouerScan(...a) { appels.echouer.push(a); },
    async etatCompte(_id, limite) { return { limite, restants: opts.restants ?? limite }; },
    async enregistrerCorrection(id, c) { appels.corrections.push([id, c]); return (opts.scansDe ?? { 'scan-1': 'u1' })[c.scanId] === id; },
    async enregistrerSignalement(...a) { appels.signalements.push(a); },
    async supprimerCompte(id) { appels.supprimes.push(id); },
  };
  return { depots, appels };
}

const config = { modele: 'google/gemini-3.1-flash-lite', limite: 5, budget: 300, parMinute: 6 };
const visionOk: Vision = async () => ({ resultat: REPAS, usage: { prompt_tokens: 10400 }, modele: config.modele });
const visionQui = (e: unknown): Vision => async () => { throw e; };

function appli(opts: Parameters<typeof fauxDepots>[0] = {}, vision: Vision = visionOk) {
  const { depots, appels } = fauxDepots(opts);
  const gerer = creerGestionnaire({ depots, vision, config });
  const appeler = (methode: string, chemin: string, corps?: unknown, jeton: string | null = 'jeton-valide') =>
    gerer(new Request(`https://x.supabase.co/functions/v1/api${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    }));
  return { appeler, appels };
}
const photo = { cle: 'photo-0001', image: 'QUJD', typeImage: 'image/jpeg', indice: 'garba' };

test('santé : joignable sans connexion', async () => {
  const r = await appli().appeler('GET', '/sante', undefined, null);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('sans jeton ou avec un jeton inconnu : 401', async () => {
  const { appeler } = appli();
  assert.equal((await appeler('GET', '/compte', undefined, null)).status, 401);
  assert.equal((await appeler('GET', '/compte', undefined, 'jeton-bidon')).status, 401);
  assert.equal((await appeler('POST', '/scan', photo, 'jeton-bidon')).status, 401);
});

test('les chemins /api/… et /functions/v1/api/… mènent aux mêmes routes', async () => {
  const { depots } = fauxDepots();
  const gerer = creerGestionnaire({ depots, vision: visionOk, config });
  for (const chemin of ['/api/compte', '/functions/v1/api/compte', '/compte']) {
    const r = await gerer(new Request(`https://x.co${chemin}`, { headers: { Authorization: 'Bearer jeton-valide' } }));
    assert.equal(r.status, 200, chemin);
  }
});

test('compte : scans restants au format attendu par l’app', async () => {
  const r = await appli({ restants: 3 }).appeler('GET', '/compte');
  assert.deepEqual(await r.json(), { premium: null, scansRestants: 3, limite: 5, telephone: null });
});

test('scan : la clé de la photo, la limite et le budget sont transmis ; le résultat revient avec le compte', async () => {
  const { appeler, appels } = appli();
  const r = await appeler('POST', '/scan', photo);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.scanId, 'scan-1');
  assert.equal(j.nom, 'Garba');
  assert.deepEqual(j.compte, { premium: null, scansRestants: 4, limite: 5, telephone: null });
  assert.deepEqual(appels.reserver[0], ['u1', 'photo-0001', 5, 300, 6]);
  const t = appels.terminer[0] as [string, { compte: boolean; modele: string; resultat: { scanId: string } }];
  assert.equal(t[0], 'scan-1');
  assert.equal(t[1].compte, true);
  assert.equal(t[1].resultat.scanId, 'scan-1');   // la réponse est mémorisée : un renvoi la rendra à l'identique
});

test('scan : une photo sans nourriture ne coûte pas de scan', async () => {
  const sansRepas: Vision = async () => ({ resultat: { ...REPAS, estUnRepas: false, lignes: [] }, usage: {}, modele: 'm' });
  const { appeler, appels } = appli({ restants: 4 }, sansRepas);
  const j = await (await appeler('POST', '/scan', photo)).json();
  assert.equal(j.compte.scansRestants, 5, 'le scan réservé est rendu');
  assert.equal((appels.terminer[0] as [string, { compte: boolean }])[1].compte, false);
});

test('scan : un renvoi de la même photo rend le même résultat, sans appeler le modèle', async () => {
  let appelsModele = 0;
  const { appeler } = appli({ statut: 'deja', restants: 2 }, async () => { appelsModele++; return { resultat: REPAS, usage: {}, modele: 'm' }; });
  const r = await appeler('POST', '/scan', photo);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).compte.scansRestants, 2);
  assert.equal(appelsModele, 0);
});

test('scan : limites atteintes, avec les codes que l’app comprend', async () => {
  const quota = await appli({ statut: 'quota', restants: 0 }).appeler('POST', '/scan', photo);
  assert.equal(quota.status, 402);
  const jq = await quota.json();
  assert.equal(jq.code, 'quota');
  assert.equal(jq.scansRestants, 0);
  assert.equal(jq.limite, 5);

  const vite = await appli({ statut: 'trop_vite' }).appeler('POST', '/scan', photo);
  assert.equal(vite.status, 429);
  const budget = await appli({ statut: 'budget' }).appeler('POST', '/scan', photo);
  assert.equal(budget.status, 403);
  assert.equal((await budget.json()).code, 'budget');
  const enCours = await appli({ statut: 'en_cours' }).appeler('POST', '/scan', photo);
  assert.equal(enCours.status, 503);
});

test('scan : le modèle n’est jamais appelé quand une limite est atteinte', async () => {
  let appelsModele = 0;
  const { appeler } = appli({ statut: 'quota' }, async () => { appelsModele++; return { resultat: REPAS, usage: {}, modele: 'm' }; });
  await appeler('POST', '/scan', photo);
  assert.equal(appelsModele, 0);
});

test('scan : les pannes du modèle ne coûtent rien et sont traduites pour l’app', async () => {
  const cas: [string, unknown, number, RegExp][] = [
    ['refus du modèle', new RefusModele('x'), 422, /pas pu être analysée/],
    ['réponse illisible', new ReponseIllisible('x'), 502, /incomplète/],
    ['fournisseur surchargé', new ErreurVision('x', 429), 503, /très demandé/],
    ['réseau coupé', new ErreurVision('x', 503, 'reseau'), 503, /très demandé/],
    ['clé invalide ou crédit épuisé', new ErreurVision('x', 401), 503, /indisponible/],
    ['bug', new Error('boum'), 500, /interne/],
  ];
  for (const [nom, erreur, statut, message] of cas) {
    const { appeler, appels } = appli({}, visionQui(erreur));
    const r = await appeler('POST', '/scan', photo);
    assert.equal(r.status, statut, nom);
    assert.match((await r.json()).erreur, message, nom);
    assert.equal(appels.echouer.length, 1, `${nom} : le scan réservé est libéré`);
    assert.equal(appels.terminer.length, 0, nom);
  }
});

test('scan : requêtes invalides refusées avant toute réservation', async () => {
  const { appeler, appels } = appli();
  assert.equal((await appeler('POST', '/scan', { cle: 'photo-0001' })).status, 400);
  assert.equal((await appeler('POST', '/scan', { image: 'x'.repeat(7_000_001) })).status, 413);
  const r = await appeler('POST', '/scan', 'pas un objet');
  assert.equal(r.status, 400);
  assert.equal(appels.reserver.length, 0);
});

test('scan : sans clé valide, l’app peut scanner (la photo reçoit une clé)', async () => {
  const { appeler, appels } = appli();
  await appeler('POST', '/scan', { image: 'QUJD', cle: 'x' });
  const cle = appels.reserver[0][1] as string;
  assert.match(cle, /^[0-9a-f-]{36}$/);
});

test('scan : le préfixe « data:image/jpeg;base64, » est retiré et l’indice est borné', async () => {
  let vu: { image: string; indice: string } | null = null;
  const { appeler } = appli({}, async (image, _t, indice) => { vu = { image, indice }; return { resultat: REPAS, usage: {}, modele: 'm' }; });
  await appeler('POST', '/scan', { cle: 'photo-0001', image: 'data:image/jpeg;base64,QUJD', indice: 'a'.repeat(1000) });
  assert.equal(vu!.image, 'QUJD');
  assert.equal(vu!.indice.length, 300);
});

test('corrections : enregistrées pour son propre scan seulement', async () => {
  const { appeler, appels } = appli();
  const ok = await appeler('POST', '/corrections', { scanId: 'scan-1', proposees: [{ alimentId: 'piron', grammes: 200 }], finales: [{ alimentId: 'foufou', grammes: 200 }] });
  assert.equal(ok.status, 200);
  assert.equal(appels.corrections.length, 1);
  const autre = await appeler('POST', '/corrections', { scanId: 'scan-1', proposees: [], finales: [] }, 'jeton-autre');
  assert.equal(autre.status, 404, 'le scan d’un autre n’est pas corrigeable');
  assert.equal((await appeler('POST', '/corrections', { scanId: 'scan-1' })).status, 400);
});

test('signalements : validés puis enregistrés', async () => {
  const { appeler, appels } = appli();
  const ok = await appeler('POST', '/signalements', { jour: '2026-11-23', alimentId: 'piron', repasNom: 'Piron, sauce' });
  assert.equal(ok.status, 200);
  assert.deepEqual(appels.signalements[0], ['u1', { jour: '2026-11-23', alimentId: 'piron', repasNom: 'Piron, sauce' }]);
  assert.equal((await appeler('POST', '/signalements', { jour: 'hier', alimentId: 'piron' })).status, 400);
  assert.equal((await appeler('POST', '/signalements', { jour: '2026-11-23', alimentId: 'a b; drop' })).status, 400);
});

test('suppression du compte', async () => {
  const { appeler, appels } = appli();
  const r = await appeler('DELETE', '/compte');
  assert.equal(r.status, 200);
  assert.deepEqual(appels.supprimes, ['u1']);
});

test('CORS et routes inconnues', async () => {
  const { appeler } = appli();
  const o = await appeler('OPTIONS', '/scan', undefined, null);
  assert.equal(o.status, 204);
  assert.ok(o.headers.get('access-control-allow-headers')?.includes('authorization'));
  assert.equal((await appeler('GET', '/nimporte')).status, 404);
});

// ——— Appel à RodiumAI ———

function fauxFetch(reponses: { statut: number; corps: object }[]) {
  const appels: { url: string; headers: Record<string, string>; corps: Record<string, unknown> }[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), headers: init?.headers as Record<string, string>, corps: JSON.parse(String(init?.body)) });
    const r = reponses[Math.min(appels.length - 1, reponses.length - 1)];
    return new Response(JSON.stringify(r.corps), { status: r.statut, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { http, appels };
}
const cfgVision = { cleApi: 'rd_sk_secrete', urlApi: 'https://api.rodiumai.exemple/v1/', modele: 'google/gemini-3.1-flash-lite' };
const reponseModele = (c: unknown) => ({
  statut: 200,
  corps: { choices: [{ message: { content: JSON.stringify(c) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1200 }, cost_rodi: 0.4 },
});
const cible = { estUnRepas: true, nomDuPlat: 'Garba', confianceGlobale: 'haute', remarque: '', composants: [{ alimentId: 'attieke', grammes: 253, confiance: 'haute', alternatives: [], description: '' }] };

test('RodiumAI : requête compatible OpenAI avec la clé en Bearer, résultat vérifié et nettoyé', async () => {
  const { http, appels } = fauxFetch([reponseModele(cible)]);
  const a = await creerVision(cfgVision, http)('QUJD', 'image/jpeg', 'garba');
  assert.equal(appels[0].url, 'https://api.rodiumai.exemple/v1/chat/completions');
  assert.equal(appels[0].headers.Authorization, 'Bearer rd_sk_secrete');
  assert.equal(a.resultat.nom, 'Garba');
  assert.equal(a.resultat.lignes[0].grammes, 255);       // arrondi à 5 g
  assert.equal((a.usage as { cost_rodi: number }).cost_rodi, 0.4);
});

test('RodiumAI : un aliment inventé par le modèle est refusé', async () => {
  const { http } = fauxFetch([reponseModele({ ...cible, composants: [{ ...cible.composants[0], alimentId: 'pizza-4-fromages' }] })]);
  await assert.rejects(creerVision(cfgVision, http)('QUJD', 'image/jpeg', ''), ReponseIllisible);
});

test('RodiumAI : erreurs du fournisseur remontées avec leur statut', async () => {
  const { http } = fauxFetch([{ statut: 402, corps: { error: { message: 'Insufficient credit', code: 'insufficient_credit' } } }]);
  await assert.rejects(creerVision(cfgVision, http)('QUJD', 'image/jpeg', ''), (e: ErreurVision) => e instanceof ErreurVision && e.statut === 402 && e.code === 'insufficient_credit');
  const refus = fauxFetch([{ statut: 200, corps: { choices: [{ message: { content: null }, finish_reason: 'content_filter' }] } }]);
  await assert.rejects(creerVision(cfgVision, refus.http)('QUJD', 'image/jpeg', ''), RefusModele);
});

test('RodiumAI : si le format JSON strict est refusé, on réessaie sans lui', async () => {
  const { http, appels } = fauxFetch([{ statut: 400, corps: { error: 'response_format non supporté' } }, reponseModele(cible)]);
  const a = await creerVision(cfgVision, http)('QUJD', 'image/jpeg', '');
  assert.equal(a.resultat.nom, 'Garba');
  assert.equal(appels.length, 2);
  assert.equal((appels[0].corps.response_format as { type: string }).type, 'json_schema');
  assert.equal((appels[1].corps.response_format as { type: string }).type, 'json_object');
});

// ——— Garde-fou : le cerveau partagé ne doit pas prendre de retard sur l’app ———

test('la copie des consignes et du catalogue dans la fonction est à jour', () => {
  for (const f of ['aliments.ts', 'plats.ts', 'vision.ts']) {
    const source = readFileSync(new URL(`../../../src/lib/${f}`, import.meta.url), 'utf8');
    const copie = readFileSync(new URL(`../_shared/${f}`, import.meta.url), 'utf8');
    assert.ok(copie.endsWith(source), `${f} : lance « npm run sync:supabase »`);
  }
});
