/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculerBilan, dansObjectif, nutrimentLePlusEloigne } from './bilan.ts';
import type { Cibles, Nutriments } from './nutrition.ts';

const cibles: Cibles = { kcal: 2000, prot: 100, gluc: 250, lip: 60 };
const debut = new Date(2026, 0, 5); // lundi
const aujourdhui = new Date(2026, 0, 8); // jeudi

const jour = (kcal: number, repas = 3): Nutriments & { repas: number } => ({ kcal, prot: 100, gluc: 250, lip: 60, repas });
const vide = { kcal: 0, prot: 0, gluc: 0, lip: 0, repas: 0 };

test('un jour est dans l’objectif à 10 % près, au-dessus comme en dessous', () => {
  assert.equal(dansObjectif(2000, 2000), true);
  assert.equal(dansObjectif(1850, 2000), true);
  assert.equal(dansObjectif(2200, 2000), true);
  assert.equal(dansObjectif(2400, 2000), false);
  assert.equal(dansObjectif(1600, 2000), false);
});

test('les moyennes portent sur les jours notés, et couvrent les quatre valeurs', () => {
  const totaux: Record<string, Nutriments & { repas: number }> = {
    '2026-01-05': jour(1800),
    '2026-01-06': jour(2200),
    '2026-01-07': vide, // pas de repas noté : ignoré
  };
  const b = calculerBilan(debut, aujourdhui, cibles, (c) => totaux[c] ?? vide);
  assert.equal(b.joursNotes.length, 2);
  assert.deepEqual(b.moyennes, { kcal: 2000, prot: 100, gluc: 250, lip: 60 });
  assert.equal(b.joursAtteints, 2);
  assert.equal(b.repasNotes, 6);
  assert.equal(b.repasAttendus, 12); // lundi à jeudi
});

test('les jours à venir ne comptent pas', () => {
  const b = calculerBilan(debut, aujourdhui, cibles, () => vide);
  assert.equal(b.jours.filter((j) => j.futur).length, 3); // vendredi, samedi, dimanche
  assert.match(b.message, /Pas encore de repas/);
});

test('le message nomme le nutriment le plus éloigné de sa cible', () => {
  const b = calculerBilan(debut, aujourdhui, cibles, (c) =>
    c === '2026-01-05' ? { kcal: 2000, prot: 40, gluc: 250, lip: 60, repas: 3 } : vide,
  );
  assert.match(b.message, /protéines/);
  assert.match(b.message, /en dessous/);
});

test('aucun nutriment n’est privilégié : le plus éloigné gagne', () => {
  assert.equal(nutrimentLePlusEloigne({ kcal: 2000, prot: 95, gluc: 150, lip: 58 }, cibles)?.cle, 'gluc');
  assert.equal(nutrimentLePlusEloigne({ kcal: 2000, prot: 95, gluc: 245, lip: 100 }, cibles)?.cle, 'lip');
});
