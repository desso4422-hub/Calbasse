/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeComplet, formaterCode } from './code.ts';

test('le code est remis en forme, quelle que soit la façon de le saisir ou de le coller', () => {
  const attendu = 'CAL-58B8-4B50-7894';
  for (const saisie of [
    'CAL-58B8-4B50-7894',
    'cal-58b8-4b50-7894',
    'CAL 58B8 4B50 7894',
    ' CAL-58B8-4B50-7894 ',
    'CAL58B84B507894',
    '58B84B507894',
    '58b8 4b50 7894',
    'CAL—58B8—4B50—7894',                 // tirets longs d'un copier-coller
    'CAL-58B8-4B50-7894-ENPLUS',          // ce qui dépasse est ignoré
  ]) {
    assert.equal(formaterCode(saisie), attendu, saisie);
    assert.equal(codeComplet(saisie), true, saisie);
  }
});

test('pendant la frappe, le code se met en forme sans gêner', () => {
  assert.equal(formaterCode(''), '');
  assert.equal(formaterCode('c'), 'C');
  assert.equal(formaterCode('ca'), 'CA');
  assert.equal(formaterCode('cal'), 'CAL');
  assert.equal(formaterCode('cal5'), 'CAL-5');
  assert.equal(formaterCode('CAL-58B8'), 'CAL-58B8');
  assert.equal(formaterCode('CAL-58B8-4'), 'CAL-58B8-4');
});

test('un code incomplet ou inconnu n’est pas envoyé', () => {
  for (const mauvais of ['', 'CAL', 'CAL-58B8', '58B84B50789', 'bonjour']) {
    assert.equal(codeComplet(mauvais), false, mauvais);
  }
});
