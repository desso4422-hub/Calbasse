/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lienWhatsApp } from './contact.ts';

test('un numéro de téléphone devient un lien WhatsApp, quel que soit son format', () => {
  const attendu = 'https://wa.me/22901020304?text=Bonjour%20%C3%A0%20toi';
  for (const n of ['+229 01 02 03 04', '22901020304', '+229-01-02-03-04', ' +229 (01) 02 03 04 ']) {
    assert.equal(lienWhatsApp(n, 'Bonjour à toi'), attendu, n);
  }
});

test('une adresse e-mail, un texte à compléter ou un numéro absurde ne donnent pas de lien', () => {
  for (const c of ['moi@exemple.com', '[À COMPLÉTER : e-mail ou numéro WhatsApp de contact]', '', '123', '+229 01 02 03 04 05 06 07 08 09 10 11']) {
    assert.equal(lienWhatsApp(c, 'x'), null, c);
  }
});
