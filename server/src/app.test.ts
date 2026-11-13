/// <reference types="node" />
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { GenerateContentResponse } from '@google/genai';
import { creerApplication } from './app.ts';
import { Base, jourLocal } from './base.ts';
import type { ClientHttp } from './cinetpay.ts';
import { Journal } from './journal.ts';
import { fournisseurGemini, type ClientVision, type ReponseModele } from './reconnaissance.ts';

// ——— Faux services ———

let horloge = new Date('2026-11-13T10:00:00Z');
const base = new Base(':memory:', 'Africa/Lagos', () => horloge);

let prochaineReponse: ReponseModele;
const repas: ReponseModele = {
  estUnRepas: true,
  nomDuPlat: 'Garba',
  confianceGlobale: 'haute',
  composants: [{ alimentId: 'attieke', grammes: 250, confiance: 'haute', alternatives: [], description: '' }],
  remarque: '',
};
const pasUnRepas: ReponseModele = { estUnRepas: false, nomDuPlat: '', confianceGlobale: 'basse', composants: [], remarque: 'Un chat.' };
let appelsVision = 0;
let delaiVision = 0;
const clientGemini: ClientVision = {
  models: {
    generateContent: async () => {
      appelsVision += 1;
      if (delaiVision) await new Promise((r) => setTimeout(r, delaiVision));
      return { text: JSON.stringify(prochaineReponse), candidates: [{ finishReason: 'STOP' }] } as unknown as GenerateContentResponse;
    },
  },
};

/** Faux CinetPay : statut renvoyé par /payment/check, et appels reçus */
const statutsCinetPay = new Map<string, { status: string; amount: string; currency: string }>();
const appelsCinetPay: { url: string; corps: Record<string, unknown> }[] = [];
const httpCinetPay: ClientHttp = async (entree, init) => {
  const url = String(entree);
  const corps = JSON.parse(String(init?.body)) as Record<string, unknown>;
  appelsCinetPay.push({ url, corps });
  const json = (o: object) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/payment')) return json({ code: '201', message: 'CREATED', data: { payment_url: `https://checkout.exemple/${corps.transaction_id}` } });
  const s = statutsCinetPay.get(String(corps.transaction_id));
  return json(s ? { code: '00', message: 'SUCCES', data: s } : { code: '662', message: 'WAITING_CUSTOMER_PAYMENT', data: { status: 'PENDING' } });
};

const smsEnvoyes: { numero: string; message: string }[] = [];
const dernierCode = (numero: string) => smsEnvoyes.filter((s) => s.numero === numero).at(-1)!.message.match(/\d{6}/)![0];

const serveur = creerApplication({
  base,
  vision: fournisseurGemini(clientGemini),
  options: { modele: 'test' },
  journal: new Journal('/tmp/claude-0/calbasse-tests-journal', false),
  cinetpay: { apiKey: 'cle', siteId: '123', urlApi: 'https://cinetpay.exemple/v2', urlPublique: 'https://api.calbasse.exemple' },
  http: httpCinetPay,
  sms: { envoyer: async (numero, message) => void smsEnvoyes.push({ numero, message }) },
  comptesParHeure: 1000,
  requetesParHeure: 1000,
});
let racine = '';
before(async () => {
  await new Promise<void>((ok) => serveur.listen(0, ok));
  racine = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
});
after(() => {
  serveur.close();
  base.fermer();
});

async function appel(chemin: string, init: { methode?: string; jeton?: string; corps?: unknown; type?: string } = {}) {
  const r = await fetch(racine + chemin, {
    method: init.methode ?? (init.corps !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(init.jeton ? { Authorization: `Bearer ${init.jeton}` } : {}),
      'Content-Type': init.type ?? 'application/json',
    },
    body: init.corps === undefined ? undefined : typeof init.corps === 'string' ? init.corps : JSON.stringify(init.corps),
  });
  const texte = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(texte);
  } catch {
    /* page HTML */
  }
  return { statut: r.status, json, texte };
}

async function nouveauCompte(): Promise<string> {
  const r = await appel('/comptes', { corps: {} });
  assert.equal(r.statut, 201);
  return r.json.jeton as string;
}

const photo = { image: 'QUJD', indice: '' };

// ——— Tests ———

test('un compte anonyme, et rien sans jeton', async () => {
  const r = await appel('/comptes', { corps: {} });
  assert.equal(r.statut, 201);
  assert.equal(typeof r.json.jeton, 'string');
  assert.deepEqual({ premium: r.json.premium, scansRestants: r.json.scansRestants, limite: r.json.limite }, { premium: null, scansRestants: 2, limite: 2 });
  assert.equal((await appel('/compte')).statut, 401);
  assert.equal((await appel('/compte', { jeton: 'faux' })).statut, 401);
  assert.equal((await appel('/scan', { corps: photo })).statut, 401);
});

test('quota gratuit compté sur le serveur : 2 scans, puis 402 ; une photo sans repas ne compte pas', async () => {
  const jeton = await nouveauCompte();
  prochaineReponse = pasUnRepas;
  const r0 = await appel('/scan', { jeton, corps: photo });
  assert.equal(r0.statut, 200);
  assert.equal((r0.json.compte as { scansRestants: number }).scansRestants, 2);

  prochaineReponse = repas;
  assert.equal(((await appel('/scan', { jeton, corps: photo })).json.compte as { scansRestants: number }).scansRestants, 1);
  assert.equal(((await appel('/scan', { jeton, corps: photo })).json.compte as { scansRestants: number }).scansRestants, 0);
  const r3 = await appel('/scan', { jeton, corps: photo });
  assert.equal(r3.statut, 402);
  assert.equal(r3.json.code, 'quota');

  // Le lendemain (heure de Lagos), le quota repart
  const avant = horloge;
  horloge = new Date(avant.getTime() + 24 * 3600_000);
  assert.equal((await appel('/compte', { jeton })).json.scansRestants, 2);
  horloge = avant;
});

test("paiement CinetPay : création, notification revérifiée, Premium activé une seule fois", async () => {
  const jeton = await nouveauCompte();
  const r = await appel('/paiements', { jeton, corps: { plan: 'mensuel' } });
  assert.equal(r.statut, 201);
  const transactionId = r.json.transactionId as string;
  assert.equal(r.json.urlPaiement, `https://checkout.exemple/${transactionId}`);

  const creation = appelsCinetPay.find((a) => a.url.endsWith('/payment') && a.corps.transaction_id === transactionId)!;
  assert.equal(creation.corps.amount, 2000);
  assert.equal(creation.corps.currency, 'XOF');
  assert.equal(creation.corps.notify_url, 'https://api.calbasse.exemple/cinetpay/notification');

  // Avant le paiement : en attente
  assert.equal((await appel(`/paiements/${transactionId}`, { jeton })).json.statut, 'en_attente');

  // CinetPay notifie (formulaire), le serveur redemande le statut et active Premium
  statutsCinetPay.set(transactionId, { status: 'ACCEPTED', amount: '2000', currency: 'XOF' });
  const notif = `cpm_site_id=123&cpm_trans_id=${transactionId}`;
  assert.equal((await appel('/cinetpay/notification', { corps: notif, type: 'application/x-www-form-urlencoded' })).statut, 200);
  const etat = (await appel('/compte', { jeton })).json;
  assert.deepEqual(etat.premium, { plan: 'mensuel', jusquau: '2026-12-13' });
  assert.equal(etat.limite, 30);

  // Notification reçue une deuxième fois : pas 30 jours de plus
  await appel('/cinetpay/notification', { corps: notif, type: 'application/x-www-form-urlencoded' });
  assert.deepEqual((await appel('/compte', { jeton })).json.premium, { plan: 'mensuel', jusquau: '2026-12-13' });

  // Un deuxième achat prolonge à partir de la date de fin
  const r2 = await appel('/paiements', { jeton, corps: { plan: 'annuel' } });
  const t2 = r2.json.transactionId as string;
  statutsCinetPay.set(t2, { status: 'ACCEPTED', amount: '20000', currency: 'XOF' });
  const via = await appel(`/paiements/${t2}`, { jeton }); // l'app peut aussi demander le statut elle-même
  assert.equal(via.json.statut, 'accepte');
  assert.deepEqual((await appel('/compte', { jeton })).json.premium, { plan: 'annuel', jusquau: '2027-12-13' });
});

test('paiement : montant ou devise inattendus, notification forgée, paiement d’un autre compte', async () => {
  const jeton = await nouveauCompte();
  const r = await appel('/paiements', { jeton, corps: { plan: 'annuel' } });
  const t = r.json.transactionId as string;
  statutsCinetPay.set(t, { status: 'ACCEPTED', amount: '100', currency: 'XOF' });
  await appel('/cinetpay/notification', { corps: `cpm_trans_id=${t}`, type: 'application/x-www-form-urlencoded' });
  assert.equal((await appel('/compte', { jeton })).json.premium, null);

  // Une notification ne suffit jamais : sans paiement connu ni statut ACCEPTED, rien ne se passe
  assert.equal((await appel('/cinetpay/notification', { corps: 'cpm_trans_id=INVENTE', type: 'application/x-www-form-urlencoded' })).statut, 200);

  const autre = await nouveauCompte();
  assert.equal((await appel(`/paiements/${t}`, { jeton: autre })).statut, 404);
  assert.equal((await appel('/paiements', { jeton, corps: { plan: 'gratuit-a-vie' } })).statut, 400);
});

test('paiement refusé par CinetPay', async () => {
  const jeton = await nouveauCompte();
  const t = (await appel('/paiements', { jeton, corps: { plan: 'mensuel' } })).json.transactionId as string;
  statutsCinetPay.set(t, { status: 'REFUSED', amount: '2000', currency: 'XOF' });
  assert.equal((await appel(`/paiements/${t}`, { jeton })).json.statut, 'refuse');
});

test('pages pour CinetPay : vérification de l’adresse et page de retour', async () => {
  assert.equal((await appel('/cinetpay/notification')).statut, 200);
  const retour = await appel('/cinetpay/retour');
  assert.equal(retour.statut, 200);
  assert.ok(retour.texte.includes('calbasse://premium'));
});

test('jour local : minuit à Lagos', () => {
  assert.equal(jourLocal(new Date('2026-11-13T22:59:00Z'), 'Africa/Lagos'), '2026-11-13');
  assert.equal(jourLocal(new Date('2026-11-13T23:01:00Z'), 'Africa/Lagos'), '2026-11-14');
});

test('téléphone : code par SMS, mauvais code, rattachement au compte', async () => {
  const jeton = await nouveauCompte();
  const r = await appel('/telephone/code', { jeton, corps: { numero: '01 97 11 22 33', indicatif: '229' } });
  assert.equal(r.statut, 200);
  assert.equal(r.json.numero, '+22901••••2233');
  const code = dernierCode('+2290197112233');
  assert.equal((await appel('/telephone/verifier', { jeton, corps: { numero: '+229 01 97 11 22 33', code: '000000' === code ? '111111' : '000000' } })).json.code, 'invalide');
  const ok = await appel('/telephone/verifier', { jeton, corps: { numero: '+229 01 97 11 22 33', code } });
  assert.equal(ok.statut, 200);
  assert.equal(ok.json.recupere, false);
  assert.equal(ok.json.jeton, null);
  assert.equal((await appel('/compte', { jeton })).json.telephone, '+22901••••2233');
  // Un code ne sert qu'une fois
  assert.equal((await appel('/telephone/verifier', { jeton, corps: { numero: '+2290197112233', code } })).statut, 400);
});

test('téléphone perdu : le nouvel appareil récupère Premium, l’ancien est déconnecté', async () => {
  // Ancien téléphone : Premium + numéro vérifié
  const ancien = await nouveauCompte();
  const t = (await appel('/paiements', { jeton: ancien, corps: { plan: 'annuel' } })).json.transactionId as string;
  statutsCinetPay.set(t, { status: 'ACCEPTED', amount: '20000', currency: 'XOF' });
  await appel(`/paiements/${t}`, { jeton: ancien });
  await appel('/telephone/code', { jeton: ancien, corps: { numero: '+2250707000001' } });
  await appel('/telephone/verifier', { jeton: ancien, corps: { numero: '+2250707000001', code: dernierCode('+2250707000001') } });

  // Nouveau téléphone : compte vierge, a déjà fait un scan aujourd'hui
  const nouveau = await nouveauCompte();
  prochaineReponse = repas;
  await appel('/scan', { jeton: nouveau, corps: photo });
  await appel('/telephone/code', { jeton: nouveau, corps: { numero: '07 07 00 00 01', indicatif: '225' } });
  const r = await appel('/telephone/verifier', { jeton: nouveau, corps: { numero: '+2250707000001', code: dernierCode('+2250707000001') } });
  assert.equal(r.statut, 200);
  assert.equal(r.json.recupere, true);
  assert.deepEqual(r.json.premium, { plan: 'annuel', jusquau: '2027-11-13' });
  assert.equal(r.json.scansRestants, 29); // le scan du nouvel appareil est compté

  const nouveauJeton = r.json.jeton as string;
  assert.equal((await appel('/compte', { jeton: nouveauJeton })).statut, 200);
  assert.equal((await appel('/compte', { jeton: ancien })).statut, 401); // ancien appareil déconnecté
  assert.equal((await appel('/compte', { jeton: nouveau })).statut, 401); // compte temporaire fusionné
  assert.equal((await appel(`/paiements/${t}`, { jeton: nouveauJeton })).json.statut, 'accepte');
});

test('téléphone : limites contre les abus et numéros invalides', async () => {
  const jeton = await nouveauCompte();
  assert.equal((await appel('/telephone/code', { jeton, corps: { numero: '12' , indicatif: '229' } })).statut, 400);
  assert.equal((await appel('/telephone/code', { jeton, corps: { numero: '0197000000' } })).statut, 400); // sans indicatif
  const numero = '+221770000009';
  for (let i = 0; i < 3; i++) assert.equal((await appel('/telephone/code', { jeton, corps: { numero } })).statut, 200);
  assert.equal((await appel('/telephone/code', { jeton, corps: { numero } })).statut, 429);

  // 5 mauvais codes : le code est grillé, même le bon ne passe plus
  const autre = await nouveauCompte();
  const n2 = '+221770000010';
  await appel('/telephone/code', { jeton: autre, corps: { numero: n2 } });
  const bon = dernierCode(n2);
  const faux = bon === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await appel('/telephone/verifier', { jeton: autre, corps: { numero: n2, code: faux } });
  assert.equal((await appel('/telephone/verifier', { jeton: autre, corps: { numero: n2, code: bon } })).json.code, 'trop_essais');

  // Code expiré
  const n3 = '+221770000011';
  await appel('/telephone/code', { jeton: autre, corps: { numero: n3 } });
  const avant = horloge;
  horloge = new Date(avant.getTime() + 11 * 60_000);
  assert.equal((await appel('/telephone/verifier', { jeton: autre, corps: { numero: n3, code: dernierCode(n3) } })).json.code, 'expire');
  horloge = avant;
});

test('même photo renvoyée (coupure réseau) : une seule analyse, un seul scan décompté', async () => {
  const jeton = await nouveauCompte();
  prochaineReponse = repas;
  const avant = appelsVision;
  const r1 = await appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0001-abcd' } });
  const r2 = await appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0001-abcd' } });
  assert.equal(r1.statut, 200);
  assert.equal(r2.json.scanId, r1.json.scanId);
  assert.equal(appelsVision - avant, 1);
  assert.equal((r2.json.compte as { scansRestants: number }).scansRestants, 1);

  // Deux envois simultanés de la même photo : une seule analyse
  delaiVision = 150;
  const [a, b] = await Promise.all([
    appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0002-abcd' } }),
    appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0002-abcd' } }),
  ]);
  delaiVision = 0;
  assert.equal(a.json.scanId, b.json.scanId);
  assert.equal(appelsVision - avant, 2);
  assert.equal((await appel('/compte', { jeton })).json.scansRestants, 0);

  // Le résultat déjà rendu reste disponible même quota épuisé ; une nouvelle photo, non
  assert.equal((await appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0001-abcd' } })).statut, 200);
  assert.equal((await appel('/scan', { jeton, corps: { ...photo, cle: 'photo-0003-abcd' } })).statut, 402);
});

test('quota gratuit réglable (testeurs du MVP)', () => {
  const b = new Base(':memory:', 'Africa/Lagos', () => horloge, { gratuit: 10, premium: 30 });
  const { compte } = b.creerCompte();
  assert.equal(b.scansRestants(compte), 10);
  b.fermer();
});
