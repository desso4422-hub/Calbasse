/**
 * Photos des scans en attente de réseau : gardées dans le dossier de l'app (pas dans le cache,
 * que le système peut vider) jusqu'à ce que le repas soit analysé et enregistré.
 * Sur le web, il n'y a pas de système de fichiers : la photo reste dans l'état de l'app (base64).
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

function dossier(): Directory {
  const d = new Directory(Paths.document, 'scans-en-attente');
  d.create({ idempotent: true, intermediates: true });
  return d;
}

/** Garde la photo ; renvoie son adresse locale, ou null sur le web (la photo reste alors en base64). */
export async function garderPhoto(cle: string, base64: string): Promise<string | null> {
  if (web) return null;
  const fichier = new File(dossier(), `${cle}.jpg`);
  await fichier.write(base64, { encoding: 'base64' });
  return fichier.uri;
}

export async function lirePhoto(uri: string | null, base64?: string): Promise<string> {
  if (base64) return base64;
  if (!uri) throw new Error('Photo introuvable');
  return new File(uri).base64();
}

export function supprimerPhoto(uri: string | null | undefined) {
  if (web || !uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // déjà supprimée
  }
}
