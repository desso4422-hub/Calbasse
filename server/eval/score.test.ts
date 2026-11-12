/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResultatScan } from '../src/reconnaissance.ts';
import { noter, resumer } from './score.ts';

const scan = (lignes: ResultatScan['lignes']): ResultatScan => ({ estUnRepas: true, nom: '', confiance: 'haute', lignes, inconnus: [], remarque: '' });

test('assiette juste', () => {
  const n = noter(scan([{ alimentId: 'attieke', grammes: 240, confiance: 'haute', alternatives: [] }]), { aliments: ['attieke'], grammes: { attieke: 200 } });
  assert.equal(n.exact, true);
  assert.deepEqual(n.ecartsGrammes, [0.2]);
});

test('confusion rattrapable par une alternative', () => {
  const n = noter(scan([{ alimentId: 'couscous-mil', grammes: 240, confiance: 'moyenne', alternatives: ['attieke'] }]), { aliments: ['attieke'] });
  assert.deepEqual(n.manques, ['attieke']);
  assert.deepEqual(n.enTrop, ['couscous-mil']);
  assert.deepEqual(n.rattrapables, ['attieke']);
  const b = resumer([n]);
  assert.equal(b.rappel, 0);
  assert.equal(b.rappelAvecAlternatives, 1);
  assert.deepEqual(b.confusions, { 'attieke → couscous-mil': 1 });
});
