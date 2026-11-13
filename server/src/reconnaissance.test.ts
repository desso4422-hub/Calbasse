/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idsAliments, texteCatalogue } from './catalogue.ts';
import type { GenerateContentResponse } from '@google/genai';
import { optionsDepuisEnv } from './config.ts';
import { analyserRepas, construireRequete, normaliser, RefusModele, schemaJson, type ClientVision, type ReponseModele } from './reconnaissance.ts';

const options = { modele: 'gemini-3.8-flash' };

function fauxClient(reponse: Partial<GenerateContentResponse> & { text?: string }, appels: unknown[] = []): ClientVision {
  return {
    models: {
      generateContent: async (params) => {
        appels.push(params);
        return reponse as GenerateContentResponse;
      },
    },
  };
}

const reponseOk = (r: ReponseModele) => ({ text: JSON.stringify(r), candidates: [{ finishReason: 'STOP' }] }) as never;

const garba: ReponseModele = {
  estUnRepas: true,
  nomDuPlat: 'Garba',
  confianceGlobale: 'haute',
  composants: [
    { alimentId: 'attieke', grammes: 263, confiance: 'haute', alternatives: ['couscous-mil', 'attieke', 'gari'], description: 'semoule blanche' },
    { alimentId: 'thon-frit', grammes: 118, confiance: 'moyenne', alternatives: ['poisson-frit'], description: 'gros morceau de poisson frit' },
    { alimentId: 'inconnu', grammes: 30, confiance: 'basse', alternatives: [], description: 'oignons crus et tomate' },
  ],
  remarque: '',
};

test('le catalogue contient chaque aliment, ses noms locaux et son aspect', () => {
  const t = texteCatalogue();
  for (const id of idsAliments) assert.ok(t.includes(`- ${id} — `), id);
  assert.ok(t.includes('amiwo'));
  assert.ok(t.includes('Aspect :'));
  assert.ok(t.includes('Garba (attiéké, thon frit)'));
});

test('le catalogue est stable (cache de prompt)', () => {
  assert.equal(texteCatalogue(), texteCatalogue());
});

test('la requête : image, indice, consignes et catalogue, sortie JSON contrainte', () => {
  const r = construireRequete('QUJD', 'image/jpeg', '  du garba bien pimenté ', options);
  assert.equal(r.model, 'gemini-3.8-flash');
  const parts = (r.contents as { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[])[0].parts;
  assert.deepEqual(parts[0].inlineData, { mimeType: 'image/jpeg', data: 'QUJD' });
  assert.ok(parts[1].text?.includes('« du garba bien pimenté »'));
  assert.equal(r.config?.responseMimeType, 'application/json');
  assert.equal(r.config?.responseJsonSchema, schemaJson);
  assert.equal(r.config?.thinkingConfig, undefined);
  assert.ok(String(r.config?.systemInstruction).includes('- attieke — Attiéké'));
  // Rien de variable dans les consignes (cache implicite de Gemini)
  assert.equal(construireRequete('X', 'image/png', 'autre', options).config?.systemInstruction, r.config?.systemInstruction);
});

test('le schéma JSON est autonome (pas de $ref) et limite les identifiants à la base', () => {
  const s = JSON.stringify(schemaJson);
  assert.ok(!s.includes('$ref') && !s.includes('$schema'));
  assert.ok(s.includes('"inconnu"'));
});

test('réglages : modèle et niveau de réflexion depuis les variables', () => {
  assert.deepEqual(optionsDepuisEnv({}), { modele: 'gemini-3.8-flash', reflexion: undefined });
  assert.deepEqual(optionsDepuisEnv({ GEMINI_MODELE: 'gemini-flash-lite-latest', GEMINI_REFLEXION: 'LOW' }), { modele: 'gemini-flash-lite-latest', reflexion: 'low' });
  assert.equal(optionsDepuisEnv({ GEMINI_REFLEXION: 'n importe quoi' }).reflexion, undefined);
  assert.deepEqual(construireRequete('X', 'image/jpeg', '', { modele: 'm', reflexion: 'low' }).config?.thinkingConfig, { thinkingLevel: 'LOW' });
});

test('normalisation : grammes arrondis, alternatives propres, inconnus à part', () => {
  const r = normaliser(garba);
  assert.equal(r.nom, 'Garba');
  assert.deepEqual(r.lignes[0], { alimentId: 'attieke', grammes: 265, confiance: 'haute', alternatives: ['couscous-mil', 'gari'] });
  assert.equal(r.lignes[1].grammes, 120);
  assert.deepEqual(r.inconnus, [{ description: 'oignons crus et tomate', grammes: 30 }]);
});

test('normalisation : un aliment répété est fusionné, les grammes absurdes sont bornés', () => {
  const r = normaliser({
    ...garba,
    composants: [
      { alimentId: 'oeuf', grammes: 50, confiance: 'haute', alternatives: [], description: '' },
      { alimentId: 'oeuf', grammes: 50, confiance: 'haute', alternatives: [], description: '' },
      { alimentId: 'riz-blanc', grammes: 99999, confiance: 'haute', alternatives: [], description: '' },
      { alimentId: 'piment', grammes: 0, confiance: 'haute', alternatives: [], description: '' },
    ],
  });
  assert.deepEqual(r.lignes.map((l) => [l.alimentId, l.grammes]), [['oeuf', 100], ['riz-blanc', 2000], ['piment', 5]]);
});

test("pas un repas : l'app le sait", () => {
  const r = normaliser({ estUnRepas: false, nomDuPlat: '', confianceGlobale: 'basse', composants: [], remarque: 'Je vois un chat.' });
  assert.equal(r.estUnRepas, false);
  assert.equal(r.lignes.length, 0);
});

test('analyse de bout en bout avec un faux client', async () => {
  const appels: unknown[] = [];
  const { resultat } = await analyserRepas(fauxClient(reponseOk(garba), appels), 'QUJD', 'image/jpeg', '', options);
  assert.equal(appels.length, 1);
  assert.equal(resultat.lignes.length, 2);
});

test('refus, réponse vide, JSON cassé, identifiant hors base', async () => {
  await assert.rejects(analyserRepas(fauxClient({ promptFeedback: { blockReason: 'SAFETY' } } as never), 'X', 'image/jpeg', '', options), RefusModele);
  await assert.rejects(analyserRepas(fauxClient({ candidates: [{ finishReason: 'SAFETY' }] } as never), 'X', 'image/jpeg', '', options), RefusModele);
  await assert.rejects(analyserRepas(fauxClient({ text: '', candidates: [{ finishReason: 'MAX_TOKENS' }] } as never), 'X', 'image/jpeg', '', options), /vide/);
  await assert.rejects(analyserRepas(fauxClient({ text: '{"estUnRepas": tr', candidates: [{ finishReason: 'MAX_TOKENS' }] } as never), 'X', 'image/jpeg', '', options), /non exploitable/);
  const invente = { ...garba, composants: [{ ...garba.composants[0], alimentId: 'pizza' }] };
  await assert.rejects(analyserRepas(fauxClient({ text: JSON.stringify(invente) } as never), 'X', 'image/jpeg', '', options), /non conforme/);
});

test('numéros de téléphone', async () => {
  const { normaliserNumero } = await import('./sms.ts');
  assert.equal(normaliserNumero('01 97 12 34 56', '229'), '+2290197123456');
  assert.equal(normaliserNumero('+225 07 07 07 07 07'), '+2250707070707');
  assert.equal(normaliserNumero('00221 77 123 45 67'), '+221771234567');
  assert.equal(normaliserNumero('77 123 45 67'), null);
  assert.equal(normaliserNumero('123', '229'), null);
  const { masquerNumero } = await import('./base.ts');
  assert.equal(masquerNumero('+221771234567'), '+22177•••4567');
});
