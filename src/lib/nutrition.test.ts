/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquerPortion,
  arrondirNutriments,
  calculerCibles,
  formater,
  fourchette,
  lundi,
  cleJour,
  periode,
  totalRepas,
} from './nutrition.ts';
import { trouverPlat, chercherPlatParTexte, nommerRepas } from './plats.ts';
import { rechercherAliments } from './aliments.ts';

const rizPoulet = trouverPlat('riz-gras-poulet')!.lignes;

test('riz au gras + poulet frit : on retrouve les chiffres de la maquette (865 kcal, 39 g)', () => {
  const t = arrondirNutriments(totalRepas(rizPoulet, 'normal'));
  assert.ok(Math.abs(t.kcal - 865) <= 5, `kcal ${t.kcal}`);
  assert.equal(t.prot, 39);
});

test("l'huile ajuste les calories et les lipides, pas les protéines", () => {
  const normal = totalRepas(rizPoulet, 'normal');
  const beaucoup = totalRepas(rizPoulet, 'beaucoup');
  const peu = totalRepas(rizPoulet, 'peu');
  assert.equal(Math.round(beaucoup.kcal - normal.kcal), 150);
  assert.equal(Math.round(peu.kcal - normal.kcal), -80);
  assert.equal(beaucoup.prot, normal.prot);
});

test('la portion change le riz et la sauce, pas la cuisse de poulet', () => {
  const grande = appliquerPortion(rizPoulet, 'L');
  assert.equal(grande.find((l) => l.alimentId === 'riz-au-gras')!.grammes, 405);
  assert.equal(grande.find((l) => l.alimentId === 'poulet-frit')!.grammes, 140);
  const petite = appliquerPortion(rizPoulet, 'S');
  assert.equal(petite.find((l) => l.alimentId === 'riz-au-gras')!.grammes, 210);
});

test('fourchette autour de la valeur estimée', () => {
  assert.deepEqual(fourchette(865), { bas: 800, haut: 930 });
});

test('formatage français des nombres', () => {
  assert.equal(formater(1385), '1 385');
  assert.equal(formater(865), '865');
  assert.equal(formater(20000), '20 000');
});

test('cibles : prise de masse à 70 kg → 140 g de protéines', () => {
  const c = calculerCibles({ sexe: 'homme', age: 25, poidsKg: 70, tailleCm: 178, activite: 'actif', objectif: 'masse' });
  assert.equal(c.prot, 140);
  assert.ok(c.kcal > 2700 && c.kcal < 3100, `kcal ${c.kcal}`);
  // Les macros retombent à peu près sur les calories
  const somme = c.prot * 4 + c.gluc * 4 + c.lip * 9;
  assert.ok(Math.abs(somme - c.kcal) < 60);
});

test('cibles : la perte de poids ne descend pas sous le plancher', () => {
  const c = calculerCibles({ sexe: 'femme', age: 60, poidsKg: 45, tailleCm: 150, activite: 'sedentaire', objectif: 'perte' });
  assert.ok(c.kcal >= 1200);
});

test('semaine : lundi et période', () => {
  const mercredi = new Date(2026, 10, 11);
  assert.equal(cleJour(lundi(mercredi)), '2026-11-09');
  const dimanche = new Date(2026, 10, 15);
  assert.equal(cleJour(lundi(dimanche)), '2026-11-09');
  assert.equal(periode(new Date(2026, 10, 2), new Date(2026, 10, 8)), 'du 2 au 8 novembre');
});

test('recherche tolérante aux accents et aux noms locaux', () => {
  assert.equal(rechercherAliments('attieke')[0].id, 'attieke');
  assert.equal(rechercherAliments('amiwo')[0].id, 'pate-rouge');
  assert.ok(rechercherAliments('', 'sauces').every((a) => a.categorie === 'sauces'));
});

test("l'indice texte du scanner retrouve le plat", () => {
  assert.equal(chercherPlatParTexte('attiéké avec poisson braisé')?.id, 'attieke-poisson');
  assert.equal(chercherPlatParTexte('du garba')?.id, 'garba');
  assert.equal(chercherPlatParTexte('thieb au poisson')?.id, 'thieboudienne');
  assert.equal(chercherPlatParTexte('Riz au gras et poulet')?.id, 'riz-gras-poulet');
  assert.equal(chercherPlatParTexte('rien à voir'), undefined);
});

test('nom du repas', () => {
  assert.equal(nommerRepas(['Riz au gras', 'Poulet frit']), 'Riz au gras, poulet frit');
});

test('indice libre : aliments isolés sans doublons', async () => {
  const { reconnaitreDepuisTexte } = await import('../services/reconnaissance.ts');
  const r = reconnaitreDepuisTexte('riz, sauce graine, poulet, un peu d’huile');
  assert.deepEqual(r.lignes.map((l) => l.alimentId), ['riz-blanc', 'sauce-graine', 'poulet-frit']);
  const r2 = reconnaitreDepuisTexte('attiéké et alloco');
  assert.deepEqual(r2.lignes.map((l) => l.alimentId), ['attieke', 'alloco']);
});
