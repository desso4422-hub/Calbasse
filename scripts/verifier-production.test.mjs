import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const BONNE = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijkl.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdef',
  EXPO_PUBLIC_CONTACT: '+229 01 02 03 04',
  EXPO_PUBLIC_PREMIUM: '1',
};
const lancer = (env) => spawnSync(process.execPath, [new URL('./verifier-production.mjs', import.meta.url).pathname], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('une configuration complète est acceptée', () => {
  const r = lancer(BONNE);
  assert.equal(r.status, 0, r.stderr);
});

test('chaque oubli ou erreur bloque la construction, avec un message clair', () => {
  const cas = [
    [{ ...BONNE, EXPO_PUBLIC_SUPABASE_URL: undefined }, /SUPABASE_URL/],
    [{ ...BONNE, EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }, /SUPABASE_URL/],
    [{ ...BONNE, EXPO_PUBLIC_SUPABASE_URL: 'A_REMPLIR' }, /SUPABASE_URL/],
    [{ ...BONNE, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'court' }, /ANON_KEY/],
    [{ ...BONNE, EXPO_PUBLIC_CONTACT: undefined }, /CONTACT/],
    [{ ...BONNE, EXPO_PUBLIC_CONTACT: 'À COMPLÉTER' }, /CONTACT/],
    [{ ...BONNE, EXPO_PUBLIC_PREMIUM: undefined }, /PREMIUM/],
    [{ ...BONNE, EXPO_PUBLIC_DEMO: '1' }, /DEMO/],
    [{ ...BONNE, EXPO_PUBLIC_VISION_DIRECTE: '1' }, /reste sur le serveur/],
    [{ ...BONNE, EXPO_PUBLIC_RODIUMAI_API_KEY: 'rd_sk_secrete' }, /reste sur le serveur/],
    [{ ...BONNE, EXPO_PUBLIC_API_URL: 'https://autre.exemple' }, /API_URL/],
  ];
  for (const [env, motif] of cas) {
    const r = lancer(env);
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stderr, motif);
  }
});

test('sur EAS, les profils de développement ne sont pas contrôlés, ceux des utilisateurs le sont', () => {
  assert.equal(lancer({ EAS_BUILD_PROFILE: 'developpement' }).status, 0);
  assert.equal(lancer({ EAS_BUILD_PROFILE: 'testeurs' }).status, 1);
  assert.equal(lancer({ EAS_BUILD_PROFILE: 'production', ...BONNE }).status, 0);
});

test('« aucun » comme contact : accepté pour la version de test, refusé pour la diffusion', () => {
  assert.equal(lancer({ ...BONNE, EAS_BUILD_PROFILE: 'testeurs', EXPO_PUBLIC_CONTACT: 'aucun' }).status, 0);
  assert.equal(lancer({ ...BONNE, EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_CONTACT: 'aucun' }).status, 1);
  assert.equal(lancer({ ...BONNE, EXPO_PUBLIC_CONTACT: 'aucun' }).status, 1);
});
