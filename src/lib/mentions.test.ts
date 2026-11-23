/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { confidentialite, conditions, enMarkdown, MISE_A_JOUR } from './mentions.ts';

test('la politique dit ce que l’app fait vraiment : photos, prestataires, suppression', () => {
  const texte = confidentialite.map((s) => `${s.titre} ${s.paragraphes.join(' ')}`).join(' ');
  for (const mot of ['photos', 'RodiumAI', 'Google', 'Supabase', 'Effacer mes données', 'ne conserve pas', 'téléphone']) {
    assert.ok(texte.includes(mot), `manque : ${mot}`);
  }
});

test('l’avertissement santé est dans les conditions', () => {
  assert.ok(conditions.some((s) => /médecin|nutritionniste/.test(s.paragraphes.join(' '))));
});

test('le fichier à publier est à jour avec le texte de l’app', () => {
  const publie = readFileSync(new URL('../../docs/confidentialite.md', import.meta.url), 'utf8');
  assert.equal(publie, enMarkdown(), 'lance « npm run mentions »');
  assert.ok(publie.includes(MISE_A_JOUR));
});
