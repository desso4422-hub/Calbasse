/**
 * Données du serveur : comptes, quota de scans, abonnements et paiements.
 * SQLite intégré à Node (node:sqlite), un seul fichier : DATA_DIR/calbasse.db.
 *
 * Les comptes sont anonymes : l'app en crée un au premier lancement et garde son jeton.
 * Seule l'empreinte SHA-256 du jeton est stockée.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SCANS_GRATUITS = 2;
export const SCANS_PREMIUM = 30;

export type Plan = 'mensuel' | 'annuel';

export const TARIFS: Record<Plan, { montant: number; jours: number }> = {
  mensuel: { montant: 2000, jours: 30 },
  annuel: { montant: 20000, jours: 365 },
};

export type Compte = { id: string; premiumJusquau: string | null; plan: Plan | null };

export type Paiement = {
  transactionId: string;
  compteId: string;
  plan: Plan;
  montant: number;
  statut: 'en_attente' | 'accepte' | 'refuse';
};

/** Date AAAA-MM-JJ dans le fuseau donné (le « jour » des quotas suit l'heure locale des utilisateurs). */
export function jourLocal(d: Date, fuseau: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export class Base {
  private readonly db: DatabaseSync;
  private readonly fuseau: string;
  private readonly maintenant: () => Date;

  /** fichier : chemin de la base, ou ':memory:' pour les tests */
  constructor(fichier: string, fuseau: string, maintenant: () => Date = () => new Date()) {
    if (fichier !== ':memory:') mkdirSync(path.dirname(fichier), { recursive: true });
    this.db = new DatabaseSync(fichier);
    this.fuseau = fuseau;
    this.maintenant = maintenant;
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS comptes (
        id TEXT PRIMARY KEY,
        jeton TEXT NOT NULL UNIQUE,
        cree_le TEXT NOT NULL,
        premium_jusquau TEXT,
        plan TEXT
      );
      CREATE TABLE IF NOT EXISTS scans (
        compte_id TEXT NOT NULL,
        jour TEXT NOT NULL,
        nombre INTEGER NOT NULL,
        PRIMARY KEY (compte_id, jour)
      );
      CREATE TABLE IF NOT EXISTS paiements (
        transaction_id TEXT PRIMARY KEY,
        compte_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        montant INTEGER NOT NULL,
        statut TEXT NOT NULL,
        cree_le TEXT NOT NULL,
        maj_le TEXT NOT NULL,
        details TEXT
      );
    `);
  }

  aujourdhui(): string {
    return jourLocal(this.maintenant(), this.fuseau);
  }

  // ——— Comptes ———

  creerCompte(): { compte: Compte; jeton: string } {
    const id = randomUUID();
    const jeton = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO comptes (id, jeton, cree_le) VALUES (?, ?, ?)').run(id, empreinte(jeton), this.maintenant().toISOString());
    return { compte: { id, premiumJusquau: null, plan: null }, jeton };
  }

  compteParJeton(jeton: string): Compte | null {
    const l = this.db.prepare('SELECT id, premium_jusquau, plan FROM comptes WHERE jeton = ?').get(empreinte(jeton)) as
      | { id: string; premium_jusquau: string | null; plan: Plan | null }
      | undefined;
    return l ? { id: l.id, premiumJusquau: l.premium_jusquau, plan: l.plan } : null;
  }

  compte(id: string): Compte | null {
    const l = this.db.prepare('SELECT id, premium_jusquau, plan FROM comptes WHERE id = ?').get(id) as
      | { id: string; premium_jusquau: string | null; plan: Plan | null }
      | undefined;
    return l ? { id: l.id, premiumJusquau: l.premium_jusquau, plan: l.plan } : null;
  }

  estPremium(c: Compte): boolean {
    return !!c.premiumJusquau && c.premiumJusquau >= this.aujourdhui();
  }

  // ——— Quota de scans ———

  limite(c: Compte): number {
    return this.estPremium(c) ? SCANS_PREMIUM : SCANS_GRATUITS;
  }

  scansUtilises(compteId: string): number {
    const l = this.db.prepare('SELECT nombre FROM scans WHERE compte_id = ? AND jour = ?').get(compteId, this.aujourdhui()) as { nombre: number } | undefined;
    return l?.nombre ?? 0;
  }

  scansRestants(c: Compte): number {
    return Math.max(0, this.limite(c) - this.scansUtilises(c.id));
  }

  /** Décompte un scan réussi. */
  compterScan(compteId: string): void {
    this.db
      .prepare('INSERT INTO scans (compte_id, jour, nombre) VALUES (?, ?, 1) ON CONFLICT (compte_id, jour) DO UPDATE SET nombre = nombre + 1')
      .run(compteId, this.aujourdhui());
  }

  etatCompte(c: Compte) {
    return {
      premium: this.estPremium(c) ? { plan: c.plan, jusquau: c.premiumJusquau } : null,
      scansRestants: this.scansRestants(c),
      limite: this.limite(c),
    };
  }

  // ——— Paiements ———

  creerPaiement(compteId: string, plan: Plan): Paiement {
    // Identifiant court et unique, sans caractère spécial (accepté par les agrégateurs de paiement)
    const transactionId = `CB${Date.now().toString(36)}${randomBytes(4).toString('hex')}`.toUpperCase();
    const maintenant = this.maintenant().toISOString();
    const montant = TARIFS[plan].montant;
    this.db
      .prepare("INSERT INTO paiements (transaction_id, compte_id, plan, montant, statut, cree_le, maj_le) VALUES (?, ?, ?, ?, 'en_attente', ?, ?)")
      .run(transactionId, compteId, plan, montant, maintenant, maintenant);
    return { transactionId, compteId, plan, montant, statut: 'en_attente' };
  }

  paiement(transactionId: string): Paiement | null {
    const l = this.db.prepare('SELECT transaction_id, compte_id, plan, montant, statut FROM paiements WHERE transaction_id = ?').get(transactionId) as
      | { transaction_id: string; compte_id: string; plan: Plan; montant: number; statut: Paiement['statut'] }
      | undefined;
    return l ? { transactionId: l.transaction_id, compteId: l.compte_id, plan: l.plan, montant: l.montant, statut: l.statut } : null;
  }

  /**
   * Paiement confirmé par CinetPay : active ou prolonge Premium. Idempotent : une notification
   * reçue deux fois n'ajoute pas deux fois la durée.
   */
  validerPaiement(transactionId: string, details: object): boolean {
    const p = this.paiement(transactionId);
    if (!p || p.statut === 'accepte') return false;
    const c = this.compte(p.compteId);
    if (!c) return false;
    const depart = c.premiumJusquau && c.premiumJusquau >= this.aujourdhui() ? c.premiumJusquau : this.aujourdhui();
    const jusquau = ajouterJours(depart, TARIFS[p.plan].jours);
    const maintenant = this.maintenant().toISOString();
    this.db.exec('BEGIN');
    try {
      this.db.prepare("UPDATE paiements SET statut = 'accepte', maj_le = ?, details = ? WHERE transaction_id = ? AND statut != 'accepte'").run(maintenant, JSON.stringify(details), transactionId);
      this.db.prepare('UPDATE comptes SET premium_jusquau = ?, plan = ? WHERE id = ?').run(jusquau, p.plan, p.compteId);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return true;
  }

  refuserPaiement(transactionId: string, details: object): void {
    this.db
      .prepare("UPDATE paiements SET statut = 'refuse', maj_le = ?, details = ? WHERE transaction_id = ? AND statut = 'en_attente'")
      .run(this.maintenant().toISOString(), JSON.stringify(details), transactionId);
  }

  fermer(): void {
    this.db.close();
  }
}
