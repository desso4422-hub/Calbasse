/**
 * Test d'intégration : la VRAIE fonction « api » (Deno) contre une VRAIE base PostgreSQL (la vraie migration),
 * avec un faux Supabase pour l'authentification et un faux RodiumAI. Il rejoue le parcours complet d'un client :
 * 1 scan gratuit, quota, code d'activation, 10 scans, correction, signalement, suppression du compte.
 *
 * Il faut : PostgreSQL local accessible à l'utilisateur « postgres » en confiance (voir scripts/tester-base.sh),
 * et Deno (variable DENO_BIN, ou « deno » dans le PATH). Sans Deno, le test est ignoré.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { demarrerFauxSupabase } from './mock-supabase.mjs';

const DENO = process.env.DENO_BIN ?? 'deno';
const RACINE = new URL('../../../', import.meta.url).pathname;
const aDeno = (() => { try { execFileSync(DENO, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const psql = (base, ...args) => execFileSync('psql', ['-U', 'postgres', '-h', '/var/run/postgresql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...(base ? ['-d', base] : []), ...args], { encoding: 'utf8' });

const REPAS = {
  estUnRepas: true,
  nomDuPlat: 'Garba',
  confianceGlobale: 'haute',
  remarque: '',
  composants: [
    { alimentId: 'attieke', grammes: 250, confiance: 'haute', alternatives: [], description: '' },
    { alimentId: 'thon-frit', grammes: 120, confiance: 'moyenne', alternatives: ['poisson-frit'], description: '' },
  ],
};
const PORT_API = 18787;

test('parcours complet d’un client : gratuit, quota, code, forfait, correction, suppression', { skip: !aDeno && 'Deno absent', timeout: 180_000 }, async (t) => {
  const base = `calbasse_integration_${process.pid}`;
  psql(null, '-c', `create database ${base}`);
  const dossier = `${RACINE}supabase/`;
  psql(base, '-f', `${dossier}tests/stub_supabase.sql`);
  for (const f of readdirSync(`${dossier}migrations`).sort()) psql(base, '-f', `${dossier}migrations/${f}`);

  const faux = await demarrerFauxSupabase({ base, reponseModele: REPAS });
  // FONCTION_FICHIER permet de rejouer le même parcours avec le fichier unique de supabase/installation/
  const api = spawn(DENO, ['run', '-A', '--no-lock', '--node-modules-dir=none', process.env.FONCTION_FICHIER ?? `${dossier}functions/api/index.ts`], {
    env: {
      ...process.env,
      DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${PORT_API}`,
      SUPABASE_URL: `http://127.0.0.1:${faux.port}`,
      SUPABASE_SERVICE_ROLE_KEY: 'cle-de-service-de-test',
      RODIUMAI_API_KEY: 'rd_sk_test',
      RODIUMAI_BASE_URL: `http://127.0.0.1:${faux.port}/rodium/v1`,
      SCANS_GRATUITS: '1',
      SCANS_PREMIUM: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let journal = '';
  api.stdout.on('data', (d) => (journal += d));
  api.stderr.on('data', (d) => (journal += d));
  t.after(() => {
    api.kill();
    faux.fermer();
    try { psql(null, '-c', `drop database ${base} with (force)`); } catch { /* ignoré */ }
  });

  // Attend que la fonction réponde
  const url = `http://127.0.0.1:${PORT_API}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/sante`)).ok) break; } catch { /* pas encore prête */ }
    await new Promise((r) => setTimeout(r, 300));
    if (i === 99) assert.fail(`la fonction ne démarre pas :\n${journal}`);
  }

  const appel = async (methode, chemin, jeton, corps) => {
    const r = await fetch(`${url}${chemin}`, { method: methode, headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) }, body: corps === undefined ? undefined : JSON.stringify(corps) });
    return { statut: r.status, corps: await r.json().catch(() => null) };
  };
  const photo = (cle) => ({ cle, image: 'QUJD', typeImage: 'image/jpeg', indice: 'garba' });

  const sante = await appel('GET', '/sante');
  assert.equal(sante.corps.scansGratuits, 1);
  assert.equal(sante.corps.scansPremium, 10);
  assert.deepEqual(sante.corps.tarifs, { mensuel: { montant: 1500, jours: 30 }, annuel: { montant: 12000, jours: 365 } });
  assert.equal(sante.corps.paiement, false);

  // Connexion anonyme (faux Supabase), puis on utilise la fonction comme le ferait l'app
  const inscription = await (await fetch(`http://127.0.0.1:${faux.port}/auth/v1/signup`, { method: 'POST', body: '{}' })).json();
  const jeton = inscription.access_token;
  const id = inscription.user.id;

  assert.equal((await appel('GET', '/compte')).statut, 401, 'sans jeton');
  assert.equal((await appel('GET', '/compte', 'tok-inconnu')).statut, 401, 'jeton inconnu');
  assert.deepEqual((await appel('GET', '/compte', jeton)).corps, { premium: null, scansRestants: 1, limite: 1, telephone: null });

  await t.test('1 scan gratuit : reconnu, enregistré, puis quota', async () => {
    const r = await appel('POST', '/scan', jeton, photo('essai-photo-0001'));
    assert.equal(r.statut, 200, JSON.stringify(r.corps) + journal);
    assert.equal(r.corps.nom, 'Garba');
    assert.deepEqual(r.corps.lignes.map((l) => l.alimentId), ['attieke', 'thon-frit']);
    assert.deepEqual(r.corps.compte, { premium: null, scansRestants: 0, limite: 1, telephone: null });
    assert.equal(faux.sql(`select statut from public.scans where user_id = '${id}'`), 'ok');
    assert.equal(JSON.parse(faux.sql(`select usage from public.scans where user_id = '${id}'`)).cost_rodi, 2.4, 'le coût est gardé');

    const renvoi = await appel('POST', '/scan', jeton, photo('essai-photo-0001'));
    assert.equal(renvoi.statut, 200);
    assert.equal(renvoi.corps.scanId, r.corps.scanId, 'même photo : même résultat, sans recompte');
    assert.equal(faux.sql(`select count(*) from public.scans where user_id = '${id}'`), '1');

    const quota = await appel('POST', '/scan', jeton, photo('essai-photo-0002'));
    assert.equal(quota.statut, 402);
    assert.equal(quota.corps.code, 'quota');
    assert.equal(quota.corps.limite, 1);
  });

  await t.test('un code d’activation porte la limite à 10 (code créé comme dans l’éditeur SQL)', async () => {
    const code = faux.sql(`select creer_codes('mensuel', 30, 1, 'test intégration')`);
    assert.match(code, /^CAL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.equal((await appel('POST', '/codes', jeton, { code: 'CAL-0000-0000-0000' })).corps.code, 'invalide');
    const ok = await appel('POST', '/codes', jeton, { code: code.toLowerCase() });
    assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
    assert.equal(ok.corps.compte.premium.plan, 'mensuel');
    assert.equal(ok.corps.compte.limite, 10);
    assert.equal(ok.corps.compte.scansRestants, 9, 'le scan déjà fait compte dans les 10');
    const autre = await (await fetch(`http://127.0.0.1:${faux.port}/auth/v1/signup`, { method: 'POST', body: '{}' })).json();
    const reutilise = await appel('POST', '/codes', autre.access_token, { code });
    assert.equal(reutilise.statut, 409, 'un code ne sert qu’une fois');
    assert.equal((await appel('GET', '/compte', autre.access_token)).corps.premium, null, 'l’autre reste gratuit');
  });

  await t.test('10 scans par jour avec le forfait, pas un de plus', async () => {
    for (let i = 2; i <= 10; i++) {
      const r = await appel('POST', '/scan', jeton, photo(`essai-photo-${String(i).padStart(4, '0')}`));
      assert.equal(r.statut, 200, `scan ${i} : ${JSON.stringify(r.corps)}`);
      // L'anti-rafale (6 par minute) est volontairement large pour ce test : on le contourne en reculant l'horloge des scans déjà faits
      faux.sql(`update public.scans set cree_le = cree_le - interval '2 minutes' where user_id = '${id}'`);
    }
    const onze = await appel('POST', '/scan', jeton, photo('essai-photo-0011'));
    assert.equal(onze.statut, 402);
    assert.equal(onze.corps.limite, 10);
    assert.equal(onze.corps.premium.plan, 'mensuel');
  });

  await t.test('correction et signalement enregistrés ; pas ceux des autres', async () => {
    const scanId = faux.sql(`select id from public.scans where user_id = '${id}' and cle = 'essai-photo-0001'`);
    const c = await appel('POST', '/corrections', jeton, { scanId, proposees: [{ alimentId: 'thon-frit', grammes: 120 }], finales: [{ alimentId: 'poisson-frit', grammes: 120 }] });
    assert.equal(c.statut, 200, JSON.stringify(c.corps) + '\n' + journal);
    assert.equal(JSON.parse(faux.sql(`select finales from public.corrections where scan_id = '${scanId}'`))[0].alimentId, 'poisson-frit');
    // Une 2e correction du même scan remplace la première
    await appel('POST', '/corrections', jeton, { scanId, proposees: [], finales: [{ alimentId: 'foufou', grammes: 100 }] });
    assert.equal(faux.sql(`select count(*) from public.corrections where scan_id = '${scanId}'`), '1');
    const intrus = await (await fetch(`http://127.0.0.1:${faux.port}/auth/v1/signup`, { method: 'POST', body: '{}' })).json();
    assert.equal((await appel('POST', '/corrections', intrus.access_token, { scanId, proposees: [], finales: [] })).statut, 404, 'le scan d’un autre');

    const s = await appel('POST', '/signalements', jeton, { jour: '2026-11-24', alimentId: 'thon-frit', repasNom: 'Garba' });
    assert.equal(s.statut, 200, JSON.stringify(s.corps) + '\n' + journal);
    await appel('POST', '/signalements', jeton, { jour: '2026-11-24', alimentId: 'thon-frit', repasNom: 'Garba' });
    assert.equal(faux.sql(`select count(*) from public.signalements where user_id = '${id}'`), '1', 'même signalement le même jour : une seule fois');
  });

  await t.test('suppression du compte : tout part avec lui, y compris le forfait', async () => {
    assert.equal(faux.sql(`select count(*) from public.abonnements where user_id = '${id}'`), '1');
    const r = await appel('DELETE', '/compte', jeton);
    assert.equal(r.statut, 200, JSON.stringify(r.corps) + '\n' + journal);
    for (const table of ['scans', 'corrections', 'signalements', 'abonnements']) {
      assert.equal(faux.sql(`select count(*) from public.${table} where user_id = '${id}'`), '0', table);
    }
    assert.equal((await appel('GET', '/compte', jeton)).statut, 401, 'le jeton ne marche plus');
  });
});
