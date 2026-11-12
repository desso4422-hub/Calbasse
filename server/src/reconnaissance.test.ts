/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idsAliments, texteCatalogue } from './catalogue.ts';
import { analyserRepas, construireRequete, normaliser, RefusModele, type ClientVision, type ReponseModele } from './reconnaissance.ts';

const options = { modele: 'claude-opus-5-5', effort: 'medium' as const };

function fauxClient(reponse: { stop_reason: string; parsed_output: ReponseModele | null }, appels: unknown[] = []): ClientVision {
  return {
    beta: {
      messages: {
        parse: (async (params: unknown) => {
          appels.push(params);
          return { ...reponse, usage: {} };
        }) as unknown as ClientVision['beta']['messages']['parse'],
      },
    },
  };
}

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

test("la requête : image, indice, catalogue en cache, repli en cas de refus", () => {
  const r = construireRequete('QUJD', 'image/jpeg', '  du garba bien pimenté ', options);
  assert.equal(r.model, 'claude-opus-5-5');
  assert.equal(r.fallbacks, 'default');
  assert.deepEqual(r.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(r.output_config.effort, 'medium');
  assert.deepEqual(r.system[0].cache_control, { type: 'ephemeral' });
  const [image, texte] = r.messages[0].content;
  assert.equal(image.type, 'image');
  assert.ok(texte.type === 'text' && texte.text.includes('« du garba bien pimenté »'));
  // Rien de variable dans le prompt système
  assert.equal(construireRequete('X', 'image/png', 'autre', options).system[0].text, r.system[0].text);
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
  const { resultat } = await analyserRepas(fauxClient({ stop_reason: 'end_turn', parsed_output: garba }, appels), 'QUJD', 'image/jpeg', '', options);
  assert.equal(appels.length, 1);
  assert.equal(resultat.lignes.length, 2);
});

test('refus du modèle et réponse illisible', async () => {
  await assert.rejects(analyserRepas(fauxClient({ stop_reason: 'refusal', parsed_output: null }), 'X', 'image/jpeg', '', options), RefusModele);
  await assert.rejects(analyserRepas(fauxClient({ stop_reason: 'max_tokens', parsed_output: null }), 'X', 'image/jpeg', '', options), /non exploitable/);
});
