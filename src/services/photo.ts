/**
 * Prépare une photo pour l'analyse : JPEG, 1568 px maximum sur le grand côté.
 * C'est assez pour reconnaître une assiette, et ça garde l'envoi léger (~200-400 Ko) sur un réseau mobile.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const COTE_MAX = 1568;

export async function preparerPhoto(photo: { uri: string; width: number; height: number }): Promise<{ uri: string; base64: string }> {
  const contexte = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > COTE_MAX) {
    contexte.resize(photo.width >= photo.height ? { width: COTE_MAX } : { height: COTE_MAX });
  }
  const image = await contexte.renderAsync();
  const resultat = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!resultat.base64) throw new Error('Photo illisible');
  return { uri: resultat.uri, base64: resultat.base64 };
}
