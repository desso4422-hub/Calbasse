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

export type Compte = { id: string; premiumJusquau: string | null; plan: Plan | null; telephone: string | null };

/** Durée de validité d'un code SMS, et limites contre les abus */
export const CODE_VALIDITE_MS = 10 * 60_000;
export const CODE_ESSAIS_MAX = 5;
export const CODES_PAR_NUMERO_PAR_HEURE = 3;
export const CODES_PAR_COMPTE_PAR_HEURE = 5;

export type ResultatCode = 'ok' | 'invalide' | 'expire' | 'trop_essais';

/** Masque un numéro pour l'affichage : +229 01 •• •• 34 56 → « +22901••••3456 » */
export function masquerNumero(numero: string): string {
  return numero.length <= 8 ? numero : `${numero.slice(0, 6)}${'•'.repeat(Math.max(1, numero.length - 10))}${numero.slice(-4)}`;
}

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
  private readonly limites: { gratuit: number; premium: number };

  /** fichier : chemin de la base, ou ':memory:' pour les tests */
  constructor(
    fichier: string,
    fuseau: string,
    maintenant: () => Date = () => new Date(),
    limites: { gratuit: number; premium: number } = { gratuit: SCANS_GRATUITS, premium: SCANS_PREMIUM },
  ) {
    this.limites = limites;
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
      CREATE TABLE IF NOT EXISTS codes_telephone (
        numero TEXT NOT NULL,
        compte_id TEXT NOT NULL,
        code TEXT NOT NULL,
        cree_le INTEGER NOT NULL,
        expire_le INTEGER NOT NULL,
        essais INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS scans_rendus (
        cle TEXT NOT NULL,
        compte_id TEXT NOT NULL,
        reponse TEXT NOT NULL,
        cree_le INTEGER NOT NULL,
        PRIMARY KEY (compte_id, cle)
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
    // Migration : numéro de téléphone (ajouté après la première version)
    const colonnes = this.db.prepare('PRAGMA table_info(comptes)').all() as { name: string }[];
    if (!colonnes.some((c) => c.name === 'telephone')) {
      this.db.exec('ALTER TABLE comptes ADD COLUMN telephone TEXT');
    }
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS comptes_telephone ON comptes (telephone)');
  }

  aujourdhui(): string {
    return jourLocal(this.maintenant(), this.fuseau);
  }

  // ——— Comptes ———

  creerCompte(): { compte: Compte; jeton: string } {
    const id = randomUUID();
    const jeton = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO comptes (id, jeton, cree_le) VALUES (?, ?, ?)').run(id, empreinte(jeton), this.maintenant().toISOString());
    return { compte: { id, premiumJusquau: null, plan: null, telephone: null }, jeton };
  }

  compteParJeton(jeton: string): Compte | null {
    return this.lireCompte(this.db.prepare('SELECT id, premium_jusquau, plan, telephone FROM comptes WHERE jeton = ?').get(empreinte(jeton)));
  }

  compte(id: string): Compte | null {
    return this.lireCompte(this.db.prepare('SELECT id, premium_jusquau, plan, telephone FROM comptes WHERE id = ?').get(id));
  }

  private lireCompte(ligne: unknown): Compte | null {
    const l = ligne as { id: string; premium_jusquau: string | null; plan: Plan | null; telephone: string | null } | undefined;
    return l ? { id: l.id, premiumJusquau: l.premium_jusquau, plan: l.plan, telephone: l.telephone } : null;
  }

  estPremium(c: Compte): boolean {
    return !!c.premiumJusquau && c.premiumJusquau >= this.aujourdhui();
  }

  // ——— Quota de scans ———

  limite(c: Compte): number {
    return this.estPremium(c) ? this.limites.premium : this.limites.gratuit;
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

  // ——— Scans déjà rendus (renvoi de la même photo après une coupure réseau) ———

  scanRendu(compteId: string, cle: string): object | null {
    const l = this.db.prepare('SELECT reponse FROM scans_rendus WHERE compte_id = ? AND cle = ?').get(compteId, cle) as { reponse: string } | undefined;
    return l ? (JSON.parse(l.reponse) as object) : null;
  }

  memoriserScan(compteId: string, cle: string, reponse: object): void {
    const maintenant = this.maintenant().getTime();
    this.db.prepare('DELETE FROM scans_rendus WHERE cree_le < ?').run(maintenant - 2 * 86_400_000); // 48 h suffisent
    this.db.prepare('INSERT OR REPLACE INTO scans_rendus (cle, compte_id, reponse, cree_le) VALUES (?, ?, ?, ?)').run(cle, compteId, JSON.stringify(reponse), maintenant);
  }

  etatCompte(c: Compte) {
    return {
      premium: this.estPremium(c) ? { plan: c.plan, jusquau: c.premiumJusquau } : null,
      scansRestants: this.scansRestants(c),
      limite: this.limite(c),
      telephone: c.telephone ? masquerNumero(c.telephone) : null,
    };
  }

  // ——— Téléphone : codes SMS et récupération de compte ———

  /** Enregistre un code à envoyer. false si trop de codes ont été demandés récemment. */
  enregistrerCode(compteId: string, numero: string, code: string): boolean {
    const maintenant = this.maintenant().getTime();
    const depuis = maintenant - 3_600_000;
    const parNumero = this.db.prepare('SELECT COUNT(*) AS n FROM codes_telephone WHERE numero = ? AND cree_le > ?').get(numero, depuis) as { n: number };
    const parCompte = this.db.prepare('SELECT COUNT(*) AS n FROM codes_telephone WHERE compte_id = ? AND cree_le > ?').get(compteId, depuis) as { n: number };
    if (parNumero.n >= CODES_PAR_NUMERO_PAR_HEURE || parCompte.n >= CODES_PAR_COMPTE_PAR_HEURE) return false;
    this.db.prepare('DELETE FROM codes_telephone WHERE cree_le < ?').run(depuis); // ménage
    this.db
      .prepare('INSERT INTO codes_telephone (numero, compte_id, code, cree_le, expire_le) VALUES (?, ?, ?, ?, ?)')
      .run(numero, compteId, empreinte(`${numero}:${code}`), maintenant, maintenant + CODE_VALIDITE_MS);
    return true;
  }

  /** Vérifie le dernier code envoyé à ce numéro pour ce compte. */
  verifierCode(compteId: string, numero: string, code: string): ResultatCode {
    const l = this.db
      .prepare('SELECT rowid, code, expire_le, essais FROM codes_telephone WHERE numero = ? AND compte_id = ? ORDER BY cree_le DESC LIMIT 1')
      .get(numero, compteId) as { rowid: number; code: string; expire_le: number; essais: number } | undefined;
    if (!l) return 'invalide';
    if (l.essais >= CODE_ESSAIS_MAX) return 'trop_essais';
    if (l.expire_le < this.maintenant().getTime()) return 'expire';
    this.db.prepare('UPDATE codes_telephone SET essais = essais + 1 WHERE rowid = ?').run(l.rowid);
    if (l.code !== empreinte(`${numero}:${code}`)) return l.essais + 1 >= CODE_ESSAIS_MAX ? 'trop_essais' : 'invalide';
    this.db.prepare('DELETE FROM codes_telephone WHERE numero = ?').run(numero);
    return 'ok';
  }

  /**
   * Rattache un numéro vérifié au compte de cet appareil.
   * Si le numéro appartient déjà à un autre compte (téléphone perdu ou réinitialisé), c'est une
   * récupération : l'appareil reprend l'ancien compte, qui reçoit un nouveau jeton (l'ancien
   * appareil est déconnecté). L'abonnement le plus long et les paiements sont conservés, les
   * scans du jour s'additionnent (pas de quota gratuit en double).
   */
  lierTelephone(compteId: string, numero: string): { compteId: string; nouveauJeton: string | null } {
    const ancien = this.db.prepare('SELECT id FROM comptes WHERE telephone = ?').get(numero) as { id: string } | undefined;
    if (!ancien || ancien.id === compteId) {
      this.db.prepare('UPDATE comptes SET telephone = ? WHERE id = ?').run(numero, compteId);
      return { compteId, nouveauJeton: null };
    }
    const actuel = this.compte(compteId)!;
    const garde = this.compte(ancien.id)!;
    const jour = this.aujourdhui();
    const nouveauJeton = randomBytes(32).toString('base64url');
    const plusLong = (actuel.premiumJusquau ?? '') > (garde.premiumJusquau ?? '') ? actuel : garde;

    this.db.exec('BEGIN');
    try {
      this.db.prepare('UPDATE comptes SET jeton = ?, premium_jusquau = ?, plan = ? WHERE id = ?').run(empreinte(nouveauJeton), plusLong.premiumJusquau, plusLong.plan, garde.id);
      this.db
        .prepare(
          'INSERT INTO scans (compte_id, jour, nombre) VALUES (?, ?, ?) ON CONFLICT (compte_id, jour) DO UPDATE SET nombre = nombre + excluded.nombre',
        )
        .run(garde.id, jour, this.scansUtilises(actuel.id));
      this.db.prepare('UPDATE paiements SET compte_id = ? WHERE compte_id = ?').run(garde.id, actuel.id);
      this.db.prepare('DELETE FROM scans WHERE compte_id = ?').run(actuel.id);
      this.db.prepare('DELETE FROM codes_telephone WHERE compte_id = ?').run(actuel.id);
      this.db.prepare('DELETE FROM scans_rendus WHERE compte_id = ?').run(actuel.id);
      this.db.prepare('DELETE FROM comptes WHERE id = ?').run(actuel.id);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return { compteId: garde.id, nouveauJeton };
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
