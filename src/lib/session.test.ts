/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseApi, expireBientot, sessionDepuisReponse, sessionStockee } from './session.ts';

const maintenant = Date.UTC(2026, 10, 23, 12, 0, 0);
const s = Math.floor(maintenant / 1000);

test('la réponse de connexion anonyme devient une session', () => {
  assert.deepEqual(sessionDepuisReponse({ access_token: 'a', refresh_token: 'r', expires_at: s + 3600, user: { id: 'x' } }, maintenant), { acces: 'a', refresh: 'r', expire: s + 3600 });
  // Sans expires_at, on se sert de la durée
  assert.deepEqual(sessionDepuisReponse({ access_token: 'a', refresh_token: 'r', expires_in: 1800 }, maintenant), { acces: 'a', refresh: 'r', expire: s + 1800 });
  // Ni l'un ni l'autre : prudence, une heure
  assert.equal(sessionDepuisReponse({ access_token: 'a', refresh_token: 'r' }, maintenant)?.expire, s + 3600);
});

test('une réponse inutilisable ne donne pas de session', () => {
  for (const mauvaise of [null, 'x', {}, { access_token: 'a' }, { access_token: '', refresh_token: 'r' }, { access_token: 1, refresh_token: 'r' }, { error: 'anonymous_provider_disabled' }]) {
    assert.equal(sessionDepuisReponse(mauvaise, maintenant), null, JSON.stringify(mauvaise));
  }
});

test('le jeton est renouvelé un peu avant son expiration, pas après', () => {
  const session = { acces: 'a', refresh: 'r', expire: s + 3600 };
  assert.equal(expireBientot(session, maintenant), false);
  assert.equal(expireBientot(session, maintenant + 3500 * 1000), false);       // il reste 100 s, plus que la marge de 90 s
  assert.equal(expireBientot(session, maintenant + 3520 * 1000), true);        // il reste 80 s : on renouvelle
  assert.equal(expireBientot(session, maintenant + 3600 * 1000), true);
  assert.equal(expireBientot(session, maintenant + 7200 * 1000), true);
});

test('la session gardée sur le téléphone est relue avec méfiance', () => {
  const bonne = { acces: 'a', refresh: 'r', expire: 123 };
  assert.deepEqual(sessionStockee(JSON.stringify(bonne)), bonne);
  for (const mauvaise of [null, '', 'pas du json', '{}', '{"acces":"a"}', '{"acces":"","refresh":"r","expire":1}', '{"acces":"a","refresh":"r","expire":"demain"}']) {
    assert.equal(sessionStockee(mauvaise), null, String(mauvaise));
  }
});

test('adresse de la fonction api', () => {
  assert.equal(adresseApi('https://abc.supabase.co'), 'https://abc.supabase.co/functions/v1/api');
  assert.equal(adresseApi('https://abc.supabase.co/ '), 'https://abc.supabase.co/functions/v1/api');
});
