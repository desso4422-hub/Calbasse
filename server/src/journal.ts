/**
 * Journal des scans et des corrections (fichiers JSONL dans DATA_DIR).
 *
 * C'est la matière première pour améliorer la reconnaissance : chaque fois qu'un utilisateur
 * remplace un aliment proposé, on sait où le modèle se trompe (et on enrichit les descriptions
 * « Aspect » de la base, ou le jeu d'évaluation). Les photos ne sont PAS conservées par défaut.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class Journal {
  private readonly dossier: string;
  private readonly garderPhotos: boolean;

  constructor(dossier: string, garderPhotos: boolean) {
    this.dossier = dossier;
    this.garderPhotos = garderPhotos;
  }

  private async ajouter(fichier: string, entree: object) {
    await mkdir(this.dossier, { recursive: true });
    await appendFile(path.join(this.dossier, fichier), JSON.stringify({ date: new Date().toISOString(), ...entree }) + '\n');
  }

  async scan(scanId: string, entree: object, image?: string) {
    await this.ajouter('scans.jsonl', { scanId, ...entree });
    if (this.garderPhotos && image) {
      await mkdir(path.join(this.dossier, 'photos'), { recursive: true });
      await writeFile(path.join(this.dossier, 'photos', `${scanId}.jpg`), Buffer.from(image, 'base64'));
    }
  }

  async correction(entree: object) {
    await this.ajouter('corrections.jsonl', entree);
  }
}
