/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeEmailValide, decider, emailValide, empreinteDonnees, extraire, fusionner, lireDonnees, type Donnees } from './sauvegarde.ts';
import { erreurAuth } from './session.ts';
import type { Profil, Repas } from '../state/store.tsx';

const profil = (prenom: string): Profil => ({
  prenom,
  mesures: { sexe: 'femme', age: 30, poidsKg: 60, tailleCm: 165, activite: 'leger', objectif: 'perte' },
  cibles: { kcal: 1800, prot: 100, gluc: 200, lip: 60 } as Profil['cibles'],
});
const repas = (id: string, extra: Partial<Repas> = {}): Repas => ({ id, jour: '2026-11-20', heure: '12:00', creneau: 'dejeuner', nom: 'Garba', lignes: [], huile: 'normal', ...extra });

test('extraire : garde le profil et les repas, sans les photos ni les repas d’exemple', () => {
  const d = extraire({ profil: profil('Awa'), repas: [repas('a', { photoUri: 'file:///x.jpg' }), repas('demo-2026-11-01-dejeuner')] });
  assert.equal(d.repas.length, 1);
  assert.equal('photoUri' in d.repas[0], false);
  assert.equal(d.profil?.prenom, 'Awa');
});

test('lireDonnees : écarte ce qui est inutilisable', () => {
  assert.equal(lireDonnees(null), null);
  assert.equal(lireDonnees('x'), null);
  assert.equal(lireDonnees({ profil: 3, repas: 'x' }), null);
  const d = lireDonnees({ profil: profil('Awa'), repas: [repas('a'), { id: 'b' }, null, { ...repas('c'), jour: 'hier' }] });
  assert.deepEqual(d?.repas.map((r) => r.id), ['a']);
  assert.equal(d?.profil?.prenom, 'Awa');
});

test('fusionner : les repas des deux téléphones sont additionnés, le local gagne à identifiant égal', () => {
  const local: Donnees = { v: 1, profil: profil('Local'), repas: [repas('a', { nom: 'Local' }), repas('b')] };
  const serveur: Donnees = { v: 1, profil: profil('Serveur'), repas: [repas('a', { nom: 'Serveur' }), repas('c')] };
  const f = fusionner(local, serveur, false);
  assert.deepEqual(f.repas.map((r) => r.id).sort(), ['a', 'b', 'c']);
  assert.equal(f.repas.find((r) => r.id === 'a')?.nom, 'Local');
  assert.equal(f.profil?.prenom, 'Local');
  assert.equal(fusionner(local, serveur, true).profil?.prenom, 'Serveur', 'à la connexion, le profil retrouvé gagne');
  assert.equal(fusionner({ v: 1, profil: null, repas: [] }, serveur, false).profil?.prenom, 'Serveur', 'rien en local : on prend le serveur');
  assert.equal(fusionner(local, { v: 1, profil: null, repas: [] }, true).profil?.prenom, 'Local', 'rien en ligne : on garde le local');
});

test('empreinte : insensible à l’ordre des repas, sensible à tout changement', () => {
  const a: Donnees = { v: 1, profil: profil('Awa'), repas: [repas('a'), repas('b')] };
  const b: Donnees = { v: 1, profil: profil('Awa'), repas: [repas('b'), repas('a')] };
  assert.equal(empreinteDonnees(a), empreinteDonnees(b));
  assert.notEqual(empreinteDonnees(a), empreinteDonnees({ ...a, repas: [repas('a', { nom: 'Autre' }), repas('b')] }));
  assert.notEqual(empreinteDonnees(a), empreinteDonnees({ ...a, profil: profil('Bintou') }));
});

test('decider : fusionner si un autre téléphone est passé, envoyer si on a changé, sinon rien', () => {
  assert.equal(decider({ revisionServeur: 3, revisionConnue: 2, localChange: false }), 'fusionner');
  assert.equal(decider({ revisionServeur: 3, revisionConnue: 2, localChange: true }), 'fusionner');
  assert.equal(decider({ revisionServeur: 2, revisionConnue: 2, localChange: true }), 'envoyer');
  assert.equal(decider({ revisionServeur: 0, revisionConnue: 0, localChange: true }), 'envoyer');
  assert.equal(decider({ revisionServeur: 2, revisionConnue: 2, localChange: false }), 'rien');
});

test('e-mail et code : validations', () => {
  assert.equal(emailValide('awa@example.com'), true);
  assert.equal(emailValide(' awa@example.com '), true);
  for (const m of ['', 'awa', 'awa@', '@x.com', 'a b@x.com', 'awa@x']) assert.equal(emailValide(m), false, m);
  assert.equal(codeEmailValide('123456'), true);
  assert.equal(codeEmailValide('123 456'), true);
  assert.equal(codeEmailValide('12345'), false);
  assert.equal(codeEmailValide('12345a'), false);
});

test('erreurs d’authentification : messages clairs', () => {
  assert.equal(erreurAuth(0, null).code, 'reseau');
  assert.equal(erreurAuth(422, { error_code: 'email_exists', msg: 'A user with this email address has already been registered' }).code, 'email_existe');
  assert.equal(erreurAuth(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' }).code, 'code_invalide');
  assert.equal(erreurAuth(429, { error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }).code, 'trop_demandes');
  assert.equal(erreurAuth(422, { error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }).code, 'compte_inconnu');
  assert.equal(erreurAuth(400, { error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' }).code, 'email_invalide');
  assert.equal(erreurAuth(500, { msg: 'boom' }).code, 'autre');
});
