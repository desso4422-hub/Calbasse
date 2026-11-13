/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nomFournisseur, optionsDepuisEnv } from './config.ts';
import { analyserRepas, ErreurFournisseur, RefusModele, type ReponseModele } from './reconnaissance.ts';
import { fournisseurRodium } from './rodiumai.ts';

const repas: ReponseModele = {
  estUnRepas: true,
  nomDuPlat: 'Waakye',
  confianceGlobale: 'haute',
  composants: [{ alimentId: 'waakye', grammes: 300, confiance: 'haute', alternatives: [], description: '' }],
  remarque: '',
};

type Appel = { url: string; headers: Record<string, string>; corps: Record<string, unknown> };

function fauxHttp(reponses: { statut: number; corps: object }[]) {
  const appels: Appel[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), headers: init?.headers as Record<string, string>, corps: JSON.parse(String(init?.body)) });
    const r = reponses[Math.min(appels.length - 1, reponses.length - 1)];
    return new Response(JSON.stringify(r.corps), { status: r.statut, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { http, appels };
}

const ok = (contenu: string, fin = 'stop') => ({ statut: 200, corps: { choices: [{ message: { content: contenu }, finish_reason: fin }], usage: { prompt_tokens: 1200, completion_tokens: 150 }, cost_rodi: 0.4 } });
const config = { cleApi: 'rd_sk_test', urlApi: 'https://api.rodiumai.exemple/v1' };
const options = { modele: 'google/gemini-3.1-flash-lite' };

test('RodiumAI : requête compatible OpenAI, photo en data URL, schéma JSON, clé en Bearer', async () => {
  const { http, appels } = fauxHttp([ok(JSON.stringify(repas))]);
  const { resultat, usage } = await analyserRepas(fournisseurRodium(config, http), 'QUJD', 'image/jpeg', 'waakye', options);
  assert.equal(resultat.nom, 'Waakye');
  assert.deepEqual(usage, { prompt_tokens: 1200, completion_tokens: 150, cost_rodi: 0.4 });
  const a = appels[0];
  assert.equal(a.url, 'https://api.rodiumai.exemple/v1/chat/completions');
  assert.equal(a.headers.Authorization, 'Bearer rd_sk_test');
  assert.equal(a.corps.model, 'google/gemini-3.1-flash-lite');
  const messages = a.corps.messages as { role: string; content: unknown }[];
  assert.equal(messages[0].role, 'system');
  assert.ok(String(messages[0].content).includes('- attieke — Attiéké'));
  const contenu = messages[1].content as { type: string; image_url?: { url: string }; text?: string }[];
  assert.equal(contenu[0].image_url?.url, 'data:image/jpeg;base64,QUJD');
  assert.ok(contenu[1].text?.includes('« waakye »'));
  assert.equal((a.corps.response_format as { type: string }).type, 'json_schema');
});

test('RodiumAI : si le schéma est refusé (400), repli sur json_object, et on s’en souvient', async () => {
  const { http, appels } = fauxHttp([{ statut: 400, corps: { error: { message: 'json_schema not supported' } } }, ok(JSON.stringify(repas)), ok(JSON.stringify(repas))]);
  const f = fournisseurRodium(config, http);
  await analyserRepas(f, 'X', 'image/jpeg', '', options);
  assert.equal((appels[1].corps.response_format as { type: string }).type, 'json_object');
  await analyserRepas(f, 'X', 'image/jpeg', '', options);
  assert.equal(appels.length, 3); // pas de nouvel essai avec le schéma
  assert.equal((appels[2].corps.response_format as { type: string }).type, 'json_object');
});

test('RodiumAI : JSON entouré de ```json, refus, crédit épuisé, clé invalide', async () => {
  const entoure = fauxHttp([ok('```json\n' + JSON.stringify(repas) + '\n```')]);
  assert.equal((await analyserRepas(fournisseurRodium(config, entoure.http), 'X', 'image/jpeg', '', options)).resultat.nom, 'Waakye');

  const filtre = fauxHttp([ok('', 'content_filter')]);
  await assert.rejects(analyserRepas(fournisseurRodium(config, filtre.http), 'X', 'image/jpeg', '', options), RefusModele);

  const credit = fauxHttp([{ statut: 402, corps: { error: { message: 'Insufficient RODI balance', code: 'insufficient_balance' } } }]);
  await assert.rejects(analyserRepas(fournisseurRodium(config, credit.http), 'X', 'image/jpeg', '', options), (e: unknown) => {
    assert.ok(e instanceof ErreurFournisseur);
    assert.equal(e.statut, 402);
    assert.equal(e.code, 'insufficient_balance');
    return true;
  });

  const cle = fauxHttp([{ statut: 401, corps: { error: { message: 'Invalid API key', code: 'invalid_api_key' } } }]);
  await assert.rejects(analyserRepas(fournisseurRodium(config, cle.http), 'X', 'image/jpeg', '', options), /401/);
});

test('choix du fournisseur et du modèle selon les variables', () => {
  assert.equal(nomFournisseur({}), null);
  assert.equal(nomFournisseur({ RODIUMAI_API_KEY: 'rd_sk_x' }), 'rodiumai');
  assert.equal(nomFournisseur({ GEMINI_API_KEY: 'AIza' }), 'gemini');
  assert.equal(nomFournisseur({ RODIUMAI_API_KEY: 'rd', GEMINI_API_KEY: 'AIza' }), 'rodiumai');
  assert.equal(nomFournisseur({ RODIUMAI_API_KEY: 'rd', GEMINI_API_KEY: 'AIza', FOURNISSEUR_VISION: 'gemini' }), 'gemini');
  assert.equal(optionsDepuisEnv({ RODIUMAI_API_KEY: 'rd' }).modele, 'google/gemini-3.1-flash-lite');
  assert.equal(optionsDepuisEnv({ RODIUMAI_API_KEY: 'rd', RODIUMAI_MODELE: 'google/gemini-2.5-flash' }).modele, 'google/gemini-2.5-flash');
  assert.equal(optionsDepuisEnv({ RODIUMAI_API_KEY: 'rd', REFLEXION: 'low' }).reflexion, 'low');
});
