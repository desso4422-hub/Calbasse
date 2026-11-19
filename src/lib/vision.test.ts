/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corpsRodium, lireJson, normaliser, texteSysteme, validerReponse, type ReponseModele } from './vision.ts';

const repas: ReponseModele = {
  estUnRepas: true,
  nomDuPlat: 'Attiéké poisson',
  confianceGlobale: 'haute',
  composants: [
    { alimentId: 'attieke', grammes: 212, confiance: 'haute', alternatives: ['attieke', 'couscous-mil'], description: '' },
    { alimentId: 'poisson-braise', grammes: 98, confiance: 'moyenne', alternatives: [], description: '' },
  ],
  remarque: ' Bien équilibré. ',
};

test('la réponse est nettoyée : grammes arrondis, alternatives sans doublon ni soi-même', () => {
  const r = normaliser(repas);
  assert.equal(r.nom, 'Attiéké poisson');
  assert.equal(r.remarque, 'Bien équilibré.');
  assert.deepEqual(r.lignes[0], { alimentId: 'attieke', grammes: 210, confiance: 'haute', alternatives: ['couscous-mil'] });
  assert.equal(r.lignes[1].grammes, 100);
});

test('les lignes répétées sont fusionnées et les inconnus mis à part', () => {
  const r = normaliser({
    ...repas,
    composants: [
      { alimentId: 'riz-blanc', grammes: 100, confiance: 'haute', alternatives: [], description: '' },
      { alimentId: 'riz-blanc', grammes: 50, confiance: 'haute', alternatives: [], description: '' },
      { alimentId: 'inconnu', grammes: 40, confiance: 'basse', alternatives: [], description: 'Beignet rond' },
    ],
  });
  assert.equal(r.lignes.length, 1);
  assert.equal(r.lignes[0].grammes, 150);
  assert.deepEqual(r.inconnus, [{ description: 'Beignet rond', grammes: 40 }]);
});

test('un aliment inventé par le modèle est refusé', () => {
  assert.equal(validerReponse({ ...repas, composants: [{ ...repas.composants[0], alimentId: 'pizza-4-fromages' }] }), null);
  assert.equal(validerReponse('bonjour'), null);
  assert.equal(validerReponse({ estUnRepas: true }), null);
});

test('une alternative inconnue est écartée sans jeter la réponse', () => {
  const r = validerReponse({ ...repas, composants: [{ ...repas.composants[0], alternatives: ['couscous-mil', 'sushi'] }] });
  assert.deepEqual(r?.composants[0].alternatives, ['couscous-mil']);
});

test('le JSON entouré de ``` est lu quand même', () => {
  assert.deepEqual(lireJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(lireJson('pas du json'), undefined);
});

test('la requête RodiumAI porte la photo, les consignes et le format attendu', () => {
  const corps = corpsRodium({ systeme: texteSysteme(), texte: 'Indice', image: 'QUJD', typeImage: 'image/jpeg', modele: 'google/gemini-3.1-flash-lite', avecSchema: true }) as any;
  assert.equal(corps.model, 'google/gemini-3.1-flash-lite');
  assert.match(corps.messages[0].content, /Calbasse/);
  assert.match(corps.messages[0].content, /attieke/);
  assert.equal(corps.messages[1].content[0].image_url.url, 'data:image/jpeg;base64,QUJD');
  assert.equal(corps.response_format.type, 'json_schema');

  const sans = corpsRodium({ systeme: 's', texte: 'Indice', image: 'QUJD', typeImage: 'image/jpeg', modele: 'm', avecSchema: false }) as any;
  assert.equal(sans.response_format.type, 'json_object');
  assert.match(sans.messages[1].content[2].text, /schéma/);
});
